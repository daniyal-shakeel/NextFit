from diffusers import AutoPipelineForInpainting
import torch
from PIL import Image, ImageDraw


class TryOnPipeline:
    def __init__(self, model_id="yisol/IDM-VTON", cache_dir="./models"):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Loading IDM-VTON on: {self.device}")
        
        self.pipe = AutoPipelineForInpainting.from_pretrained(
            model_id,
            torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
            cache_dir=cache_dir,
        ).to(self.device)
        print("IDM-VTON loaded")

    def run(self, person_image, garment_image, category="upper_body"):
        person_resized  = person_image.resize((768, 1024)).convert("RGB")
        garment_resized = garment_image.resize((768, 1024)).convert("RGB")
        mask = self._generate_mask(person_resized, category)

        result = self.pipe(
            prompt="a photo of a model wearing the garment, photorealistic",
            negative_prompt="low quality, blurry, distorted",
            image=person_resized,
            mask_image=mask,
            ip_adapter_image=garment_resized,
            num_inference_steps=30,
            guidance_scale=7.5,
        ).images[0]
        return result

    def _generate_mask(self, image, category):
        w, h = image.size
        mask = Image.new("RGB", (w, h), "black")
        draw = ImageDraw.Draw(mask)
        if category == "upper_body":
            draw.rectangle([int(w*0.1), int(h*0.15), int(w*0.9), int(h*0.65)], fill="white")
        elif category == "lower_body":
            draw.rectangle([int(w*0.1), int(h*0.55), int(w*0.9), int(h*0.95)], fill="white")
        else:
            draw.rectangle([int(w*0.1), int(h*0.15), int(w*0.9), int(h*0.95)], fill="white")
        return mask
