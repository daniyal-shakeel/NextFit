from PIL import Image
from rembg import remove as rembg_remove

L_SHOULDER = 11
R_SHOULDER = 12
L_HIP = 23

SCALE_W = 1.5
SCALE_H = 1.3
OFFSET_X = 0.10
OFFSET_Y = 0.05


def warp_garment(
    garment_image: Image.Image,
    pose_data: dict,
    target_size: tuple = (768, 1024),
) -> Image.Image:
    w = pose_data["image_width"]
    h = pose_data["image_height"]
    lms = pose_data["landmarks"]

    ls_x = lms[L_SHOULDER]["x"] * w
    ls_y = lms[L_SHOULDER]["y"] * h
    rs_x = lms[R_SHOULDER]["x"] * w
    rs_y = lms[R_SHOULDER]["y"] * h
    lh_y = lms[L_HIP]["y"] * h

    shoulder_w = abs(rs_x - ls_x)
    torso_h = abs(lh_y - min(ls_y, rs_y))

    gw = max(int(shoulder_w * SCALE_W), 1)
    gh = max(int(torso_h * SCALE_H), 1)

    garment_nobg = rembg_remove(garment_image.convert("RGBA"))
    garment_resized = garment_nobg.resize((gw, gh), Image.LANCZOS)

    paste_x = int(min(ls_x, rs_x) - gw * OFFSET_X)
    paste_y = int(min(ls_y, rs_y) - gh * OFFSET_Y)

    tw, th = target_size
    canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    canvas.paste(garment_resized, (paste_x, paste_y), garment_resized)

    return canvas
