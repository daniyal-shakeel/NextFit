import cv2
import numpy as np
from PIL import Image


def parse_human(person_image: Image.Image) -> dict:
    """
    Basic human parsing using GrabCut + pose landmarks.
    Separates person from background.
    Returns segmentation masks.
    """
    img_array = np.array(person_image.convert("RGB"))
    h, w = img_array.shape[:2]

    mask = np.zeros((h, w), np.uint8)
    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)

    rect = (
        int(w * 0.1),
        int(h * 0.05),
        int(w * 0.8),
        int(h * 0.9),
    )

    cv2.grabCut(
        img_array, mask, rect,
        bgd_model, fgd_model,
        5, cv2.GC_INIT_WITH_RECT,
    )

    person_mask = np.where(
        (mask == 2) | (mask == 0), 0, 1
    ).astype("uint8")

    person_only = img_array * person_mask[:, :, np.newaxis]

    return {
        "person_mask": person_mask,
        "person_only": Image.fromarray(person_only),
        "original": person_image,
    }
