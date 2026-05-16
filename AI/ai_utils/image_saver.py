import os
import threading
import logging

logger = logging.getLogger(__name__)

_request_counter = 0
_counter_lock = threading.Lock()

def get_request_storage():
    save_debug = os.getenv("SAVE_DEBUG_IMAGES", "false").lower() == "true"
    if not save_debug:
        return None

    global _request_counter
    with _counter_lock:
        _request_counter += 1
        req_num = _request_counter

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    save_dir = os.path.join(base_dir, "images", str(req_num))
    os.makedirs(save_dir, exist_ok=True)
    return save_dir

def save_pil_image(storage_dir, filename, pil_img):
    if not storage_dir or pil_img is None:
        return
    try:
        path = os.path.join(storage_dir, filename)
        pil_img.save(path)
    except Exception as e:
        logger.error(f"Error saving {filename}: {e}")
