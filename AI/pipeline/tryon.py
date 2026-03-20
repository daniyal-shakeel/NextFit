import os
import torch
import numpy as np
from PIL import Image, ImageFilter
from diffusers import StableDiffusionInpaintPipeline

from pipeline.preprocessing.pose import extract_pose
from pipeline.preprocessing.parsing import parse_human
from pipeline.preprocessing.masking import generate_cloth_mask
from pipeline.preprocessing.warping import warp_garment

TARGET_SIZE = (768, 1024)
INPAINT_SIZE = (512, 512)
EDGE_DILATE_PX = 12
BLEND_STEPS = 20
BLEND_STRENGTH = 0.55


class TryOnPipeline:
    def __init__(self, model_id="runwayml/stable-diffusion-inpainting", cache_dir="./models"):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.target_size = TARGET_SIZE
        token = os.environ.get("HF_TOKEN")

        print(f"[TryOn] Device: {self.device}")
        print(f"[TryOn] Loading inpainting model: {model_id}")
        self.pipe = StableDiffusionInpaintPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
            cache_dir=cache_dir,
            safety_checker=None,
            token=token,
        )

        if self.device == "cuda":
            self.pipe.enable_model_cpu_offload()
            self.pipe.enable_attention_slicing()
            print("[TryOn] GPU optimizations enabled (cpu_offload + attention_slicing)")

        print("[TryOn] Pipeline ready")

    @staticmethod
    def _build_edge_mask(mask: Image.Image, dilate_px: int = EDGE_DILATE_PX) -> Image.Image:
        """Create a mask covering only the seam/edge region around the clothing boundary."""
        mask_np = np.array(mask.convert("L"))
        dilated = np.array(mask.convert("L").filter(ImageFilter.MaxFilter(dilate_px * 2 + 1)))
        erode_size = max(dilate_px - 2, 3) | 1  # must be odd
        eroded = np.array(mask.convert("L").filter(ImageFilter.MinFilter(erode_size)))
        edge = np.where((dilated > 127) & (eroded < 128), 255, 0).astype(np.uint8)
        return Image.fromarray(edge, mode="L")

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
        warped_garment = warp_garment(garment_resized, pose_data, self.target_size)
        print("[TryOn]   Garment warped")

        print("[TryOn] Step 5/5: Compositing & edge-blend inpainting...")
        composite = person_resized.copy()
        composite.paste(warped_garment, mask=cloth_mask.convert("L"))

        edge_mask = self._build_edge_mask(cloth_mask)

        composite_sm = composite.resize(INPAINT_SIZE)
        edge_mask_sm = edge_mask.resize(INPAINT_SIZE)

        print(f"[TryOn] Running edge-blend inference ({BLEND_STEPS} steps, strength={BLEND_STRENGTH})...")
        result = self.pipe(
            prompt="photorealistic, natural skin and fabric transition, seamless clothing fit, studio lighting",
            negative_prompt="blurry, artifacts, seam line, stitching visible, distorted, bad anatomy",
            image=composite_sm,
            mask_image=edge_mask_sm,
            num_inference_steps=BLEND_STEPS,
            guidance_scale=7.5,
            strength=BLEND_STRENGTH,
            height=INPAINT_SIZE[1],
            width=INPAINT_SIZE[0],
        ).images[0]

        result = result.resize(self.target_size, Image.LANCZOS)

        print("[TryOn] === Try-on complete ===")
        return result
