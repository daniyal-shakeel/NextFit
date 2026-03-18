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
        "fastapi==0.111.0",
        "uvicorn==0.29.0",
        "Pillow==10.3.0",
        "torch==2.1.2",
        "torchvision==0.16.2",
        "diffusers==0.25.1",
        "transformers==4.37.2",
        "accelerate==0.27.2",
        "huggingface-hub==0.21.4",
        "numpy==1.26.4",
        "opencv-python-headless==4.9.0.80",
        "python-dotenv==1.0.1",
        "xformers==0.0.23",
    )
    .run_commands(
        "git clone https://github.com/Zheng-Chong/CatVTON.git /app/CatVTON"
    )
)

# Persistent volume — models download once, reused forever
volume = modal.Volume.from_name("nextfit-models", create_if_missing=True)

@app.cls(
    image=image,
    gpu="T4",
    volumes={"/app/models": volume},
    container_idle_timeout=300,
)
class TryOnService:

    @modal.enter()
    def load_model(self):
        sys.path.insert(0, "/app")
        sys.path.insert(0, "/app/CatVTON")
        from pipeline.tryon import TryOnPipeline
        self.pipeline = TryOnPipeline(
            model_id="zhengchong/CatVTON",
            cache_dir="/app/models"
        )

    @modal.web_endpoint(method="GET")
    def health(self):
        return {
            "status": "ok",
            "model_loaded": True,
            "deploy_mode": "modal",
            "gpu": "T4"
        }

    @modal.web_endpoint(method="POST")
    def tryon(self, request: dict):
        import time
        sys.path.insert(0, "/app")
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

