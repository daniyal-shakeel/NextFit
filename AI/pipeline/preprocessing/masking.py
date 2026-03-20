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

ARM_THICKNESS = 0.07
FACE_PAD = 0.05
BODY_PAD_X = 0.08


def _arm_strip(p0, p1, thickness):
    """Build a quad strip along the arm segment with given thickness."""
    dx = p1[0] - p0[0]
    dy = p1[1] - p0[1]
    length = max(np.hypot(dx, dy), 1)
    nx, ny = -dy / length * thickness, dx / length * thickness
    return np.array([
        [p0[0] + nx, p0[1] + ny],
        [p0[0] - nx, p0[1] - ny],
        [p1[0] - nx, p1[1] - ny],
        [p1[0] + nx, p1[1] + ny],
    ], dtype=np.int32)


def generate_cloth_mask(
    person_image: Image.Image,
    pose_data: dict,
    category: str = "upper_body",
) -> Image.Image:
    w = pose_data["image_width"]
    h = pose_data["image_height"]
    lms = pose_data["landmarks"]

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
        lw = px(L_WRIST)
        rw = px(R_WRIST)

        pad_x = int(w * BODY_PAD_X)
        pad_y = int(h * 0.02)
        neck_lift = int(h * 0.04)
        arm_w = int(w * ARM_THICKNESS)

        neck_mid_y = min(ls[1], rs[1]) - neck_lift

        # Single connected polygon: left wrist → left arm → torso → right arm → right wrist → hips
        body_poly = np.array([
            # Left arm (outer edge going down)
            [ls[0] - pad_x, neck_mid_y],
            [ls[0] - pad_x, ls[1]],
            [le[0] - arm_w, le[1]],
            [lw[0] - arm_w, lw[1]],
            # Left wrist bottom
            [lw[0] + arm_w, lw[1]],
            # Left arm (inner edge going up)
            [le[0] + arm_w, le[1]],
            [ls[0] + pad_x // 2, ls[1]],
            # Left hip
            [lh[0] - pad_x, lh[1] + pad_y],
            # Right hip
            [rh[0] + pad_x, rh[1] + pad_y],
            # Right shoulder inner
            [rs[0] - pad_x // 2, rs[1]],
            # Right arm (inner edge going down)
            [re[0] - arm_w, re[1]],
            [rw[0] - arm_w, rw[1]],
            # Right wrist bottom
            [rw[0] + arm_w, rw[1]],
            # Right arm (outer edge going up)
            [re[0] + arm_w, re[1]],
            [rs[0] + pad_x, rs[1]],
            [rs[0] + pad_x, neck_mid_y],
        ], dtype=np.int32)
        cv2.fillPoly(mask, [body_poly], 255)

        # Fill any internal holes
        close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, close_kernel)

        mask = cv2.GaussianBlur(mask, (51, 51), 0)
        _, mask = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)

        # Face protection: carve out face region so it's never inpainted
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
