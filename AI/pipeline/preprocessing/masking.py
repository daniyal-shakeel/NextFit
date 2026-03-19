import cv2
import numpy as np
from PIL import Image


def generate_cloth_mask(
    person_image: Image.Image,
    pose_data: dict,
    category: str = "upper_body",
) -> Image.Image:
    """
    Generate precise cloth mask using pose landmarks.
    Much better than rectangular mask.
    """
    w = pose_data["image_width"]
    h = pose_data["image_height"]
    lms = pose_data["landmarks"]

    L_SHOULDER = 11
    R_SHOULDER = 12
    L_HIP = 23
    R_HIP = 24
    L_ELBOW = 13
    R_ELBOW = 14

    def px(idx):
        return (
            int(lms[idx]["x"] * w),
            int(lms[idx]["y"] * h),
        )

    mask = np.zeros((h, w), dtype=np.uint8)

    if category == "upper_body":
        ls = px(L_SHOULDER)
        rs = px(R_SHOULDER)
        lh = px(L_HIP)
        rh = px(R_HIP)
        le = px(L_ELBOW)
        re = px(R_ELBOW)

        padding_x = int(w * 0.04)
        padding_y = int(h * 0.02)

        points = np.array([
            [ls[0] - padding_x, ls[1] - padding_y],
            [rs[0] + padding_x, rs[1] - padding_y],
            [re[0] + padding_x, re[1]],
            [rh[0] + padding_x, rh[1] + padding_y],
            [lh[0] - padding_x, lh[1] + padding_y],
            [le[0] - padding_x, le[1]],
        ], dtype=np.int32)

        cv2.fillPoly(mask, [points], 255)

        mask = cv2.GaussianBlur(mask, (21, 21), 0)
        _, mask = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)

    elif category == "lower_body":
        lh = px(L_HIP)
        rh = px(R_HIP)
        padding_x = int(w * 0.04)

        points = np.array([
            [lh[0] - padding_x, lh[1]],
            [rh[0] + padding_x, rh[1]],
            [rh[0] + padding_x, h],
            [lh[0] - padding_x, h],
        ], dtype=np.int32)

        cv2.fillPoly(mask, [points], 255)

    mask_image = Image.fromarray(mask).convert("RGB")
    return mask_image
