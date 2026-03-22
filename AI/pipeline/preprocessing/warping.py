import numpy as np
from PIL import Image, ImageFilter
from rembg import remove as rembg_remove

BODY_ZONE_RATIO = 0.60
SLEEVE_ZONE_RATIO = 0.20
SEAM_BLUR_RADIUS = 5
DARK_THRESH = 50
LIGHT_THRESH = 210
MIN_OPAQUE_RATIO = 0.40


def _fallback_remove_bg(rgba: Image.Image) -> Image.Image:
    """Threshold-based background removal when rembg over-removes."""
    arr = np.array(rgba)
    rgb = arr[:, :, :3]
    h, w = rgb.shape[:2]
    s = min(10, h, w)
    corners = np.concatenate([
        rgb[:s, :s].reshape(-1, 3),
        rgb[:s, w - s:].reshape(-1, 3),
        rgb[h - s:, :s].reshape(-1, 3),
        rgb[h - s:, w - s:].reshape(-1, 3),
    ]).astype(np.float32)
    brightness = corners.mean()

    alpha = arr[:, :, 3].copy()
    if brightness < 80:
        bg = (rgb[:, :, 0] < DARK_THRESH) & (rgb[:, :, 1] < DARK_THRESH) & (rgb[:, :, 2] < DARK_THRESH)
        alpha[bg] = 0
    else:
        bg = (rgb[:, :, 0] > LIGHT_THRESH) & (rgb[:, :, 1] > LIGHT_THRESH) & (rgb[:, :, 2] > LIGHT_THRESH)
        alpha[bg] = 0

    arr[:, :, 3] = alpha
    return Image.fromarray(arr, "RGBA")


def _remove_background(garment: Image.Image) -> Image.Image:
    """Remove background with rembg; fall back to threshold if over-removed."""
    rgba = garment.convert("RGBA")
    result = rembg_remove(rgba)
    arr = np.array(result)
    opaque = (arr[:, :, 3] > 127).sum()
    total = arr.shape[0] * arr.shape[1]
    if opaque / total < MIN_OPAQUE_RATIO:
        return _fallback_remove_bg(garment.convert("RGBA"))
    return result


def _blur_seam(canvas_arr: np.ndarray, x: int, width: int = 10) -> np.ndarray:
    """Apply a vertical Gaussian blur strip at column x for seamless stitching."""
    h, w_img = canvas_arr.shape[:2]
    x0 = max(0, x - width // 2)
    x1 = min(w_img, x + width // 2)
    if x1 <= x0:
        return canvas_arr
    strip = Image.fromarray(canvas_arr[:, x0:x1])
    blurred = strip.filter(ImageFilter.GaussianBlur(SEAM_BLUR_RADIUS))
    canvas_arr[:, x0:x1] = np.array(blurred)
    return canvas_arr


def warp_garment(
    garment_image: Image.Image,
    pose_data: dict,
    measurements: dict,
    target_size: tuple = (768, 1024),
) -> Image.Image:
    nobg = _remove_background(garment_image)

    nobg_w, nobg_h = nobg.size
    body_x0 = int(nobg_w * SLEEVE_ZONE_RATIO)
    body_x1 = int(nobg_w * (SLEEVE_ZONE_RATIO + BODY_ZONE_RATIO))

    left_sleeve = nobg.crop((0, 0, body_x0, nobg_h))
    body_zone = nobg.crop((body_x0, 0, body_x1, nobg_h))
    right_sleeve = nobg.crop((body_x1, 0, nobg_w, nobg_h))

    sw = measurements["shoulder_width"]
    th = measurements["torso_height"]
    aw = measurements["arm_width"]
    la_len = measurements["left_arm_length"]
    ra_len = measurements["right_arm_length"]

    gw = max(int(sw * 2.5), 1)
    gh = max(int(th * 1.5), 1)
    body_resized = body_zone.resize((gw, gh), Image.LANCZOS)

    ls_w = max(int(aw), 1)
    ls_h = max(int(la_len), 1)
    ls_resized = left_sleeve.resize((ls_w, ls_h), Image.LANCZOS)

    rs_w = max(int(aw), 1)
    rs_h = max(int(ra_len), 1)
    rs_resized = right_sleeve.resize((rs_w, rs_h), Image.LANCZOS)

    ls_y = measurements["left_shoulder"][1]
    rs_y = measurements["right_shoulder"][1]
    lh_y = measurements["left_hip"][1]
    neck_y = min(ls_y, rs_y) - int((lh_y - min(ls_y, rs_y)) * 0.20)
    chest_cx = measurements["chest_center_x"]
    ls_pos = measurements["left_shoulder"]
    rs_pos = measurements["right_shoulder"]

    tw, tht = target_size
    canvas = Image.new("RGBA", (tw, tht), (0, 0, 0, 0))

    body_x = int(chest_cx - gw / 2)
    body_y = max(0, int(neck_y - gh * 0.05))
    canvas.paste(body_resized, (body_x, body_y), body_resized)

    lsl_x = int(ls_pos[0] - ls_w)
    lsl_y = int(ls_pos[1])
    canvas.paste(ls_resized, (lsl_x, lsl_y), ls_resized)

    rsl_x = int(rs_pos[0])
    rsl_y = int(rs_pos[1])
    canvas.paste(rs_resized, (rsl_x, rsl_y), rs_resized)

    arr = np.array(canvas)
    arr = _blur_seam(arr, body_x, 10)
    arr = _blur_seam(arr, body_x + gw, 10)

    return Image.fromarray(arr, "RGBA")
