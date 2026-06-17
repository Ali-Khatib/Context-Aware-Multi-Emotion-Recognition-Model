import json
import csv
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets
from torchvision.transforms import v2 as T
from torchvision.models import (
    convnext_tiny, ConvNeXt_Tiny_Weights,
    efficientnet_v2_s, EfficientNet_V2_S_Weights
)
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, f1_score

# =========================
# CONFIG
# =========================
BASE_DIR = Path(r"C:\Users\ASUS\Downloads\capston ai")

# Use the same split used for strong ConvNeXt experiment
DATA_ROOT = BASE_DIR / "exp_full_merged_convnext_strong" / "data_split"

# Strong trained models
CONVNEXT_CKPT = BASE_DIR / "exp_full_merged_convnext_strong" / "models" / "best_convnext_tiny_full_merged_strong.pt"
EFFICIENTNET_CKPT = BASE_DIR / "exp_full_merged_efficientnet_strong" / "models" / "best_efficientnet_v2_s_full_merged_strong.pt"

# Class mapping files
CONVNEXT_IDX_TO_CLASS = BASE_DIR / "exp_full_merged_convnext_strong" / "reports" / "idx_to_class.json"
EFFICIENTNET_IDX_TO_CLASS = BASE_DIR / "exp_full_merged_efficientnet_strong" / "reports" / "idx_to_class.json"

EXP_DIR = BASE_DIR / "exp_stage1_ensemble_final"
REPORT_DIR = EXP_DIR / "reports"
LOG_DIR = EXP_DIR / "logs"
REPORT_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)

BATCH_SIZE = 32
NUM_WORKERS = 0
IMAGE_SIZE = 224

USE_TTA = True   # change to False if you want ensemble only

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print("Using device:", DEVICE)
if DEVICE == "cuda":
    try:
        print("GPU:", torch.cuda.get_device_name(0))
        torch.set_float32_matmul_precision("high")
    except Exception:
        pass

# =========================
# HELPERS
# =========================
def load_idx_to_class(path: Path):
    data = json.loads(path.read_text(encoding="utf-8"))
    return {int(k): v for k, v in data.items()}

def invert_mapping(idx_to_class):
    return {v: k for k, v in idx_to_class.items()}

def ensure_same_class_order(map1, map2):
    a = [map1[i] for i in range(len(map1))]
    b = [map2[i] for i in range(len(map2))]
    if a != b:
        raise ValueError(f"Class order mismatch between models.\nConvNeXt: {a}\nEfficientNet: {b}")
    return a

def softmax_probs(logits):
    return torch.softmax(logits, dim=1)

# =========================
# CLASS ORDER
# =========================
conv_idx_to_class = load_idx_to_class(CONVNEXT_IDX_TO_CLASS)
eff_idx_to_class = load_idx_to_class(EFFICIENTNET_IDX_TO_CLASS)
CLASS_NAMES = ensure_same_class_order(conv_idx_to_class, eff_idx_to_class)
NUM_CLASSES = len(CLASS_NAMES)

print("Resolved class order:", CLASS_NAMES)

# =========================
# TRANSFORMS
# =========================
conv_w = ConvNeXt_Tiny_Weights.IMAGENET1K_V1
eff_w = EfficientNet_V2_S_Weights.IMAGENET1K_V1

# For fairness we use the same base resize pipeline for both during evaluation.
# Each model then gets normalization with its own weights.
base_resize = T.Compose([
    T.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    T.ToImage(),
    T.ToDtype(torch.float32, scale=True),
])

conv_norm = T.Normalize(mean=conv_w.transforms().mean, std=conv_w.transforms().std)
eff_norm = T.Normalize(mean=eff_w.transforms().mean, std=eff_w.transforms().std)

# test-time augmentation variants
def build_tta_variants():
    return [
        T.Compose([
            T.Resize((IMAGE_SIZE, IMAGE_SIZE)),
            T.ToImage(),
            T.ToDtype(torch.float32, scale=True),
        ]),
        T.Compose([
            T.Resize((IMAGE_SIZE, IMAGE_SIZE)),
            T.RandomHorizontalFlip(p=1.0),
            T.ToImage(),
            T.ToDtype(torch.float32, scale=True),
        ]),
        T.Compose([
            T.Resize((256, 256)),
            T.CenterCrop((IMAGE_SIZE, IMAGE_SIZE)),
            T.ToImage(),
            T.ToDtype(torch.float32, scale=True),
        ]),
    ]

tta_variants = build_tta_variants()

# =========================
# DATASET
# =========================
test_ds = datasets.ImageFolder(DATA_ROOT / "test", transform=None)

print("ImageFolder class_to_idx:", test_ds.class_to_idx)
idx_to_class_test = {v: k for k, v in test_ds.class_to_idx.items()}
test_class_names = [idx_to_class_test[i] for i in range(len(idx_to_class_test))]

if test_class_names != CLASS_NAMES:
    raise ValueError(
        f"Test split class order mismatch.\n"
        f"Expected: {CLASS_NAMES}\n"
        f"Got: {test_class_names}"
    )

# custom collate because transform=None
def collate_pil(batch):
    images, labels = zip(*batch)
    return list(images), torch.tensor(labels, dtype=torch.long)

