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
        "basicsr",
        "gradio==4.7.1",
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
        from huggingface_hub import snapshot_download, hf_hub_download

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

        print("Loading IDM-VTON pipeline...")
        sys.path.insert(0, "/app/IDM-VTON")
        from gradio_demo.app import build_model

        self.pipe, self.pipe_seg = build_model()
        print("IDM-VTON pipeline loaded successfully")

    @modal.fastapi_endpoint(method="GET")
    def health(self):
        return {"status": "ok", "model": "IDM-VTON", "gpu": "L4"}

    @modal.fastapi_endpoint(method="POST")
    def tryon(self, request: dict):
        from PIL import Image

        start = time.time()

        person_img = _decode_b64(request["person_image"])
        garment_img = _decode_b64(request["garment_image"])
        agnostic_img = _decode_b64(request.get("agnostic_image", request["person_image"]))

        TARGET = (768, 1024)
        person_img = person_img.resize(TARGET, Image.LANCZOS)
        garment_img = garment_img.resize(TARGET, Image.LANCZOS)
        agnostic_img = agnostic_img.resize(TARGET, Image.LANCZOS)

        sys.path.insert(0, "/app/IDM-VTON")

        result = self.pipe(
            person_img,
            garment_img,
            agnostic_img,
            num_inference_steps=30,
            guidance_scale=2.0,
            height=1024,
            width=768,
        ).images[0]

        return {
            "result_image": _encode_b64(result),
            "processing_time": round(time.time() - start, 2),
        }


def _decode_b64(data: str) -> "Image.Image":
    from PIL import Image

    if "," in data:
        data = data.split(",", 1)[1]
    raw = base64.b64decode(data)
    return Image.open(io.BytesIO(raw)).convert("RGB")


def _encode_b64(img: "Image.Image") -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")
