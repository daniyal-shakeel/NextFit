import cv2
import numpy as np
from PIL import Image

NOSE = 0
L_EYE = 2
R_EYE = 5
L_SHOULDER = 11
R_SHOULDER = 12
L_ELBOW = 13
R_ELBOW = 14
L_WRIST = 15
R_WRIST = 16
L_HIP = 23
R_HIP = 24

FACE_PAD = 0.05
TORSO_SCALE = 1.20


def generate_cloth_mask(
    person_image: Image.Image,
    pose_data: dict,
    measurements: dict,
    category: str = "upper_body",
) -> Image.Image:
    w = pose_data["image_width"]
    h = pose_data["image_height"]
    lms = pose_data["landmarks"]

    def px(idx):
        return (int(lms[idx]["x"] * w), int(lms[idx]["y"] * h))

    mask = np.zeros((h, w), dtype=np.uint8)

    if category == "upper_body":
        ls = px(L_SHOULDER)
        rs = px(R_SHOULDER)
        lh = px(L_HIP)
        rh = px(R_HIP)
        le = px(L_ELBOW)
        re = px(R_ELBOW)
        lw = px(L_WRIST)
        rw = px(R_WRIST)

        arm_w = max(int(measurements["arm_width"] / 2), 4)
        torso_half = int(measurements["shoulder_width"] * TORSO_SCALE / 2)
        neck_lift = int(measurements["shoulder_width"] * 0.15)
        pad_y = int(h * 0.02)

        neck_mid_y = min(ls[1], rs[1]) - neck_lift
        cx = int(measurements["chest_center_x"])

        body_poly = np.array([
            [cx - torso_half, neck_mid_y],
            [ls[0] - arm_w, ls[1]],
            [le[0] - arm_w, le[1]],
            [lw[0] - arm_w, lw[1]],
            [lw[0] + arm_w, lw[1]],
            [le[0] + arm_w, le[1]],
            [ls[0] + arm_w, ls[1]],
            [lh[0] - int(w * 0.02), lh[1] + pad_y],
            [rh[0] + int(w * 0.02), rh[1] + pad_y],
            [rs[0] - arm_w, rs[1]],
            [re[0] - arm_w, re[1]],
            [rw[0] - arm_w, rw[1]],
            [rw[0] + arm_w, rw[1]],
            [re[0] + arm_w, re[1]],
            [rs[0] + arm_w, rs[1]],
            [cx + torso_half, neck_mid_y],
        ], dtype=np.int32)
        cv2.fillPoly(mask, [body_poly], 255)

        close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, close_kernel)

        mask = cv2.GaussianBlur(mask, (51, 51), 0)
        _, mask = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)

        nose = px(NOSE)
        leye = px(L_EYE)
        reye = px(R_EYE)
        eye_dist = abs(reye[0] - leye[0])
        face_cx = (leye[0] + reye[0]) // 2
        face_cy = (leye[1] + reye[1]) // 2
        face_r = int(eye_dist * 1.8)
        face_bottom = nose[1] + int(h * FACE_PAD)
        face_top = face_cy - face_r

        face_protect = np.zeros_like(mask)
        cv2.ellipse(
            face_protect,
            (face_cx, (face_top + face_bottom) // 2),
            (face_r, (face_bottom - face_top) // 2),
            0, 0, 360, 255, -1,
        )
        face_protect = cv2.GaussianBlur(face_protect, (31, 31), 0)
        mask = np.where(face_protect > 127, 0, mask).astype(np.uint8)

    elif category == "lower_body":
        lh = px(L_HIP)
        rh = px(R_HIP)
        pad_x = int(w * 0.08)

        points = np.array([
            [lh[0] - pad_x, lh[1]],
            [rh[0] + pad_x, rh[1]],
            [rh[0] + pad_x, h],
            [lh[0] - pad_x, h],
        ], dtype=np.int32)
        cv2.fillPoly(mask, [points], 255)

    mask_image = Image.fromarray(mask).convert("RGB")
    return mask_image
