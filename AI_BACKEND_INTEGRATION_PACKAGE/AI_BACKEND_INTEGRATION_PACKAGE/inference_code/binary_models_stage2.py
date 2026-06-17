from pathlib import Path

import cv2
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
from torchvision.transforms import v2 as T
from torchvision.models import efficientnet_v2_s

from config import (
    BINARY_MODEL_DIR,
    MODEL_CLASSES,
    IMAGE_SIZE,
    MEAN,
    STD,
)

def build_binary_model():
    model = efficientnet_v2_s(weights=None)
    in_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(in_features, 1)
    return model

def clean_state_dict(state_dict):
    cleaned = {}
    for k, v in state_dict.items():
        if k.startswith("module."):
            k = k[len("module."):]
        cleaned[k] = v
    return cleaned

def extract_state_dict(ckpt):
    if isinstance(ckpt, dict):
        for key in ["model_state_dict", "state_dict", "model"]:
            if key in ckpt and isinstance(ckpt[key], dict):
                return ckpt[key]
    return ckpt

def load_checkpoint_to_model(model, ckpt_path, device, model_name="binary_model"):
    ckpt_path = Path(ckpt_path)
    if not ckpt_path.exists():
        raise FileNotFoundError(f"{model_name} checkpoint not found: {ckpt_path}")

    ckpt = torch.load(ckpt_path, map_location=device)
    state_dict = clean_state_dict(extract_state_dict(ckpt))
    model.load_state_dict(state_dict, strict=False)
    model.to(device)
    model.eval()
    return model

def get_binary_transform():
    return T.Compose([
        T.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        T.ToImage(),
        T.ToDtype(torch.float32, scale=True),
        T.Normalize(mean=MEAN, std=STD),
    ])

def bgr_to_pil(face_bgr):
    face_rgb = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB)
    return Image.fromarray(face_rgb)

class BinaryModelManager:
    def __init__(self, device):
        self.device = device
        self.transform = get_binary_transform()
        self.models = {}

    def load_all(self):
        for cls_name in MODEL_CLASSES:
            ckpt_path = Path(BINARY_MODEL_DIR) / cls_name / f"best_{cls_name}_vs_rest.pt"
            model = build_binary_model()
            model = load_checkpoint_to_model(model, ckpt_path, self.device, model_name=f"binary_{cls_name}")
            self.models[cls_name] = model

    def predict_positive_prob(self, target_class, face_bgr):
        model = self.models[target_class]
        img_pil = bgr_to_pil(face_bgr)

        with torch.no_grad():
            x = self.transform(img_pil).unsqueeze(0).to(self.device)
            logits = model(x).squeeze(1)
            prob = torch.sigmoid(logits).item()

        return float(prob)