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

    # Destination corners on the person: TL, TR, BR, BL
    dst = np.array([
        [ls[0] - pad_x, min(ls[1], rs[1]) - pad_y_top],
        [rs[0] + pad_x, min(ls[1], rs[1]) - pad_y_top],
        [rh[0] + pad_x, max(lh[1], rh[1]) + pad_y_bot],
        [lh[0] - pad_x, max(lh[1], rh[1]) + pad_y_bot],
    ], dtype=np.float32)

    gw, gh = garment_image.size
    src = np.array([
        [0, 0],
        [gw, 0],
        [gw, gh],
        [0, gh],
    ], dtype=np.float32)

    M = cv2.getPerspectiveTransform(src, dst)

    garment_arr = np.array(garment_image.convert("RGB"))
    tw, th = target_size
    warped = cv2.warpPerspective(garment_arr, M, (tw, th), borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0))

    return Image.fromarray(warped).convert("RGB")
