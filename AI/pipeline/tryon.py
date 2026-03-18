"""
CatVTON Try-On Pipeline.

Uses the official CatVTON model from the cloned repo.
Requires: Run setup.sh first to clone CatVTON.
"""
import os
import sys
import time
import torch
from PIL import Image

# Path to cloned CatVTON repo (NextFit/AI/CatVTON)
AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATVTON_REPO = os.path.join(AI_DIR, "CatVTON")

if not os.path.exists(CATVTON_REPO):
    raise RuntimeError(
        "CatVTON repo not found. Run setup.sh first."
    )

sys.path.insert(0, CATVTON_REPO)

from model.cloth_masker import AutoMasker
from model.pipeline import CatVTONPipeline
from diffusers.image_processor import VaeImageProcessor
from huggingface_hub import snapshot_download
from utils import init_weight_dtype, resize_and_crop, resize_and_padding


class TryOnPipeline:
    """Virtual try-on pipeline using CatVTON."""

    def __init__(self, model_id: str, cache_dir: str = "./models"):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model_id = model_id
        self.cache_dir = cache_dir
        self.size = (768, 1024)

        # Download zhengchong/CatVTON weights only (with retry for unstable connections)
        local_dir = os.path.join(cache_dir, model_id.replace("/", "--"))
        max_retries = 3
        for attempt in range(max_retries):
            try:
                repo_path = snapshot_download(
                    repo_id=model_id,
                    local_dir=local_dir,
                    ignore_patterns=["*.msgpack", "*.h5"],
                    resume_download=True,
                )
                break
            except Exception as e:
                if attempt < max_retries - 1:
                    print(f"Download failed (attempt {attempt + 1}/{max_retries}): {e}")
                    print("Retrying in 10 seconds...")
                    time.sleep(10)
                else:
                    raise

        weight_dtype = init_weight_dtype("bf16")

        # CatVTONPipeline from cloned repo - base model loaded internally from attn_ckpt
        self._pipeline = CatVTONPipeline(
            base_ckpt="booksforcharlie/stable-diffusion-inpainting",
            attn_ckpt=repo_path,
            attn_ckpt_version="mix",
            weight_dtype=weight_dtype,
            use_tf32=True,
            device=self.device,
            skip_safety_check=True,
        )

        self._mask_processor = VaeImageProcessor(
            vae_scale_factor=8,
            do_normalize=False,
            do_binarize=True,
            do_convert_grayscale=True,
        )

        self._automasker = AutoMasker(
            densepose_ckpt=os.path.join(repo_path, "DensePose"),
            schp_ckpt=os.path.join(repo_path, "SCHP"),
            device=self.device,
        )

        deploy_mode = os.getenv("DEPLOY_MODE", "local")
        if deploy_mode in ("vast", "gcp"):
            try:
                self._pipeline.unet.enable_xformers_memory_efficient_attention()
                print("xFormers enabled")
            except Exception as e:
                print(f"xFormers not available: {e} — continuing without it")
        else:
            print("Local mode — xFormers skipped")

        print(f"CatVTON loaded on {self.device}")

    def run(
        self,
        person_image: Image.Image,
        garment_image: Image.Image,
        category: str = "upper_body",
    ) -> Image.Image:
        """Run virtual try-on."""
        person_img = person_image.convert("RGB")
        garment_img = garment_image.convert("RGB")
        person_img = resize_and_crop(person_img, self.size)
        garment_img = resize_and_padding(garment_img, self.size)

        cloth_type = (
            "upper"
            if category == "upper_body"
            else "lower"
            if category == "lower_body"
            else "overall"
        )
        mask = self._automasker(person_img, cloth_type)["mask"]
        mask = self._mask_processor.blur(mask, blur_factor=9)

        result = self._pipeline(
            image=person_img,
            condition_image=garment_img,
            mask=mask,
            num_inference_steps=50,
            guidance_scale=2.5,
            height=self.size[1],
            width=self.size[0],
        )[0]

        return result
