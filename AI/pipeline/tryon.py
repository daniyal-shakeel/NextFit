import os
import torch
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
from diffusers import AutoPipelineForInpainting, AutoencoderKL

from pipeline.preprocessing.pose import extract_pose
from pipeline.preprocessing.parsing import parse_human
from pipeline.preprocessing.measurements import extract_measurements
from pipeline.preprocessing.masking import generate_cloth_mask
from pipeline.preprocessing.warping import warp_garment

INFER_SIZE = 1024
NUM_STEPS = 40
STRENGTH = 0.75
IP_ADAPTER_SCALE = 0.5
GUIDANCE_SCALE = 7.5
FEATHER_RADIUS = 21
CROP_PAD = 0.15

SDXL_MODEL = "diffusers/stable-diffusion-xl-1.0-inpainting-0.1"
VAE_MODEL = "madebyollin/sdxl-vae-fp16-fix"

NOSE = 0
L_EYE = 2
R_EYE = 5
L_SHOULDER = 11
R_SHOULDER = 12
L_ELBOW = 13
R_ELBOW = 14
L_WRIST = 15
R_WRIST = 16
L_HIP = 23
R_HIP = 24


def _pose_aware_crop(
    img: Image.Image,
    pose_data: dict,
    size: int,
) -> tuple[Image.Image, tuple[int, int, int, int]]:
    """Crop around the detected person using pose landmarks, then resize."""
    w, h = img.size
    lms = pose_data["landmarks"]

    x_indices = [L_SHOULDER, R_SHOULDER, L_ELBOW, R_ELBOW, L_WRIST, R_WRIST]
    y_top_indices = [NOSE, L_EYE, R_EYE]
    y_bot_indices = [L_HIP, R_HIP]

    xs = [lms[i]["x"] * w for i in x_indices if lms[i]["visibility"] > 0.3]
    ys_top = [lms[i]["y"] * h for i in y_top_indices if lms[i]["visibility"] > 0.3]
    ys_bot = [lms[i]["y"] * h for i in y_bot_indices if lms[i]["visibility"] > 0.3]

    if not xs or not ys_top or not ys_bot:
        short = min(w, h)
        left = (w - short) // 2
        top = (h - short) // 2
        box = (left, top, left + short, top + short)
        return img.crop(box).resize((size, size), Image.LANCZOS), box

    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys_top), max(ys_bot)

    pad_x = (x_max - x_min) * CROP_PAD
    pad_y = (y_max - y_min) * CROP_PAD

    x1 = max(0, int(x_min - pad_x))
    y1 = max(0, int(y_min - pad_y))
    x2 = min(w, int(x_max + pad_x))
    y2 = min(h, int(y_max + pad_y))

    bw, bh = x2 - x1, y2 - y1
    side = max(bw, bh)
    cx, cy = (x1 + x2) // 2, (y1 + y2) // 2

    sq_x1 = max(0, cx - side // 2)
    sq_y1 = max(0, cy - side // 2)
    sq_x2 = min(w, sq_x1 + side)
    sq_y2 = min(h, sq_y1 + side)

    if sq_x2 - sq_x1 < side:
        sq_x1 = max(0, sq_x2 - side)
    if sq_y2 - sq_y1 < side:
        sq_y1 = max(0, sq_y2 - side)

    box = (sq_x1, sq_y1, sq_x2, sq_y2)
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


def _post_process(result: Image.Image, mask: Image.Image) -> Image.Image:
    """Sharpen, boost contrast, and smooth seam edges."""
    import cv2 as cv

    sharpened = result.filter(
        ImageFilter.UnsharpMask(radius=1.5, percent=130, threshold=3)
    )
    enhanced = ImageEnhance.Contrast(sharpened).enhance(1.08)

    mask_l = np.array(mask.convert("L"))
    dilated = cv.dilate(mask_l, np.ones((5, 5), np.uint8), iterations=1)
    eroded = cv.erode(mask_l, np.ones((5, 5), np.uint8), iterations=1)
    edge = ((dilated > 127) & (eroded < 128)).astype(np.uint8) * 255
    edge_blur = cv.GaussianBlur(edge, (7, 7), 0).astype(np.float32) / 255.0

    arr = np.array(enhanced, dtype=np.float32)
    blurred = cv.GaussianBlur(arr, (3, 3), 0)
    out = arr * (1 - edge_blur[..., None]) + blurred * edge_blur[..., None]
    return Image.fromarray(out.astype(np.uint8))


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
    ) -> dict:
        print("[TryOn] === Starting try-on ===")
        original = person_image.convert("RGB")

        print("[TryOn] Step 1/8: Extracting pose for smart crop...")
        pre_pose = extract_pose(original)
        person_sq, crop_box = _pose_aware_crop(original, pre_pose, INFER_SIZE)
        garment_sq = garment_image.convert("RGB").resize(
            (INFER_SIZE, INFER_SIZE), Image.LANCZOS,
        )
        print(f"[TryOn]   Smart crop box: {crop_box}")

        print("[TryOn] Step 2/8: Extracting pose on cropped image...")
        pose_data = extract_pose(person_sq)
        print(f"[TryOn]   Found {len(pose_data['landmarks'])} landmarks")

        print("[TryOn] Step 3/8: Extracting body measurements...")
        measurements = extract_measurements(pose_data)
        print(
            f"[TryOn]   shoulder={measurements['shoulder_width']:.0f}px  "
            f"torso={measurements['torso_height']:.0f}px  "
            f"L-arm={measurements['left_arm_length']:.0f}px  "
            f"R-arm={measurements['right_arm_length']:.0f}px"
        )

        print("[TryOn] Step 4/8: Parsing human segmentation...")
        parse_human(person_sq)
        print("[TryOn]   Human parsing complete")

        print(f"[TryOn] Step 5/8: Generating cloth mask (category={category})...")
        cloth_mask = generate_cloth_mask(person_sq, pose_data, measurements, category)
        print("[TryOn]   Cloth mask generated (with face protection)")

        print("[TryOn] Step 6/8: Warping garment (rembg + zone split)...")
        warped_rgba = warp_garment(
            garment_sq, pose_data, measurements, (INFER_SIZE, INFER_SIZE),
        )
        warped_rgb = warped_rgba.convert("RGB")
        warped_alpha = warped_rgba.split()[3]
        print("[TryOn]   Garment warped and positioned")

        print("[TryOn] Step 7/8: Compositing garment + SDXL inpainting...")
        mask_l = cloth_mask.convert("L")
        composite = person_sq.copy()
        composite.paste(warped_rgb, mask=warped_alpha)

        preprocessed = composite.copy()

        raw_result = self.pipe(
            prompt="photorealistic person wearing shirt, natural fabric draping, realistic shadows, seamless fit, high resolution portrait",
            negative_prompt="white border, black border, floating garment, misaligned clothing, artifacts, blurry, distorted face, extra limbs",
            image=composite,
            mask_image=mask_l,
            ip_adapter_image=warped_rgb,
            num_inference_steps=NUM_STEPS,
            guidance_scale=GUIDANCE_SCALE,
            strength=STRENGTH,
            height=INFER_SIZE,
            width=INFER_SIZE,
        ).images[0]

        print("[TryOn] Step 8/8: Compositing + post-processing...")
        result_sq = _composite_with_mask(person_sq, raw_result, cloth_mask)
        result_sq = _post_process(result_sq, cloth_mask)

        crop_w = crop_box[2] - crop_box[0]
        crop_h = crop_box[3] - crop_box[1]
        result_cropped = result_sq.resize((crop_w, crop_h), Image.LANCZOS)
        final = original.copy()
        final.paste(result_cropped, (crop_box[0], crop_box[1]))

        print("[TryOn] === Try-on complete ===")
        return {"result": final, "preprocessed": preprocessed}
