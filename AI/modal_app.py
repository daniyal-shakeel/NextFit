import modal
import sys

app = modal.App("nextfit-ai-tryon")

image = (
    modal.Image.debian_slim(python_version="3.10")
    .pip_install(
        "fastapi==0.111.0",
        "uvicorn==0.29.0",
        "python-multipart==0.0.22",
        "python-dotenv==1.0.1",
        "torch==2.1.2",
        "torchvision==0.16.2",
        "xformers==0.0.23.post1",
        "diffusers==0.27.0",
        "transformers==4.40.0",
        "accelerate==0.29.0",
        "safetensors==0.4.3",
        "Pillow==10.3.0",
        "numpy==1.26.4",
        "opencv-python-headless==4.10.0.84",
    )
)

# Persistent volume — models download once, reused forever
volume = modal.Volume.from_name("nextfit-models", create_if_missing=True)

@app.cls(
    image=image,
    gpu="T4",
    volumes={"/app/models": volume},
    mounts=[modal.Mount.from_local_dir(".", remote_path="/app/NextFit/AI")],
    scaledown_window=300,
)
class TryOnService:

    @modal.enter()
    def load_model(self):
        try:
            sys.path.insert(0, "/app/NextFit/AI")
            from pipeline.tryon import TryOnPipeline

            self.pipeline = TryOnPipeline(
                model_id="stabilityai/stable-diffusion-2-inpainting",
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

