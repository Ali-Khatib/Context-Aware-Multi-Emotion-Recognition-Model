from pathlib import Path

import cv2
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
from torchvision.transforms import v2 as T
from torchvision.models import (
    convnext_tiny,
    efficientnet_v2_s,
)

from config import (
    CONVNEXT_PATH,
    EFFICIENTNET_PATH,
    MODEL_CLASSES,
    NUM_CLASSES,
    IMAGE_SIZE,
    MEAN,
    STD,
    USE_TTA,
)


def build_convnext(num_classes=7):
    model = convnext_tiny(weights=None)
    in_features = model.classifier[2].in_features
    model.classifier[2] = nn.Linear(in_features, num_classes)
    return model


def build_efficientnet(num_classes=7):
    model = efficientnet_v2_s(weights=None)
    in_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(in_features, num_classes)
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


def load_checkpoint_to_model(model, ckpt_path, device, model_name="model"):
    ckpt_path = Path(ckpt_path)
    if not ckpt_path.exists():
        raise FileNotFoundError(f"{model_name} checkpoint not found: {ckpt_path}")

    ckpt = torch.load(ckpt_path, map_location=device)
    state_dict = clean_state_dict(extract_state_dict(ckpt))
    model.load_state_dict(state_dict, strict=False)
    model.to(device)
    model.eval()
    return model


def get_transform():
    return T.Compose([
        T.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        T.ToImage(),
        T.ToDtype(torch.float32, scale=True),
        T.Normalize(mean=MEAN, std=STD),
    ])


def bgr_to_pil(face_bgr):
    face_rgb = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB)
    return Image.fromarray(face_rgb)


def predict_one_model(model, face_bgr, transform, device, use_tta=True):
    img_pil = bgr_to_pil(face_bgr)

    variants = [img_pil]
    if use_tta:
        variants.append(img_pil.transpose(Image.FLIP_LEFT_RIGHT))

    probs_list = []
    with torch.no_grad():
        for variant in variants:
            x = transform(variant).unsqueeze(0).to(device)
            logits = model(x)
            probs = F.softmax(logits, dim=1)
            probs_list.append(probs)

    mean_probs = torch.mean(torch.stack(probs_list, dim=0), dim=0)
    return mean_probs.squeeze(0)


class Stage1Ensemble:
    def __init__(self, device):
        self.device = device
        self.transform = get_transform()

        self.convnext_model = build_convnext(NUM_CLASSES)
        self.convnext_model = load_checkpoint_to_model(
            self.convnext_model, CONVNEXT_PATH, device, "ConvNeXt"
        )

        self.efficientnet_model = build_efficientnet(NUM_CLASSES)
        self.efficientnet_model = load_checkpoint_to_model(
            self.efficientnet_model, EFFICIENTNET_PATH, device, "EfficientNetV2-S"
        )

    def predict_ensemble(self, face_bgr):
        p1 = predict_one_model(
            self.convnext_model,
            face_bgr,
            self.transform,
            self.device,
            use_tta=USE_TTA,
        )
        p2 = predict_one_model(
            self.efficientnet_model,
            face_bgr,
            self.transform,
            self.device,
            use_tta=USE_TTA,
        )

        probs = (p1 + p2) / 2.0
        probs_np = probs.cpu().numpy()

        top1_idx = int(probs.argmax().item())
        top1_conf = float(probs[top1_idx].item())

        top2 = torch.topk(probs, k=2)
        top2_margin = float((top2.values[0] - top2.values[1]).item())

        return {
            "emotion_pred": MODEL_CLASSES[top1_idx],
            "confidence": top1_conf,
            "top2_margin": top2_margin,
            "probs": {
                cls_name: float(probs_np[i])
                for i, cls_name in enumerate(MODEL_CLASSES)
            },
        }