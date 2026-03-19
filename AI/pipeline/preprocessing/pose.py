import mediapipe as mp
import numpy as np
from PIL import Image


def extract_pose(person_image: Image.Image) -> dict:
    """
    Extract 33 pose landmarks from person image.
    Returns dict with landmarks and annotated image.
    """
    mp_pose = mp.solutions.pose

    img_array = np.array(person_image.convert("RGB"))

    with mp_pose.Pose(
        static_image_mode=True,
        model_complexity=2,
        min_detection_confidence=0.5,
    ) as pose:
        results = pose.process(img_array)

    if not results.pose_landmarks:
        raise ValueError("No person detected in image")

    landmarks = []
    for lm in results.pose_landmarks.landmark:
        landmarks.append({
            "x": lm.x,
            "y": lm.y,
            "z": lm.z,
            "visibility": lm.visibility,
        })

    return {
        "landmarks": landmarks,
        "image_width": person_image.width,
        "image_height": person_image.height,
    }
