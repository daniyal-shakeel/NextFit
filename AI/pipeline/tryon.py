import os
import torch
from PIL import Image, ImageDraw
from diffusers import StableDiffusionInpaintPipeline


class TryOnPipeline:
    def __init__(
        self,
        model_id: str = "sd2-community/stable-diffusion-2-inpainting",
        cache_dir: str = "./models",
    ):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Loading model on: {self.device}")

        self.pipe = StableDiffusionInpaintPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
            cache_dir=cache_dir,
            safety_checker=None,
            token=os.environ.get("HF_TOKEN"),
        ).to(self.device)

        self.pipe.load_ip_adapter(
            "h94/IP-Adapter",
            subfolder="models",
            weight_name="ip-adapter_sd15.bin",
            cache_dir=cache_dir,
        )
        self.pipe.set_ip_adapter_scale(0.8)

        print("Model loaded successfully")

    def run(
        self,
        person_image: Image.Image,
        garment_image: Image.Image,
        category: str = "upper_body",
    ) -> Image.Image:
        # Resize to model expected size
        person_resized = person_image.resize((512, 512)).convert("RGB")
        garment_resized = garment_image.resize((256, 256)).convert("RGB")

        # Generate body region mask
        mask = self._generate_mask(person_resized, category)

        result = self.pipe(
            prompt="person wearing this exact garment, photorealistic, high quality, natural lighting",
            negative_prompt="blurry, distorted, deformed, low quality, watermark, wrong garment",
            image=person_resized,
            mask_image=mask,
            ip_adapter_image=garment_resized,
            num_inference_steps=30,
            guidance_scale=7.5,
            height=512,
            width=512,
        ).images[0]

        return result

    def _generate_mask(self, image: Image.Image, category: str) -> Image.Image:
        w, h = image.size
        mask = Image.new("RGB", (w, h), "black")
        draw = ImageDraw.Draw(mask)

        if category == "upper_body":
            # Torso region
            draw.rectangle(
                [int(w * 0.15), int(h * 0.18), int(w * 0.85), int(h * 0.65)],
                fill="white",
            )
        elif category == "lower_body":
            draw.rectangle(
                [int(w * 0.15), int(h * 0.55), int(w * 0.85), int(h * 0.95)],
                fill="white",
            )
        else:  # full body / dresses
            draw.rectangle(
                [int(w * 0.15), int(h * 0.18), int(w * 0.85), int(h * 0.95)],
                fill="white",
            )

        return mask
