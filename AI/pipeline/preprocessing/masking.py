import cv2
import numpy as np
from PIL import Image

L_SHOULDER = 11
R_SHOULDER = 12
L_ELBOW = 13
R_ELBOW = 14
L_WRIST = 15
R_WRIST = 16
L_HIP = 23
R_HIP = 24

ARM_THICKNESS = 0.05


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

        pad_x = int(w * 0.10)
        pad_y = int(h * 0.02)
        neck_lift = int(h * 0.10)
        arm_w = int(w * ARM_THICKNESS)

        neck_mid_y = min(ls[1], rs[1]) - neck_lift

        # Torso polygon: neck → shoulders → hips
        torso = np.array([
            [ls[0] - pad_x, neck_mid_y],
            [rs[0] + pad_x, neck_mid_y],
            [rs[0] + pad_x, rs[1] - pad_y],
            [rh[0] + pad_x, rh[1] + pad_y],
            [lh[0] - pad_x, lh[1] + pad_y],
            [ls[0] - pad_x, ls[1] - pad_y],
        ], dtype=np.int32)
        cv2.fillPoly(mask, [torso], 255)

        # Left arm: shoulder → elbow → wrist (thick strip)
        for seg_start, seg_end in [(ls, le), (le, lw)]:
            dx = seg_end[0] - seg_start[0]
            dy = seg_end[1] - seg_start[1]
            length = max(np.hypot(dx, dy), 1)
            nx, ny = -dy / length * arm_w, dx / length * arm_w
            strip = np.array([
                [seg_start[0] + nx, seg_start[1] + ny],
                [seg_start[0] - nx, seg_start[1] - ny],
                [seg_end[0] - nx, seg_end[1] - ny],
                [seg_end[0] + nx, seg_end[1] + ny],
            ], dtype=np.int32)
            cv2.fillPoly(mask, [strip], 255)

        # Right arm: shoulder → elbow → wrist (thick strip)
        for seg_start, seg_end in [(rs, re), (re, rw)]:
            dx = seg_end[0] - seg_start[0]
            dy = seg_end[1] - seg_start[1]
            length = max(np.hypot(dx, dy), 1)
            nx, ny = -dy / length * arm_w, dx / length * arm_w
            strip = np.array([
                [seg_start[0] + nx, seg_start[1] + ny],
                [seg_start[0] - nx, seg_start[1] - ny],
                [seg_end[0] - nx, seg_end[1] - ny],
                [seg_end[0] + nx, seg_end[1] + ny],
            ], dtype=np.int32)
            cv2.fillPoly(mask, [strip], 255)

        mask = cv2.GaussianBlur(mask, (51, 51), 0)
        _, mask = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)

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
