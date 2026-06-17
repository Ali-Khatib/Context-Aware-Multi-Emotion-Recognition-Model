"""Paths for this machine — all relative to the integration package folder."""
from pathlib import Path

# AI_BACKEND_INTEGRATION_PACKAGE/ (parent of inference_code/)
PACKAGE_ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = PACKAGE_ROOT / "models"

# Multiclass checkpoints (Stage 1)
CONVNEXT_PATH = MODELS_DIR / "best_convnext_tiny_full_merged_strong.pt"
EFFICIENTNET_PATH = MODELS_DIR / "best_efficientnet_v2_s_full_merged_strong.pt"

# Binary classifiers (Stage 2): models/binary_classifiers/<emotion>/best_<emotion>_vs_rest.pt
BINARY_MODEL_DIR = MODELS_DIR / "binary_classifiers"

# Demo / run outputs (created when you run the pipeline)
OUTPUT_ROOT = PACKAGE_ROOT / "demo_runs"
FACE_CROPS_DIR = OUTPUT_ROOT / "face_crops"
JSON_STAGE1_DIR = OUTPUT_ROOT / "json_stage1"
VIS_DIR = OUTPUT_ROOT / "visualizations"
ANNOTATED_DIR = OUTPUT_ROOT / "annotated_images"
JSON_STAGE2_DIR = OUTPUT_ROOT / "json_stage2"
STAGE2_VIS_DIR = OUTPUT_ROOT / "stage2_visualizations"
STAGE2_SUMMARY_DIR = OUTPUT_ROOT / "stage2_summary"

# Optional: batch mode over a labeled dataset folder (not needed for one-image demo)
DATASET_ROOT = PACKAGE_ROOT / "demo_input" / "dataset"

EMOTION_FOLDERS = [
    "angry",
    "disgust",
    "happy",
    "neutral",
    "sad",
    "scared",
    "surprised",
]

FOLDER_TO_LABEL = {
    "angry": "anger",
    "disgust": "disgust",
    "happy": "happy",
    "neutral": "neutral",
    "sad": "sadness",
    "scared": "fear",
    "surprised": "surprise",
    "demo": "neutral",
}

MODEL_CLASSES = [
    "anger",
    "disgust",
    "fear",
    "happy",
    "neutral",
    "sadness",
    "surprise",
]

NUM_CLASSES = len(MODEL_CLASSES)

IMAGE_SIZE = 224
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]

DETECT_CONF_THRESH = 0.80
FACE_MIN_SIZE = 32
CROP_MARGIN = 0.15

USE_TTA = True

HIGH_CONF_THRESH = 0.90
LOW_CONF_THRESH = 0.80
TOP2_MARGIN_THRESH = 0.30
DOMINANT_PROB_DELTA = 0.01
MIN_HOMOGENEITY = 0.20

BINARY_POS_THRESH = 0.55
BINARY_SWITCH_DELTA = 0.05
