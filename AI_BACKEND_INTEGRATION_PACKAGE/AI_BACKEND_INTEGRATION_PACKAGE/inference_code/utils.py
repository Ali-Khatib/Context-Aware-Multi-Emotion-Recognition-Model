import os
import re
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

VALID_EXTENSIONS = (
    ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".jfif"
)

def ensure_dir(path):
    Path(path).mkdir(parents=True, exist_ok=True)

def load_image(image_path):
    """
    Load image with PIL, convert to OpenCV BGR.
    """
    try:
        img = Image.open(image_path).convert("RGB")
        img = np.array(img)
        img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
        return img
    except Exception as e:
        print(f"[ERROR] Could not load image: {image_path}")
        print(f"Reason: {e}")
        return None

def list_images_in_folder(folder_path):
    files = []
    folder_path = Path(folder_path)

    if not folder_path.exists():
        return files

    for fname in os.listdir(folder_path):
        full_path = folder_path / fname
        if full_path.is_dir():
            continue
        if fname.lower().endswith(VALID_EXTENSIONS):
            files.append(str(full_path))

    files.sort()
    return files

def get_image_id(image_path):
    """
    Example:
    angry/6.jpg -> angry__6_jpg
    """
    image_path = Path(image_path)
    folder_name = image_path.parent.name
    base = image_path.name
    name, ext = os.path.splitext(base)

    safe_folder = re.sub(r"[^a-zA-Z0-9_-]+", "_", folder_name).strip("_")
    safe_name = re.sub(r"[^a-zA-Z0-9_-]+", "_", name).strip("_")
    safe_ext = ext.replace(".", "").lower()

    return f"{safe_folder}__{safe_name}_{safe_ext}"

def save_json(path, data):
    path = Path(path)
    ensure_dir(path.parent)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def draw_detection_boxes(img, faces, color=(0, 255, 0)):
    """
    Detection-only visualization.
    """
    out = img.copy()
    for i, face in enumerate(faces):
        x, y, w, h = face["bbox"]
        score = face.get("det_score", 0.0)

        cv2.rectangle(out, (x, y), (x + w, y + h), color, 2)
        cv2.putText(
            out,
            f"Face {i} {score:.2f}",
            (x, max(20, y - 8)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            color,
            2,
        )
    return out

def draw_prediction_boxes(img, faces, color=(0, 0, 255)):
    """
    Final visualization with face_id + emotion + confidence.
    """
    out = img.copy()
    for face in faces:
        x, y, w, h = face["bbox"]
        face_id = face.get("face_id", -1)
        emotion = face.get("emotion_pred", "unknown")
        conf = face.get("confidence", 0.0)

        cv2.rectangle(out, (x, y), (x + w, y + h), color, 2)

        text = f"f{face_id} | {emotion} ({conf:.2f})"
        text_y = max(20, y - 8)

        cv2.putText(
            out,
            text,
            (x, text_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            color,
            2,
        )
    return out

def crop_face(img, bbox, margin=0.15):
    """
    bbox = [x, y, w, h]
    """
    x, y, w, h = bbox
    H, W = img.shape[:2]

    mx = int(w * margin)
    my = int(h * margin)

    x1 = max(0, x - mx)
    y1 = max(0, y - my)
    x2 = min(W, x + w + mx)
    y2 = min(H, y + h + my)

    return img[y1:y2, x1:x2]