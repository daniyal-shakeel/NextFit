import modal
import os
import sys
import shutil
import io
import base64
import time

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
        "git clone https://github.com/yisol/IDM-VTON.git /app/IDM-VTON",
    )
)

volume = modal.Volume.from_name("nextfit-models", create_if_missing=True)


@app.cls(
    image=image,
    gpu="L4",
    cpu=4.0,
    memory=16384,
    volumes={"/app/models": volume},
    scaledown_window=300,
    secrets=[modal.Secret.from_name("huggingface-secret")],
)
class TryOnService:

    @modal.enter()
    def load_model(self):
        import torch
        from huggingface_hub import snapshot_download, hf_hub_download
        from transformers import (
            CLIPImageProcessor,
            CLIPVisionModelWithProjection,
            CLIPTextModel,
            CLIPTextModelWithProjection,
            AutoTokenizer,
        )
        from diffusers import DDPMScheduler, AutoencoderKL

        sys.path.insert(0, "/app/IDM-VTON")
        from src.tryon_pipeline import StableDiffusionXLInpaintPipeline as TryonPipeline
        from src.unet_hacked_garmnet import UNet2DConditionModel as UNet2DConditionModel_ref
        from src.unet_hacked_tryon import UNet2DConditionModel

        hf_token = os.environ.get("HF_TOKEN")

        idm_dir = "/app/models/IDM-VTON"
        if not os.path.exists("/app/models/IDM-VTON/unet"):
            print("Downloading IDM-VTON weights...")
            snapshot_download(
                repo_id="yisol/IDM-VTON",
                local_dir=idm_dir,
                token=hf_token,
            )
            volume.commit()
            print("IDM-VTON weights downloaded")
        else:
            print("IDM-VTON weights already cached")

        os.makedirs("/app/IDM-VTON/ckpt/humanparsing", exist_ok=True)

        atr_dst = "/app/IDM-VTON/ckpt/humanparsing/parsing_atr.onnx"
        lip_dst = "/app/IDM-VTON/ckpt/humanparsing/parsing_lip.onnx"

        if not os.path.exists(atr_dst):
            print("Downloading human parsing models...")
            atr_path = hf_hub_download(
                repo_id="levihsu/OOTDiffusion",
                filename="checkpoints/humanparsing/parsing_atr.onnx",
                token=hf_token,
            )
            shutil.copy(atr_path, atr_dst)
            lip_path = hf_hub_download(
                repo_id="levihsu/OOTDiffusion",
                filename="checkpoints/humanparsing/parsing_lip.onnx",
                token=hf_token,
            )
            shutil.copy(lip_path, lip_dst)
            print("Human parsing models copied")
        else:
            print("Human parsing models already cached")

        ckpt_idm = "/app/IDM-VTON/ckpt/idm_vton"
        if not os.path.exists(ckpt_idm):
            os.symlink("/app/models/IDM-VTON", ckpt_idm)
            print("Symlinked IDM-VTON weights")
        else:
            print("Symlink already exists")

        self.device = "cuda"
        base_path = "/app/models/IDM-VTON"

        print("Loading IDM-VTON pipeline...")
        unet = UNet2DConditionModel.from_pretrained(
            base_path,
            subfolder="unet",
            torch_dtype=torch.float16,
        )
        unet.requires_grad_(False)
        tokenizer_one = AutoTokenizer.from_pretrained(
            base_path,
            subfolder="tokenizer",
            revision=None,
            use_fast=False,
        )
        tokenizer_two = AutoTokenizer.from_pretrained(
            base_path,
            subfolder="tokenizer_2",
            revision=None,
            use_fast=False,
        )
        noise_scheduler = DDPMScheduler.from_pretrained(base_path, subfolder="scheduler")
        text_encoder_one = CLIPTextModel.from_pretrained(
            base_path,
            subfolder="text_encoder",
            torch_dtype=torch.float16,
        )
        text_encoder_two = CLIPTextModelWithProjection.from_pretrained(
            base_path,
            subfolder="text_encoder_2",
            torch_dtype=torch.float16,
        )
        image_encoder = CLIPVisionModelWithProjection.from_pretrained(
            base_path,
            subfolder="image_encoder",
            torch_dtype=torch.float16,
        )
        vae = AutoencoderKL.from_pretrained(
            base_path,
            subfolder="vae",
            torch_dtype=torch.float16,
        )
        unet_encoder = UNet2DConditionModel_ref.from_pretrained(
            base_path,
            subfolder="unet_encoder",
            torch_dtype=torch.float16,
        )

        for m in (unet_encoder, image_encoder, vae, unet, text_encoder_one, text_encoder_two):
            m.requires_grad_(False)

        self.pipe = TryonPipeline.from_pretrained(
            base_path,
            unet=unet,
            vae=vae,
            feature_extractor=CLIPImageProcessor(),
            text_encoder=text_encoder_one,
            text_encoder_2=text_encoder_two,
            tokenizer=tokenizer_one,
            tokenizer_2=tokenizer_two,
            scheduler=noise_scheduler,
            image_encoder=image_encoder,
            torch_dtype=torch.float16,
        )
        self.pipe.unet_encoder = unet_encoder
        self.pipe.to(self.device)
        self.pipe.unet_encoder.to(self.device)

        self.image_processor = CLIPImageProcessor()
        print("IDM-VTON pipeline loaded successfully")

    @modal.fastapi_endpoint(method="GET")
    def health(self):
        return {"status": "ok", "model": "IDM-VTON", "gpu": "L4"}

    @modal.fastapi_endpoint(method="POST")
    def tryon(self, request: dict):
        import torch
        from torchvision import transforms
        from PIL import Image

        start = time.time()

        garment_des = request.get("garment_description", "garment")
        person_img = _decode_b64(request["person_image"]).convert("RGB").resize((768, 1024))
        garment_img = _decode_b64(request["garment_image"]).convert("RGB").resize((768, 1024))
        agnostic_img = _decode_b64(
            request.get("agnostic_image", request["person_image"])
        ).convert("RGB").resize((768, 1024))

        mask_raw = request.get("mask_image")
        if mask_raw:
            mask_img = _decode_b64(mask_raw).convert("L").resize((768, 1024))
        else:
            mask_img = Image.new("L", (768, 1024), 255)

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
                result = out[0][0]

        return {
            "result_image": _encode_b64(result),
            "processing_time": round(time.time() - start, 2),
        }


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
