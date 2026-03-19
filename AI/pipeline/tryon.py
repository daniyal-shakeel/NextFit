import os
import torch
from PIL import Image
from diffusers import StableDiffusionInpaintPipeline

from pipeline.preprocessing.pose import extract_pose
from pipeline.preprocessing.parsing import parse_human
from pipeline.preprocessing.masking import generate_cloth_mask
from pipeline.preprocessing.warping import warp_garment

TARGET_SIZE = (768, 1024)
INPAINT_SIZE = (512, 512)


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

        print("[TryOn] Loading IP-Adapter for garment conditioning...")
        self.pipe.load_ip_adapter(
            "h94/IP-Adapter",
            subfolder="models",
            weight_name="ip-adapter_sd15.bin",
            cache_dir=cache_dir,
        )
        self.pipe.set_ip_adapter_scale(0.7)

        if self.device == "cuda":
            self.pipe.enable_model_cpu_offload()
            self.pipe.enable_attention_slicing()
            print("[TryOn] GPU optimizations enabled (cpu_offload + attention_slicing)")

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

        # Step 1: Pose extraction
        print("[TryOn] Step 1/4: Extracting pose landmarks...")
        pose_data = extract_pose(person_resized)
        print(f"[TryOn]   Found {len(pose_data['landmarks'])} landmarks")

        # Step 2: Human parsing
        print("[TryOn] Step 2/4: Parsing human segmentation...")
        parse_result = parse_human(person_resized)
        print("[TryOn]   Human parsing complete")

        # Step 3: Cloth masking
        print(f"[TryOn] Step 3/4: Generating cloth mask (category={category})...")
        cloth_mask = generate_cloth_mask(person_resized, pose_data, category)
        print("[TryOn]   Cloth mask generated")

        # Step 4: Garment warping
        print("[TryOn] Step 4/4: Warping garment to body proportions...")
        warped_garment = warp_garment(garment_resized, pose_data, self.target_size)
        print("[TryOn]   Garment warped")

        # Resize to inpaint model size
        person_inpaint = person_resized.resize(INPAINT_SIZE)
        mask_inpaint = cloth_mask.resize(INPAINT_SIZE)
        garment_inpaint = warped_garment.resize(INPAINT_SIZE)

        # Run inpainting with IP-Adapter garment conditioning
        print("[TryOn] Running inference (30 steps)...")
        result = self.pipe(
            prompt="person wearing this exact garment, photorealistic, high quality, natural lighting, well-fitted clothing",
            negative_prompt="blurry, distorted, deformed, low quality, watermark, wrong garment, bad anatomy",
            image=person_inpaint,
            mask_image=mask_inpaint,
            ip_adapter_image=garment_inpaint,
            num_inference_steps=30,
            guidance_scale=7.5,
            height=512,
            width=512,
        ).images[0]

        # Scale back to target size
        result = result.resize(self.target_size, Image.LANCZOS)

        print("[TryOn] === Try-on complete ===")
        return result
