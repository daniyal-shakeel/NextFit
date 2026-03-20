import os
import torch
import numpy as np
from PIL import Image, ImageFilter
from diffusers import AutoPipelineForInpainting, AutoencoderKL

from pipeline.preprocessing.pose import extract_pose
from pipeline.preprocessing.parsing import parse_human
from pipeline.preprocessing.masking import generate_cloth_mask
from pipeline.preprocessing.warping import warp_garment

INFER_SIZE = 1024
NUM_STEPS = 40
STRENGTH = 1.0
IP_ADAPTER_SCALE = 0.6
GUIDANCE_SCALE = 7.5
FEATHER_RADIUS = 21

SDXL_MODEL = "diffusers/stable-diffusion-xl-1.0-inpainting-0.1"
VAE_MODEL = "madebyollin/sdxl-vae-fp16-fix"


def _center_crop_square(img: Image.Image, size: int) -> tuple[Image.Image, tuple[int, int, int, int]]:
    w, h = img.size
    short = min(w, h)
    left = (w - short) // 2
    top = (h - short) // 2
    box = (left, top, left + short, top + short)
    return img.crop(box).resize((size, size), Image.LANCZOS), box


def _composite_with_mask(
    original: Image.Image,
    generated: Image.Image,
    mask: Image.Image,
    feather: int = FEATHER_RADIUS,
) -> Image.Image:
    """Blend generated result into original using feathered mask."""
    mask_l = mask.convert("L")
    if feather > 0:
        k = feather | 1
        mask_l = mask_l.filter(ImageFilter.GaussianBlur(k))
    mask_np = np.array(mask_l, dtype=np.float32) / 255.0
    orig_np = np.array(original, dtype=np.float32)
    gen_np = np.array(generated, dtype=np.float32)
    blended = orig_np * (1 - mask_np[..., None]) + gen_np * mask_np[..., None]
    return Image.fromarray(blended.astype(np.uint8))


class TryOnPipeline:
    def __init__(self, model_id=SDXL_MODEL, cache_dir="./models"):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if self.device == "cuda" else torch.float32
        token = os.environ.get("HF_TOKEN")

        print(f"[TryOn] Device: {self.device}")

        print(f"[TryOn] Loading fp16-fix VAE: {VAE_MODEL}")
        vae = AutoencoderKL.from_pretrained(
            VAE_MODEL, torch_dtype=dtype, cache_dir=cache_dir, token=token,
        )

        print(f"[TryOn] Loading SDXL inpainting model: {model_id}")
        self.pipe = AutoPipelineForInpainting.from_pretrained(
            model_id, vae=vae, torch_dtype=dtype,
            cache_dir=cache_dir, token=token,
        )

        print("[TryOn] Loading IP-Adapter (SDXL)...")
        self.pipe.load_ip_adapter(
            "h94/IP-Adapter",
            subfolder="sdxl_models",
            weight_name="ip-adapter_sdxl.bin",
            cache_dir=cache_dir,
        )
        self.pipe.set_ip_adapter_scale(IP_ADAPTER_SCALE)

        if self.device == "cuda":
            self.pipe.enable_model_cpu_offload()
            self.pipe.enable_vae_slicing()
            print("[TryOn] GPU optimizations enabled (cpu_offload + vae_slicing)")

        print("[TryOn] Pipeline ready")

    def run(
        self,
        person_image: Image.Image,
        garment_image: Image.Image,
        category: str = "upper_body",
    ) -> Image.Image:
        print("[TryOn] === Starting try-on ===")
        original = person_image.convert("RGB")
        orig_w, orig_h = original.size

        person_sq, crop_box = _center_crop_square(original, INFER_SIZE)
        garment_sq = garment_image.convert("RGB").resize((INFER_SIZE, INFER_SIZE), Image.LANCZOS)

        print("[TryOn] Step 1/5: Extracting pose landmarks...")
        pose_data = extract_pose(person_sq)
        print(f"[TryOn]   Found {len(pose_data['landmarks'])} landmarks")

        print("[TryOn] Step 2/5: Parsing human segmentation...")
        parse_human(person_sq)
        print("[TryOn]   Human parsing complete")

        print(f"[TryOn] Step 3/5: Generating cloth mask (category={category})...")
        cloth_mask = generate_cloth_mask(person_sq, pose_data, category)
        print("[TryOn]   Cloth mask generated (with face protection)")

        print("[TryOn] Step 4/5: Warping garment to body proportions...")
        warped_garment = warp_garment(garment_sq, pose_data, (INFER_SIZE, INFER_SIZE))
        garment_for_ip = warped_garment.convert("RGB")
        print("[TryOn]   Garment warped")

        print(f"[TryOn] Step 5/5: SDXL inpainting with IP-Adapter ({NUM_STEPS} steps)...")
        raw_result = self.pipe(
            prompt="photorealistic person wearing shirt, natural fabric draping, realistic shadows, seamless fit, high resolution portrait",
            negative_prompt="white border, black border, floating garment, misaligned clothing, artifacts, blurry, distorted face, extra limbs",
            image=person_sq,
            mask_image=cloth_mask.convert("L"),
            ip_adapter_image=garment_for_ip,
            num_inference_steps=NUM_STEPS,
            guidance_scale=GUIDANCE_SCALE,
            strength=STRENGTH,
            height=INFER_SIZE,
            width=INFER_SIZE,
        ).images[0]

        print("[TryOn] Compositing: preserving face + background via mask blend...")
        result_sq = _composite_with_mask(person_sq, raw_result, cloth_mask)

        # Place back into original dimensions
        short = crop_box[2] - crop_box[0]
        result_cropped = result_sq.resize((short, short), Image.LANCZOS)
        final = original.copy()
        final.paste(result_cropped, (crop_box[0], crop_box[1]))

        print("[TryOn] === Try-on complete ===")
        return final
