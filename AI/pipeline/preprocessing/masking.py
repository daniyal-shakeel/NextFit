import cv2
import numpy as np
import mediapipe as mp
from PIL import Image

NOSE = 0
L_EYE = 2
R_EYE = 5
L_SHOULDER = 11
R_SHOULDER = 12
L_HIP = 23
R_HIP = 24

FACE_PAD = 0.05
SILHOUETTE_THRESHOLD = 0.5
DILATE_PX = 12


def generate_cloth_mask(
    person_image: Image.Image,
    pose_data: dict,
    measurements: dict,
    category: str = "upper_body",
) -> Image.Image:
    img_arr = np.array(person_image.convert("RGB"))
    h, w = img_arr.shape[:2]
    lms = pose_data["landmarks"]

    def px(idx):
        return (int(lms[idx]["x"] * w), int(lms[idx]["y"] * h))

    mp_selfie = mp.solutions.selfie_segmentation
    with mp_selfie.SelfieSegmentation(model_selection=1) as seg:
        result = seg.process(img_arr)
    silhouette = (result.segmentation_mask > SILHOUETTE_THRESHOLD).astype(np.uint8) * 255

    dilate_k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (DILATE_PX, DILATE_PX))
    silhouette = cv2.dilate(silhouette, dilate_k, iterations=1)

    mask = np.zeros((h, w), dtype=np.uint8)

    if category == "upper_body":
        ls = px(L_SHOULDER)
        rs = px(R_SHOULDER)
        neck_lift = int(h * 0.10)
        neck_mid_y = min(ls[1], rs[1]) - neck_lift
        top_y = max(0, neck_mid_y)
        bottom_y = min(h, max(px(L_HIP)[1], px(R_HIP)[1]) + int(h * 0.05))

        region = np.zeros((h, w), dtype=np.uint8)
        region[top_y:bottom_y, :] = 255

        mask = cv2.bitwise_and(silhouette, region)

        close_k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (35, 35))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, close_k)

        open_k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, open_k)

        mask = cv2.GaussianBlur(mask, (21, 21), 0)
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
        top_y = min(px(L_HIP)[1], px(R_HIP)[1])
        region = np.zeros((h, w), dtype=np.uint8)
        region[top_y:, :] = 255
        mask = cv2.bitwise_and(silhouette, region)

    mask_image = Image.fromarray(mask).convert("RGB")
    return mask_image


def generate_agnostic_image(
    person_image: Image.Image,
    cloth_mask: Image.Image,
) -> Image.Image:
    """Fill masked region with grey (128,128,128), keep rest of person."""
    person_arr = np.array(person_image.convert("RGB"))
    mask_arr = np.array(cloth_mask.convert("L"))
    person_arr[mask_arr > 127] = 128
    return Image.fromarray(person_arr)
