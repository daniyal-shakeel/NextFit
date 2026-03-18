import modal
import sys

app = modal.App("nextfit-ai-tryon")

# Image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install(
        "git",
        "libgl1-mesa-glx",
        "libglib2.0-0",
        "libsm6",
        "libxext6",
        "libxrender-dev"
    )
    .pip_install(
        # Server
        "fastapi==0.111.0",
        "uvicorn==0.29.0",
        "python-multipart==0.0.22",
        "python-dotenv==1.0.1",
        # PyTorch
        "torch==2.1.2",
        "torchvision==0.16.2",
        "xformers==0.0.23.post1",
        # HuggingFace stack — all compatible together
        "huggingface-hub==0.23.4",
        "diffusers==0.27.0",
        "transformers==4.40.0",
        "accelerate==0.29.0",
        "tokenizers==0.19.1",
        "safetensors==0.4.3",
        "peft==0.10.0",
        # CatVTON deps
        "Pillow==10.3.0",
        "PyYAML==6.0.1",
        "numpy==1.26.4",
        "opencv-python-headless==4.10.0.84",
        "scipy==1.13.1",
        "scikit-image==0.24.0",
        "matplotlib==3.9.1",
        "tqdm==4.66.4",
        "fvcore==0.1.5.post20221221",
        "cloudpickle==3.0.0",
        "omegaconf==2.3.0",
        "pycocotools==2.0.8",
        "av==12.3.0",
        "setuptools==70.0.0",
    )
    .run_commands(
        "git clone --recurse-submodules https://github.com/daniyal-shakeel/NextFit.git /app/NextFit"
    )
)

# Persistent volume — models download once, reused forever
volume = modal.Volume.from_name("nextfit-models", create_if_missing=True)

@app.cls(
    image=image,
    gpu="T4",
    volumes={"/app/models": volume},
    scaledown_window=300,
)
class TryOnService:

    @modal.enter()
    def load_model(self):
        sys.path.insert(0, "/app/NextFit/AI")
        from pipeline.tryon import TryOnPipeline
        self.pipeline = TryOnPipeline(
            model_id="zhengchong/CatVTON",
            cache_dir="/app/models"
        )

    @modal.fastapi_endpoint(method="GET")
    def health(self):
        return {
            "status": "ok",
            "model_loaded": True,
            "deploy_mode": "modal",
            "gpu": "T4"
        }

    @modal.fastapi_endpoint(method="POST")
    def tryon(self, request: dict):
        import time
        sys.path.insert(0, "/app/NextFit/AI")
        from utils.image_utils import (
            decode_base64_image,
            encode_image_base64,
            preprocess_person,
            preprocess_garment
        )
        start = time.time()
        person_img  = decode_base64_image(request["person_image"])
        garment_img = decode_base64_image(request["garment_image"])
        person_img  = preprocess_person(person_img)
        garment_img = preprocess_garment(garment_img)
        result = self.pipeline.run(
            person_image=person_img,
            garment_image=garment_img,
            category=request.get("category", "upper_body")
        )
        return {
            "result_image": encode_image_base64(result),
            "processing_time": round(time.time() - start, 2)
        }

