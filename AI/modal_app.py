import modal
import os
import sys
import shutil
import io
import base64
import time
import threading

app = modal.App("nextfit-ai-tryon")

image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("git", "libgl1-mesa-glx", "libglib2.0-0", "wget")
    .pip_install(
        "torch==2.0.1",
        "torchvision==0.15.2",
        "diffusers==0.25.1",
        "transformers==4.36.2",
        "accelerate==0.25.0",
        "safetensors==0.4.1",
        "huggingface_hub==0.21.4",
        "Pillow==10.3.0",
        "numpy==1.26.4",
        "opencv-python-headless==4.9.0.80",
        "einops==0.7.0",
        "fastapi==0.111.0",
        "uvicorn==0.29.0",
        "python-multipart==0.0.22",
        "onnxruntime==1.17.1",
        "scipy==1.13.1",
    )
    .run_commands(
        "git clone https://github.com/yisol/IDM-VTON.git /app/IDM-VTON"
    )
)

volume = modal.Volume.from_name("nextfit-models", create_if_missing=True)


def _decode_b64(data: str) -> "Image.Image":
    from PIL import Image

    if "," in data:
        data = data.split(",", 1)[1]
    raw = base64.b64decode(data)
    return Image.open(io.BytesIO(raw))


def _encode_b64(img: "Image.Image") -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


