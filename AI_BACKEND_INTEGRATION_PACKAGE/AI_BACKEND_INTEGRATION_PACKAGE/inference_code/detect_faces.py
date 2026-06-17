import cv2
from utils import load_image

_USE_RETINA = False
try:
    from retinaface import RetinaFace

    _USE_RETINA = True
except ImportError:
    print(
        "[INFO] retina-face not installed (common on Python 3.13+). "
        "Using OpenCV face detector."
    )


def _parse_retinaface_results(results, conf_thresh, min_size):
    faces = []
    if isinstance(results, dict):
        for _, val in results.items():
            score = float(val["score"])
            x1, y1, x2, y2 = val["facial_area"]
            w = x2 - x1
            h = y2 - y1
            if score < conf_thresh:
                continue
            if w < min_size or h < min_size:
                continue
            faces.append({
                "bbox": [int(x1), int(y1), int(w), int(h)],
                "det_score": score,
            })
    return faces


def _detect_opencv_haar(img, conf_thresh=0.8, min_size=32):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    cascade = cv2.CascadeClassifier(cascade_path)
    if cascade.empty():
        print("[ERROR] OpenCV Haar cascade could not be loaded.")
        return []

    min_neighbors = 5
    detected = cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=min_neighbors,
        minSize=(min_size, min_size),
    )
    faces = []
    for (x, y, w, h) in detected:
        faces.append({
            "bbox": [int(x), int(y), int(w), int(h)],
            "det_score": float(conf_thresh),
        })
    return faces


def detect_faces_bgr(img, conf_thresh=0.8, min_size=32):
    if img is None:
        return None, []

    if _USE_RETINA:
        try:
            results = RetinaFace.detect_faces(img)
            return img, _parse_retinaface_results(results, conf_thresh, min_size)
        except Exception as e:
            print(f"[WARN] RetinaFace failed, using OpenCV: {e}")

    return img, _detect_opencv_haar(img, conf_thresh, min_size)


def detect_faces(image_path, conf_thresh=0.8, min_size=32):
    img = load_image(image_path)
    if img is None:
        return None, []
    return detect_faces_bgr(img, conf_thresh, min_size)
