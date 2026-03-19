import os
import torch
import numpy as np
from PIL import Image
from diffusers import AutoencoderKL
from huggingface_hub import snapshot_download

from pipeline.preprocessing.pose import extract_pose
from pipeline.preprocessing.masking import generate_cloth_mask
from pipeline.preprocessing.warping import warp_garment
from pipeline.preprocessing.parsing import parse_human


TARGET_SIZE = (768, 1024)


class TryOnPipeline:
    def __init__(
        self,
        model_id: str = "yisol/IDM-VTON",
        cache_dir: str = "./models",
    ):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[TryOn] Using device: {self.device}")

        # Download model weights if not cached
        model_path = os.path.join(
            cache_dir, model_id.replace("/", "--")
        )
        if not os.path.exists(model_path):
            print(f"[TryOn] Downloading {model_id}...")
            snapshot_download(
                repo_id=model_id,
                local_dir=model_path,
                token=os.environ.get("HF_TOKEN"),
                ignore_patterns=["*.msgpack", "*.h5"],
            )
            print("[TryOn] Download complete")

        # Load IDM-VTON pipeline
        print("[TryOn] Loading IDM-VTON pipeline...")
        from diffusers import StableDiffusionXLInpaintPipeline

        self.pipe = StableDiffusionXLInpaintPipeline.from_pretrained(
            model_path,
            torch_dtype=torch.float16,
            variant="fp16",
            safety_checker=None,
        ).to(self.device)

        # Memory optimizations for L4
        self.pipe.enable_model_cpu_offload()
        self.pipe.enable_attention_slicing()

        print("[TryOn] IDM-VTON loaded successfully")

    def run(
        self,
        person_image: Image.Image,
        garment_image: Image.Image,
        category: str = "upper_body",
    ) -> Image.Image:

        print("[TryOn] Starting preprocessing...")

        # Step 1: Resize inputs
        person_resized = person_image.resize(TARGET_SIZE).convert("RGB")
        garment_resized = garment_image.resize(TARGET_SIZE).convert("RGB")

        # Step 2: Extract pose
        try:
            pose_data = extract_pose(person_resized)
            print("[TryOn] Pose extracted successfully")
        except ValueError as e:
            print(f"[TryOn] Pose extraction failed: {e}")
            raise

        # Step 3: Parse human body
        parsed = parse_human(person_resized)
        print("[TryOn] Human parsing complete")

        # Step 4: Generate cloth mask
        mask = generate_cloth_mask(person_resized, pose_data, category)
        print("[TryOn] Cloth mask generated")

        # Step 5: Warp garment to body
        warped_garment = warp_garment(garment_resized, pose_data, TARGET_SIZE)
        print("[TryOn] Garment warped")

        # Step 6: IDM-VTON inference
        print("[TryOn] Running IDM-VTON inference...")
        prompt = (
            "a photo of a person wearing the garment, "
            "photorealistic, high quality, natural lighting, "
            "well-fitted clothing, detailed fabric texture"
        )
        negative_prompt = (
            "low quality, blurry, distorted, deformed, "
            "bad anatomy, watermark, cartoon, painting"
        )

        result = self.pipe(
            prompt=prompt,
            negative_prompt=negative_prompt,
            image=person_resized,
            mask_image=mask,
            ip_adapter_image=warped_garment,
            num_inference_steps=30,
            guidance_scale=7.5,
            strength=0.99,
            height=TARGET_SIZE[1],
            width=TARGET_SIZE[0],
        ).images[0]

        print("[TryOn] Inference complete")
        return result