@app.cls(
    image=image,
    gpu="L4",
    cpu=4.0,
    memory=16384,
    volumes={"/app/models": volume},
    scaledown_window=300,
    timeout=900,
    secrets=[modal.Secret.from_name("huggingface-secret")],
)
class TryOnService:
    def __init__(self):
        self.device = "cuda"
        self.model_loaded = False
        self.pipe = None
        self.image_encoder = None
        self.image_processor = None
        self._load_lock = threading.Lock()

    def _setup_env(self):
        os.environ["HF_HOME"] = "/app/models/cache"
        os.environ["HUGGINGFACE_HUB_CACHE"] = "/app/models/cache"
        os.environ["TRANSFORMERS_CACHE"] = "/app/models/cache"
        os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "0"

        if "/app/IDM-VTON" not in sys.path:
            sys.path.insert(0, "/app/IDM-VTON")

    def _ensure_aux_models(self, hf_token: str):
        from huggingface_hub import hf_hub_download

        os.makedirs("/app/IDM-VTON/ckpt/humanparsing", exist_ok=True)
        atr_dst = "/app/IDM-VTON/ckpt/humanparsing/parsing_atr.onnx"
        lip_dst = "/app/IDM-VTON/ckpt/humanparsing/parsing_lip.onnx"

        if not os.path.exists(atr_dst):
            print("Downloading parsing_atr.onnx ...")
            atr_path = hf_hub_download(
                repo_id="levihsu/OOTDiffusion",
                filename="checkpoints/humanparsing/parsing_atr.onnx",
                token=hf_token,
                cache_dir="/app/models/cache",
            )
            shutil.copy(atr_path, atr_dst)

        if not os.path.exists(lip_dst):
            print("Downloading parsing_lip.onnx ...")
            lip_path = hf_hub_download(
                repo_id="levihsu/OOTDiffusion",
                filename="checkpoints/humanparsing/parsing_lip.onnx",
                token=hf_token,
                cache_dir="/app/models/cache",
            )
            shutil.copy(lip_path, lip_dst)

        print("Human parsing models ready")

    def _download_main_model_snapshot(self, hf_token: str):
        from huggingface_hub import snapshot_download

        print("Ensuring IDM-VTON snapshot is fully cached...")
        snapshot_download(
            repo_id="yisol/IDM-VTON",
            cache_dir="/app/models/cache",
            token=hf_token,
            resume_download=True,
            local_dir=None,  # important: let HF manage snapshot layout
            local_dir_use_symlinks=False,
        )
        print("IDM-VTON snapshot cached")

    def _load_model(self):
        if self.model_loaded:
            return

        with self._load_lock:
            if self.model_loaded:
                return

            import torch
            from transformers import CLIPImageProcessor, CLIPVisionModelWithProjection

            self._setup_env()
            hf_token = os.environ.get("HF_TOKEN")
            MODEL_ID = "yisol/IDM-VTON"

            # Import custom IDM-VTON modules only after sys.path is ready
            from src.tryon_pipeline import StableDiffusionXLInpaintPipeline as TryonPipeline
            from src.unet_hacked_garmnet import UNet2DConditionModel as UNet2DConditionModel_ref
            from src.unet_hacked_tryon import UNet2DConditionModel

            # Make sure the repo is fully present before component loading
            self._download_main_model_snapshot(hf_token)
            self._ensure_aux_models(hf_token)

            print("Loading UNet...")
            unet = UNet2DConditionModel.from_pretrained(
                MODEL_ID,
                subfolder="unet",
                torch_dtype=torch.float16,
                token=hf_token,
                cache_dir="/app/models/cache",
                local_files_only=True,
            )

            print("Loading UNet encoder...")
            unet_encoder = UNet2DConditionModel_ref.from_pretrained(
                MODEL_ID,
                subfolder="unet_encoder",
                torch_dtype=torch.float16,
                token=hf_token,
                cache_dir="/app/models/cache",
                local_files_only=True,
            )

            print("Loading image encoder...")
            self.image_encoder = CLIPVisionModelWithProjection.from_pretrained(
                MODEL_ID,
                subfolder="image_encoder",
                torch_dtype=torch.float16,
                token=hf_token,
                cache_dir="/app/models/cache",
                local_files_only=True,
            ).to(self.device)

            # IMPORTANT:
            # IDM-VTON repo may not contain a standard preprocessor_config.json
            # So we explicitly provide a CLIP image processor from the base CLIP repo.
            print("Loading CLIP image processor...")
            self.image_processor = CLIPImageProcessor.from_pretrained(
                "openai/clip-vit-large-patch14",
                token=hf_token,
                cache_dir="/app/models/cache",
            )

            print("Loading full pipeline...")
            try:
                self.pipe = TryonPipeline.from_pretrained(
                    MODEL_ID,
                    unet=unet,
                    unet_encoder=unet_encoder,
                    image_encoder=self.image_encoder,
                    feature_extractor=self.image_processor,
                    torch_dtype=torch.float16,
                    token=hf_token,
                    cache_dir="/app/models/cache",
                    local_files_only=True,
                ).to(self.device)
            except TypeError:
                # Fallback in case this custom pipeline doesn't accept
                # image_encoder/feature_extractor kwargs explicitly.
                print("Pipeline rejected explicit image processor kwargs, retrying minimal load...")
                self.pipe = TryonPipeline.from_pretrained(
                    MODEL_ID,
                    unet=unet,
                    unet_encoder=unet_encoder,
                    torch_dtype=torch.float16,
                    token=hf_token,
                    cache_dir="/app/models/cache",
                    local_files_only=True,
                ).to(self.device)

                # Best-effort patching for custom pipeline attributes
                if hasattr(self.pipe, "image_encoder") and self.pipe.image_encoder is None:
                    self.pipe.image_encoder = self.image_encoder
                if hasattr(self.pipe, "feature_extractor") and self.pipe.feature_extractor is None:
                    self.pipe.feature_extractor = self.image_processor
                if hasattr(self.pipe, "image_processor") and self.pipe.image_processor is None:
                    self.pipe.image_processor = self.image_processor

            # Final safety patch in case pipeline loaded but left attrs empty
            if hasattr(self.pipe, "image_encoder") and self.pipe.image_encoder is None:
                self.pipe.image_encoder = self.image_encoder
            if hasattr(self.pipe, "feature_extractor") and self.pipe.feature_extractor is None:
                self.pipe.feature_extractor = self.image_processor
            if hasattr(self.pipe, "image_processor") and self.pipe.image_processor is None:
                self.pipe.image_processor = self.image_processor

            self.model_loaded = True
            print("IDM-VTON loaded successfully")

    @modal.fastapi_endpoint(method="GET")
    def health(self):
        # Lightweight health check, not full model boot
        return {
            "status": "ok",
            "service": "nextfit-ai-tryon",
            "model": "IDM-VTON",
            "gpu": "L4",
            "model_loaded": self.model_loaded,
        }

    @modal.fastapi_endpoint(method="GET")
    def warmup(self):
        start = time.time()
        self._load_model()
        return {
            "status": "loaded",
            "model_loaded": self.model_loaded,
            "warmup_time": round(time.time() - start, 2),
        }

    @modal.fastapi_endpoint(method="POST")
    def tryon(self, request: dict):
        import torch
        from torchvision import transforms
        from PIL import Image

        self._load_model()
        start = time.time()

        garment_des = request.get("garment_description", "garment")

        if "person_image" not in request:
            return {"error": "person_image is required (base64 string)"}

        if "garment_image" not in request:
            return {"error": "garment_image is required (base64 string)"}

        person_img = _decode_b64(request["person_image"]).convert("RGB").resize((768, 1024))
        garment_img = _decode_b64(request["garment_image"]).convert("RGB").resize((768, 1024))

        if not request.get("agnostic_image"):
            raise ValueError("agnostic_image is required")
        agnostic_img = _decode_b64(request["agnostic_image"]).convert("RGB").resize((768, 1024))

        if not request.get("mask_image"):
            raise ValueError("mask_image is required")
        mask_img = _decode_b64(request["mask_image"]).convert("L").resize((768, 1024))

        tensor_transform = transforms.Compose(
            [
                transforms.ToTensor(),
                transforms.Normalize([0.5], [0.5]),
            ]
        )

        negative_prompt = "monochrome, lowres, bad anatomy, worst quality, low quality"

        with torch.no_grad():
            with torch.cuda.amp.autocast():
                with torch.inference_mode():
                    (
                        prompt_embeds,
                        negative_prompt_embeds,
                        pooled_prompt_embeds,
                        negative_pooled_prompt_embeds,
                    ) = self.pipe.encode_prompt(
                        "model is wearing " + garment_des,
                        num_images_per_prompt=1,
                        do_classifier_free_guidance=True,
                        negative_prompt=negative_prompt,
                    )

                    (
                        prompt_embeds_c,
                        _,
                        _,
                        _,
                    ) = self.pipe.encode_prompt(
                        "a photo of " + garment_des,
                        num_images_per_prompt=1,
                        do_classifier_free_guidance=False,
                        negative_prompt=negative_prompt,
                    )

                pose_img = tensor_transform(person_img).unsqueeze(0).to(self.device, torch.float16)
                garm_tensor = tensor_transform(garment_img).unsqueeze(0).to(self.device, torch.float16)
                generator = torch.Generator(self.device).manual_seed(42)

                out = self.pipe(
                    prompt_embeds=prompt_embeds.to(self.device, torch.float16),
                    negative_prompt_embeds=negative_prompt_embeds.to(self.device, torch.float16),
                    pooled_prompt_embeds=pooled_prompt_embeds.to(self.device, torch.float16),
                    negative_pooled_prompt_embeds=negative_pooled_prompt_embeds.to(
                        self.device, torch.float16
                    ),
                    num_inference_steps=30,
                    generator=generator,
                    strength=1.0,
                    pose_img=pose_img,
                    text_embeds_cloth=prompt_embeds_c.to(self.device, torch.float16),
                    cloth=garm_tensor,
                    mask_image=mask_img,
                    image=agnostic_img,
                    height=1024,
                    width=768,
                    ip_adapter_image=garment_img.resize((768, 1024)),
                    guidance_scale=2.0,
                )

                # Handle both tuple/list and pipeline output objects safely
                if isinstance(out, (list, tuple)):
                    result = out[0][0]
                elif hasattr(out, "images"):
                    result = out.images[0]
                else:
                    result = out[0][0]

        return {
            "result_image": _encode_b64(result),
            "processing_time": round(time.time() - start, 2),
        }