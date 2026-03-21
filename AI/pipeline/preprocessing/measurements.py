import math

L_SHOULDER = 11
R_SHOULDER = 12
L_ELBOW = 13
R_ELBOW = 14
L_WRIST = 15
R_WRIST = 16
L_HIP = 23
R_HIP = 24


def _dist(p0: tuple, p1: tuple) -> float:
    return math.hypot(p1[0] - p0[0], p1[1] - p0[1])


def extract_measurements(pose_data: dict) -> dict:
    """Derive body measurements (in pixels and normalised ratios) from pose."""
    w = pose_data["image_width"]
    h = pose_data["image_height"]
    lms = pose_data["landmarks"]

    def px(idx):
        return (lms[idx]["x"] * w, lms[idx]["y"] * h)

    ls = px(L_SHOULDER)
    rs = px(R_SHOULDER)
    le = px(L_ELBOW)
    re = px(R_ELBOW)
    lw = px(L_WRIST)
    rw = px(R_WRIST)
    lh = px(L_HIP)
    rh = px(R_HIP)

    shoulder_width = _dist(ls, rs)
    shoulder_mid_y = (ls[1] + rs[1]) / 2
    hip_mid_y = (lh[1] + rh[1]) / 2
    torso_height = abs(hip_mid_y - shoulder_mid_y)

    left_arm_length = _dist(ls, le) + _dist(le, lw)
    right_arm_length = _dist(rs, re) + _dist(re, rw)
    arm_width = shoulder_width * 0.18

    chest_cx = (ls[0] + rs[0]) / 2
    chest_cy = (shoulder_mid_y + hip_mid_y) / 2
    neck_y = shoulder_mid_y - shoulder_width * 0.15

    return {
        "shoulder_width": shoulder_width,
        "torso_height": torso_height,
        "left_arm_length": left_arm_length,
        "right_arm_length": right_arm_length,
        "arm_width": arm_width,
        "chest_center_x": chest_cx,
        "chest_center_y": chest_cy,
        "neck_y": neck_y,
        "left_shoulder": ls,
        "right_shoulder": rs,
        "left_elbow": le,
        "right_elbow": re,
        "left_wrist": lw,
        "right_wrist": rw,
        "left_hip": lh,
        "right_hip": rh,
        "shoulder_mid_y": shoulder_mid_y,
        "hip_mid_y": hip_mid_y,
        # normalised ratios
        "shoulder_width_ratio": shoulder_width / w,
        "torso_height_ratio": torso_height / h,
        "left_arm_ratio": left_arm_length / h,
        "right_arm_ratio": right_arm_length / h,
        "image_width": w,
        "image_height": h,
    }
