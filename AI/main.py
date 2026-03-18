import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from ai_utils.image_utils import decode_base64_image, encode_image_base64, preprocess_person, preprocess_garment
from pipeline.tryon import TryOnPipeline

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="NextFit AI Try-On Service")

# CORS — flexible based on env
cors_origin = os.getenv("CORS_ORIGIN", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[cors_origin] if cors_origin != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pipeline = None


@app.on_event("startup")
async def startup():
    global pipeline

    skip = os.getenv("SKIP_MODEL_LOAD", "false").lower() == "true"
    if skip:
        logger.info("SKIP_MODEL_LOAD=true - model loading skipped (local test mode)")
        return

    logger.info("Loading CatVTON model...")
    try:
        pipeline = TryOnPipeline(
            model_id=os.getenv("MODEL_ID", "zhengchong/CatVTON"),
            cache_dir=os.getenv("MODEL_CACHE_DIR", "./models"),
        )
        logger.info("Model loaded successfully")
    except Exception as e:
        logger.error(f"Model load failed: {e}")
        raise


class TryOnRequest(BaseModel):
    person_image: str
    garment_image: str
    category: str = "upper_body"


class TryOnResponse(BaseModel):
    result_image: str
    processing_time: float


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": pipeline is not None,
        "deploy_mode": os.getenv("DEPLOY_MODE", "local"),
        "skip_model_load": os.getenv("SKIP_MODEL_LOAD", "false"),
    }


@app.post("/api/tryon", response_model=TryOnResponse)
async def tryon(request: TryOnRequest):
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    try:
        import time

        start = time.time()
        person_img = decode_base64_image(request.person_image)
        garment_img = decode_base64_image(request.garment_image)
        person_img = preprocess_person(person_img)
        garment_img = preprocess_garment(garment_img)
        result_img = pipeline.run(
            person_image=person_img,
            garment_image=garment_img,
            category=request.category,
        )
        result_b64 = encode_image_base64(result_img)
        elapsed = round(time.time() - start, 2)
        logger.info(f"Try-on completed in {elapsed}s")
        return TryOnResponse(result_image=result_b64, processing_time=elapsed)
    except Exception as e:
        logger.error(f"Try-on failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host=host, port=port)
