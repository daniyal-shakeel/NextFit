import modal
import os
import sys

app = modal.App("nextfit-ai-tryon")

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("git")
    .pip_install(
        "fastapi==0.135.1",
        "uvicorn==0.42.0",
        "python-multipart==0.0.22",
        "python-dotenv==1.0.1",
        "torch==2.10.0",
        "torchvision==0.25.0",
        "diffusers==0.37.0",
        "transformers==5.3.0",
        "huggingface-hub==1.7.1",
        "accelerate==1.6.0",
        "safetensors==0.5.3",
        "Pillow==12.1.1",
        "numpy==2.2.4",
        "opencv-python-headless==4.13.0.92",
        "scipy==1.13.1",
        "mediapipe==0.10.18",
        "controlnet-aux==0.0.9",
    )
    .run_commands(
        "git clone https://github.com/daniyal-shakeel/NextFit.git /app/NextFit"
    )
)

# Persistent volume — models download once, reused forever
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
        try:
            sys.path.insert(0, "/app/NextFit/AI")
            from pipeline.tryon import TryOnPipeline

            self.pipeline = TryOnPipeline(
                model_id="yisol/IDM-VTON",
                cache_dir="/app/models",
            )
            print("Model loaded successfully")
        except Exception as e:
            import traceback

            print(f"Model load failed: {e}")
            traceback.print_exc()
            raise

    @modal.fastapi_endpoint(method="GET")
    def health(self):
        return {
            "status": "ok",
            "model_loaded": True,
            "deploy_mode": "modal",
            "gpu": "L4"
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

