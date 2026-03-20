import os
import torch
from PIL import Image
from diffusers import StableDiffusionXLInpaintPipeline

from pipeline.preprocessing.pose import extract_pose
from pipeline.preprocessing.parsing import parse_human
from pipeline.preprocessing.masking import generate_cloth_mask
from pipeline.preprocessing.warping import warp_garment

TARGET_SIZE = (768, 1024)
NUM_STEPS = 40
STRENGTH = 0.99
IP_ADAPTER_SCALE = 0.5
GUIDANCE_SCALE = 7.5

SDXL_MODEL = "diffusers/stable-diffusion-xl-1.0-inpainting-0.1"


class TryOnPipeline:
    def __init__(self, model_id=SDXL_MODEL, cache_dir="./models"):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.target_size = TARGET_SIZE
        token = os.environ.get("HF_TOKEN")

        print(f"[TryOn] Device: {self.device}")
        print(f"[TryOn] Loading SDXL inpainting model: {model_id}")
        self.pipe = StableDiffusionXLInpaintPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
            cache_dir=cache_dir,
            token=token,
        )

        print("[TryOn] Loading IP-Adapter (SDXL) for garment conditioning...")
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

        person_resized = person_image.resize(self.target_size).convert("RGB")
        garment_resized = garment_image.resize(self.target_size).convert("RGB")

        print("[TryOn] Step 1/5: Extracting pose landmarks...")
        pose_data = extract_pose(person_resized)
        print(f"[TryOn]   Found {len(pose_data['landmarks'])} landmarks")

        print("[TryOn] Step 2/5: Parsing human segmentation...")
        parse_human(person_resized)
        print("[TryOn]   Human parsing complete")

        print(f"[TryOn] Step 3/5: Generating cloth mask (category={category})...")
        cloth_mask = generate_cloth_mask(person_resized, pose_data, category)
        print("[TryOn]   Cloth mask generated")

        print("[TryOn] Step 4/5: Warping garment to body proportions...")
        warped_rgba = warp_garment(garment_resized, pose_data, self.target_size)
        print("[TryOn]   Garment warped (background removed)")

        warped_rgb = warped_rgba.convert("RGB")
        warped_alpha = warped_rgba.split()[3]

        composite = person_resized.copy()
        composite.paste(warped_rgb, mask=warped_alpha)

        print(f"[TryOn] Step 5/5: SDXL inpainting with IP-Adapter ({NUM_STEPS} steps)...")
        result = self.pipe(
            prompt="photorealistic person wearing shirt, natural fabric draping, realistic shadows, seamless fit, high resolution portrait",
            negative_prompt="white background, black background, floating garment, misaligned clothing, artifacts, blurry, distorted face",
            image=composite,
            mask_image=cloth_mask.convert("L"),
            ip_adapter_image=warped_rgb,
            num_inference_steps=NUM_STEPS,
            guidance_scale=GUIDANCE_SCALE,
            strength=STRENGTH,
            height=self.target_size[1],
            width=self.target_size[0],
        ).images[0]

        print("[TryOn] === Try-on complete ===")
        return result
