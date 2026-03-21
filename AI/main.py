import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from ai_utils.image_utils import decode_base64_image, encode_image_base64, preprocess_person

from pipeline.preprocessing.pose import extract_pose
from pipeline.preprocessing.measurements import extract_measurements
from pipeline.preprocessing.masking import generate_cloth_mask, generate_agnostic_image

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Preprocessing-only mode — no model to load")
    yield


app = FastAPI(title="NextFit AI Try-On Service", lifespan=lifespan)

cors_origin = os.getenv("CORS_ORIGIN", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[cors_origin] if cors_origin != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TryOnRequest(BaseModel):
    person_image: str
    garment_image: str
    category: str = "upper_body"


class TryOnResponse(BaseModel):
    result_image: str
    preprocessed_image: str
    processing_time: float


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": False,
        "deploy_mode": os.getenv("DEPLOY_MODE", "local"),
        "mode": "preprocessing_only",
    }


def _remove_garment_bg(garment_pil):
    """Remove garment background with rembg; fallback to threshold if over-removed."""
    import numpy as np
    from PIL import Image
    from rembg import remove as rembg_remove

    rgba = garment_pil.convert("RGBA")
    result = rembg_remove(rgba)
    arr = np.array(result)
    opaque = (arr[:, :, 3] > 127).sum()
    total = arr.shape[0] * arr.shape[1]

    if opaque / total >= 0.40:
        return result

    arr = np.array(rgba)
    rgb = arr[:, :, :3].astype(np.float32)
    h, w = rgb.shape[:2]
    s = min(10, h, w)
    corners = np.concatenate([
        rgb[:s, :s].reshape(-1, 3),
        rgb[:s, w - s:].reshape(-1, 3),
        rgb[h - s:, :s].reshape(-1, 3),
        rgb[h - s:, w - s:].reshape(-1, 3),
    ])
    brightness = corners.mean()
    alpha = arr[:, :, 3].copy()
    if brightness < 60:
        bg = (arr[:, :, 0] < 50) & (arr[:, :, 1] < 50) & (arr[:, :, 2] < 50)
        alpha[bg] = 0
    elif brightness > 200:
        bg = (arr[:, :, 0] > 210) & (arr[:, :, 1] > 210) & (arr[:, :, 2] > 210)
        alpha[bg] = 0
    arr[:, :, 3] = alpha
    return Image.fromarray(arr, "RGBA")


def _preprocess_garment(garment_pil, measurements, person_size):
    """Remove bg, resize to body measurements, position on canvas."""
    from PIL import Image

    logger.info("Garment preprocessing: removing background...")
    nobg = _remove_garment_bg(garment_pil)

    sw = measurements["shoulder_width"]
    th = measurements["torso_height"]
    cx = measurements["chest_center_x"]
    ny = measurements["neck_y"]

    gw = max(int(sw * 2.2), 1)
    gh = max(int(th * 1.6), 1)
    logger.info(f"Garment preprocessing: resizing to {gw}x{gh}...")
    garment_resized = nobg.resize((gw, gh), Image.LANCZOS)

    canvas = Image.new("RGBA", person_size, (0, 0, 0, 0))
    paste_x = int(cx - gw / 2)
    paste_y = int(ny)
    canvas.paste(garment_resized, (paste_x, paste_y), garment_resized)
    logger.info(f"Garment preprocessing: positioned at ({paste_x}, {paste_y})")

    return canvas.convert("RGB")


def _post_process(img):
    from PIL import ImageFilter, ImageEnhance
    sharpened = img.filter(ImageFilter.UnsharpMask(radius=1.5, percent=130, threshold=3))
    return ImageEnhance.Contrast(sharpened).enhance(1.08)


@app.post("/api/tryon")
async def tryon(request: TryOnRequest):
    import time

    start = time.time()
    modal_url = os.getenv("MODAL_AI_URL")

    try:
        person_img = decode_base64_image(request.person_image)
        person_img = preprocess_person(person_img).convert("RGB")

        logger.info("Local preprocessing: extracting pose...")
        pose_data = extract_pose(person_img)

        logger.info("Local preprocessing: extracting measurements...")
        measurements = extract_measurements(pose_data)

        logger.info(f"Local preprocessing: generating cloth mask (category={request.category})...")
        cloth_mask = generate_cloth_mask(person_img, pose_data, measurements, request.category)

        logger.info("Local preprocessing: generating agnostic image...")
        agnostic = generate_agnostic_image(person_img, cloth_mask)

        logger.info("Garment preprocessing: starting...")
        garment_pil = decode_base64_image(request.garment_image)
        garment_positioned = _preprocess_garment(garment_pil, measurements, person_img.size)

        from PIL import Image
        MODAL_SIZE = (768, 1024)
        person_resized = person_img.resize(MODAL_SIZE, Image.LANCZOS)
        agnostic = agnostic.resize(MODAL_SIZE, Image.LANCZOS)
        garment_positioned = garment_positioned.resize(MODAL_SIZE, Image.LANCZOS)
        logger.info(f"Resized person, agnostic, and garment to {MODAL_SIZE} for Modal")

        person_b64 = encode_image_base64(person_resized)

        agnostic_b64 = encode_image_base64(agnostic)
        garment_b64 = encode_image_base64(garment_positioned)
    except Exception as e:
        logger.error(f"Local preprocessing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    if not modal_url:
        elapsed = round(time.time() - start, 2)
        logger.info(f"Local-only mode completed in {elapsed}s")
        return {
            "preprocessed_image": agnostic_b64,
            "raw_model_image": agnostic_b64,
            "result_image": agnostic_b64,
            "processing_time": elapsed,
        }

    import requests as req_lib
    target = modal_url.rstrip("/")
    logger.info(f"Forwarding preprocessed images to Modal: {target}")
    try:
        resp = req_lib.post(
            target,
            json={
                "person_image": person_b64,
                "garment_image": garment_b64,
                "agnostic_image": agnostic_b64,
                "category": request.category,
            },
            timeout=300,
        )
        resp.raise_for_status()
        modal_data = resp.json()
    except req_lib.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Modal request timed out")
    except req_lib.exceptions.RequestException as e:
        logger.error(f"Modal forwarding failed: {e}")
        raise HTTPException(status_code=502, detail=str(e))

    raw_model_b64 = modal_data.get("result_image", agnostic_b64)

    logger.info("Local post-processing: sharpening + contrast...")
    try:
        raw_model_img = decode_base64_image(raw_model_b64)
        final_img = _post_process(raw_model_img)
        final_b64 = encode_image_base64(final_img)
    except Exception:
        final_b64 = raw_model_b64

    elapsed = round(time.time() - start, 2)
    logger.info(f"Full pipeline completed in {elapsed}s")
    return {
        "preprocessed_image": agnostic_b64,
        "raw_model_image": raw_model_b64,
        "result_image": final_b64,
        "processing_time": elapsed,
    }


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host=host, port=port)
