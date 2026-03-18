import base64
from io import BytesIO
from PIL import Image

TARGET_SIZE = (768, 1024)


def decode_base64_image(b64_string: str) -> Image.Image:
    if "," in b64_string:
        b64_string = b64_string.split(",")[1]
    img_bytes = base64.b64decode(b64_string)
    return Image.open(BytesIO(img_bytes)).convert("RGB")


def encode_image_base64(image: Image.Image) -> str:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode("utf-8")


def preprocess_person(image: Image.Image) -> Image.Image:
    image = image.convert("RGB")
    image.thumbnail(TARGET_SIZE, Image.LANCZOS)
    result = Image.new("RGB", TARGET_SIZE, (255, 255, 255))
    offset = ((TARGET_SIZE[0] - image.width) // 2, (TARGET_SIZE[1] - image.height) // 2)
    result.paste(image, offset)
    return result


def preprocess_garment(image: Image.Image) -> Image.Image:
    return preprocess_person(image)