test_loader = DataLoader(
    test_ds,
    batch_size=BATCH_SIZE,
    shuffle=False,
    num_workers=NUM_WORKERS,
    pin_memory=True,
    collate_fn=collate_pil
)

# =========================
# MODELS
# =========================
conv_model = convnext_tiny(weights=None)
conv_in = conv_model.classifier[2].in_features
conv_model.classifier[2] = nn.Linear(conv_in, NUM_CLASSES)
conv_model.load_state_dict(torch.load(CONVNEXT_CKPT, map_location=DEVICE))
conv_model.to(DEVICE)
conv_model.eval()

eff_model = efficientnet_v2_s(weights=None)
eff_in = eff_model.classifier[1].in_features
eff_model.classifier[1] = nn.Linear(eff_in, NUM_CLASSES)
eff_model.load_state_dict(torch.load(EFFICIENTNET_CKPT, map_location=DEVICE))
eff_model.to(DEVICE)
eff_model.eval()

print("ConvNeXt model device:", next(conv_model.parameters()).device)
print("EfficientNet model device:", next(eff_model.parameters()).device)

# =========================
# INFERENCE
# =========================
@torch.no_grad()
def predict_probs_for_model(model, pil_images, tta=False, model_name="convnext"):
    """
    Returns averaged probabilities [B, C]
    """
    probs_list = []

    variants = tta_variants if tta else [base_resize]

    for tfm in variants:
        batch_tensor = torch.stack([tfm(img) for img in pil_images], dim=0)

        if model_name == "convnext":
            batch_tensor = conv_norm(batch_tensor)
        elif model_name == "efficientnet":
            batch_tensor = eff_norm(batch_tensor)
        else:
            raise ValueError("Unknown model_name")

        batch_tensor = batch_tensor.to(DEVICE, non_blocking=True)
        logits = model(batch_tensor)
        probs = softmax_probs(logits)
        probs_list.append(probs)

    return torch.stack(probs_list, dim=0).mean(dim=0)

@torch.no_grad()
def evaluate_ensemble(loader, use_tta=False):
    y_true = []
    y_pred = []
    rows = []

    for pil_images, labels in loader:
        labels = labels.to(DEVICE, non_blocking=True)

        conv_probs = predict_probs_for_model(conv_model, pil_images, tta=use_tta, model_name="convnext")
        eff_probs = predict_probs_for_model(eff_model, pil_images, tta=use_tta, model_name="efficientnet")

        # simple average ensemble
        ensemble_probs = (conv_probs + eff_probs) / 2.0
        preds = ensemble_probs.argmax(dim=1)

        y_true.extend(labels.cpu().tolist())
        y_pred.extend(preds.cpu().tolist())

        # save per-sample details
        for i in range(len(pil_images)):
            rows.append({
                "true_idx": int(labels[i].cpu().item()),
                "true_label": CLASS_NAMES[int(labels[i].cpu().item())],
                "pred_idx": int(preds[i].cpu().item()),
                "pred_label": CLASS_NAMES[int(preds[i].cpu().item())],
                "max_prob": float(ensemble_probs[i].max().cpu().item()),
            })

    acc = accuracy_score(y_true, y_pred)
    macro_f1 = f1_score(y_true, y_pred, average="macro")
    return y_true, y_pred, acc, macro_f1, rows

# =========================
# RUN
# =========================
mode_name = "ensemble_tta" if USE_TTA else "ensemble_only"
print(f"\nRunning mode: {mode_name}")

y_true, y_pred, test_acc, test_f1, rows = evaluate_ensemble(test_loader, use_tta=USE_TTA)

print(f"\nTEST RESULTS")
print(f"test_acc={test_acc:.4f}")
print(f"test_macro_f1={test_f1:.4f}")

report = classification_report(
    y_true, y_pred,
    target_names=CLASS_NAMES,
    digits=4,
    output_dict=True,
    zero_division=0
)
cm = confusion_matrix(y_true, y_pred).tolist()

with open(REPORT_DIR / f"{mode_name}_classification_report.json", "w", encoding="utf-8") as f:
    json.dump(report, f, indent=2)

with open(REPORT_DIR / f"{mode_name}_confusion_matrix.json", "w", encoding="utf-8") as f:
    json.dump(cm, f, indent=2)

summary = {
    "mode": mode_name,
    "use_tta": USE_TTA,
    "test_acc": test_acc,
    "test_macro_f1": test_f1,
    "class_names": CLASS_NAMES,
    "convnext_ckpt": str(CONVNEXT_CKPT),
    "efficientnet_ckpt": str(EFFICIENTNET_CKPT),
}
with open(REPORT_DIR / f"{mode_name}_summary.json", "w", encoding="utf-8") as f:
    json.dump(summary, f, indent=2)

with open(LOG_DIR / f"{mode_name}_predictions.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=rows[0].keys() if rows else ["true_idx", "true_label", "pred_idx", "pred_label", "max_prob"])
    writer.writeheader()
    writer.writerows(rows)

print("\nClassification report:")
print(classification_report(y_true, y_pred, target_names=CLASS_NAMES, digits=4, zero_division=0))

print("\nSaved reports in:", REPORT_DIR)
print("Saved logs in:", LOG_DIR)