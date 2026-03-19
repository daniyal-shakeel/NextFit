import cv2
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates  # noqa: F401


def warp_garment(
    garment_image: Image.Image,
    pose_data: dict,
    target_size: tuple = (768, 1024),
) -> Image.Image:
    """
    Warp garment to roughly align with person body proportions.
    Uses affine transform based on shoulder landmarks.
    """
    w = pose_data["image_width"]
    h = pose_data["image_height"]
    lms = pose_data["landmarks"]

    ls_x = int(lms[11]["x"] * w)
    ls_y = int(lms[11]["y"] * h)
    rs_x = int(lms[12]["x"] * w)
    rs_y = int(lms[12]["y"] * h)

    lh_y = int(lms[23]["y"] * h)

    shoulder_width = abs(rs_x - ls_x)
    torso_height = abs(lh_y - ls_y)

    garment_array = np.array(garment_image.convert("RGBA"))

    scale_x = (shoulder_width * 1.4) / garment_image.width
    scale_y = (torso_height * 1.3) / garment_image.height

    new_w = int(garment_image.width * scale_x)
    new_h = int(garment_image.height * scale_y)

    warped = cv2.resize(garment_array, (new_w, new_h))
    warped_pil = Image.fromarray(warped).convert("RGB")

    warped_pil = warped_pil.resize(target_size, Image.LANCZOS)

    return warped_pil
