import cv2
import numpy as np
from PIL import Image

L_SHOULDER = 11
R_SHOULDER = 12
L_HIP = 23

SCALE_W = 1.5
SCALE_H = 1.3
OFFSET_X = 0.10
OFFSET_Y = 0.05

CORNER_SAMPLE = 10
DARK_THRESH = 40
LIGHT_THRESH = 215
ERODE_PX = 2


def _remove_bg(rgba_arr: np.ndarray) -> np.ndarray:
    """Zero-out alpha for background pixels (dark or light)."""
    rgb = rgba_arr[:, :, :3].astype(np.float32)
    h, w = rgb.shape[:2]
    s = CORNER_SAMPLE
    corners = np.concatenate([
        rgb[:s, :s].reshape(-1, 3),
        rgb[:s, w - s:].reshape(-1, 3),
        rgb[h - s:, :s].reshape(-1, 3),
        rgb[h - s:, w - s:].reshape(-1, 3),
    ])
    avg = corners.mean(axis=0)
    brightness = avg.mean()

    alpha = rgba_arr[:, :, 3].copy()

    if brightness < 30:
        dark = (rgba_arr[:, :, 0] < DARK_THRESH) & \
               (rgba_arr[:, :, 1] < DARK_THRESH) & \
               (rgba_arr[:, :, 2] < DARK_THRESH)
        alpha[dark] = 0
    elif brightness > 220:
        light = (rgba_arr[:, :, 0] > LIGHT_THRESH) & \
                (rgba_arr[:, :, 1] > LIGHT_THRESH) & \
                (rgba_arr[:, :, 2] > LIGHT_THRESH)
        alpha[light] = 0

    kernel = np.ones((ERODE_PX * 2 + 1, ERODE_PX * 2 + 1), np.uint8)
    alpha = cv2.erode(alpha, kernel, iterations=1)

    rgba_arr[:, :, 3] = alpha
    return rgba_arr


def warp_garment(
    garment_image: Image.Image,
    pose_data: dict,
    target_size: tuple = (768, 1024),
) -> Image.Image:
    w = pose_data["image_width"]
    h = pose_data["image_height"]
    lms = pose_data["landmarks"]

    ls_x = lms[L_SHOULDER]["x"] * w
    ls_y = lms[L_SHOULDER]["y"] * h
    rs_x = lms[R_SHOULDER]["x"] * w
    rs_y = lms[R_SHOULDER]["y"] * h
    lh_y = lms[L_HIP]["y"] * h

    shoulder_w = abs(rs_x - ls_x)
    torso_h = abs(lh_y - min(ls_y, rs_y))

    gw = max(int(shoulder_w * SCALE_W), 1)
    gh = max(int(torso_h * SCALE_H), 1)

    garment_resized = garment_image.convert("RGBA").resize((gw, gh), Image.LANCZOS)

    arr = np.array(garment_resized)
    arr = _remove_bg(arr)
    garment_clean = Image.fromarray(arr, "RGBA")

    paste_x = int(min(ls_x, rs_x) - gw * OFFSET_X)
    paste_y = int(min(ls_y, rs_y) - gh * OFFSET_Y)

    tw, th = target_size
    canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    canvas.paste(garment_clean, (paste_x, paste_y))

    return canvas
