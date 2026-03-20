import cv2
import numpy as np
from PIL import Image

L_SHOULDER = 11
R_SHOULDER = 12
L_HIP = 23
R_HIP = 24

PAD_X_RATIO = 0.12
PAD_Y_TOP = 0.03
PAD_Y_BOT = 0.05

BG_THRESH = 40
BG_SAMPLE = 10


def _remove_background(img_arr: np.ndarray) -> np.ndarray:
    """Return RGBA array with background pixels made transparent."""
    h, w = img_arr.shape[:2]
    corners = np.concatenate([
        img_arr[:BG_SAMPLE, :BG_SAMPLE].reshape(-1, 3),
        img_arr[:BG_SAMPLE, w - BG_SAMPLE:].reshape(-1, 3),
        img_arr[h - BG_SAMPLE:, :BG_SAMPLE].reshape(-1, 3),
        img_arr[h - BG_SAMPLE:, w - BG_SAMPLE:].reshape(-1, 3),
    ])
    bg_color = np.median(corners, axis=0).astype(np.float32)

    diff = np.linalg.norm(img_arr.astype(np.float32) - bg_color, axis=2)
    alpha = np.where(diff > BG_THRESH, 255, 0).astype(np.uint8)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, kernel)
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_OPEN, kernel)
    alpha = cv2.GaussianBlur(alpha, (5, 5), 0)

    rgba = np.dstack([img_arr, alpha])
    return rgba


def warp_garment(
    garment_image: Image.Image,
    pose_data: dict,
    target_size: tuple = (768, 1024),
) -> Image.Image:
    w = pose_data["image_width"]
    h = pose_data["image_height"]
    lms = pose_data["landmarks"]

    def pt(idx):
        return (lms[idx]["x"] * w, lms[idx]["y"] * h)

    ls = pt(L_SHOULDER)
    rs = pt(R_SHOULDER)
    lh = pt(L_HIP)
    rh = pt(R_HIP)

    pad_x = abs(rs[0] - ls[0]) * PAD_X_RATIO
    pad_y_top = abs(lh[1] - ls[1]) * PAD_Y_TOP
    pad_y_bot = abs(lh[1] - ls[1]) * PAD_Y_BOT

    dst = np.array([
        [ls[0] - pad_x, min(ls[1], rs[1]) - pad_y_top],
        [rs[0] + pad_x, min(ls[1], rs[1]) - pad_y_top],
        [rh[0] + pad_x, max(lh[1], rh[1]) + pad_y_bot],
        [lh[0] - pad_x, max(lh[1], rh[1]) + pad_y_bot],
    ], dtype=np.float32)

    garment_rgb = np.array(garment_image.convert("RGB"))
    garment_rgba = _remove_background(garment_rgb)

    gw, gh = garment_image.size
    src = np.array([
        [0, 0],
        [gw, 0],
        [gw, gh],
        [0, gh],
    ], dtype=np.float32)

    M = cv2.getPerspectiveTransform(src, dst)

    tw, th = target_size
    warped = cv2.warpPerspective(
        garment_rgba, M, (tw, th),
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0),
    )

    return Image.fromarray(warped, "RGBA")
