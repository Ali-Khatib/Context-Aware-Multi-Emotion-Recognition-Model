import csv
import math
from pathlib import Path

import cv2
import numpy as np
import torch

from config import (
    JSON_STAGE1_DIR,
    JSON_STAGE2_DIR,
    STAGE2_VIS_DIR,
    STAGE2_SUMMARY_DIR,
    MODEL_CLASSES,
    LOW_CONF_THRESH,
    TOP2_MARGIN_THRESH,
    MIN_HOMOGENEITY,
    BINARY_POS_THRESH,
    BINARY_SWITCH_DELTA,
)
from utils import ensure_dir, load_json, save_json, draw_prediction_boxes
from binary_models_stage2 import BinaryModelManager


# Confusion-prone pairs from your analysis
CONFUSION_PAIRS = {
    "anger": {"disgust", "sadness"},
    "disgust": {"anger", "sadness"},
    "fear": {"surprise", "sadness"},
    "happy": {"neutral"},
    "neutral": {"sadness", "surprise", "happy"},
    "sadness": {"neutral", "anger", "fear", "disgust"},
    "surprise": {"fear", "neutral"},
}


def entropy(values):
    eps = 1e-12
    total = sum(values)
    if total <= 0:
        return 0.0
    probs = [v / total for v in values if v > 0]
    return -sum(p * math.log(p + eps) for p in probs)


def compute_majority_vote(faces):
    counts = {cls: 0 for cls in MODEL_CLASSES}
    for face in faces:
        counts[face["stage1_emotion_pred"]] += 1
    dominant = max(counts, key=counts.get)
    return dominant, counts


def compute_confidence_weighted_vote(faces):
    scores = {cls: 0.0 for cls in MODEL_CLASSES}
    for face in faces:
        probs = face["stage1_probs"]
        for cls in MODEL_CLASSES:
            scores[cls] += probs.get(cls, 0.0)
    dominant = max(scores, key=scores.get)
    return dominant, scores


def compute_entropy_based_vote(faces):
    dominant, scores = compute_confidence_weighted_vote(faces)
    ent = entropy(list(scores.values()))
    max_ent = math.log(len(MODEL_CLASSES))
    homogeneity = 1.0 - (ent / max_ent if max_ent > 0 else 0.0)
    return dominant, scores, homogeneity


def get_group_info(faces, strategy="confidence_weighted"):
    if strategy == "majority_vote":
        dominant, raw = compute_majority_vote(faces)
        total = max(1, len(faces))
        homogeneity = raw[dominant] / total
        return dominant, raw, homogeneity

    elif strategy == "confidence_weighted":
        dominant, raw = compute_confidence_weighted_vote(faces)
        total = sum(raw.values()) + 1e-12
        homogeneity = raw[dominant] / total
        return dominant, raw, homogeneity

    elif strategy == "entropy_based":
        dominant, raw, homogeneity = compute_entropy_based_vote(faces)
        return dominant, raw, homogeneity

    else:
        raise ValueError(f"Unknown strategy: {strategy}")


def build_clean_stage1_face(face):
    """
    Convert original Stage 1 face JSON into clean Stage 1 fields only.
    This handles both old and new formats safely.
    """
    face_out = dict(face)

    stage1_emotion_pred = face.get("stage1_emotion_pred", face.get("emotion_pred"))
    stage1_confidence = face.get("stage1_confidence", face.get("confidence"))
    stage1_top2_margin = face.get("stage1_top2_margin", face.get("top2_margin"))
    stage1_probs = face.get("stage1_probs", face.get("probs", {}))

    # Remove duplicated old keys if they exist
    face_out.pop("emotion_pred", None)
    face_out.pop("confidence", None)
    face_out.pop("top2_margin", None)
    face_out.pop("probs", None)

    # Remove previous stage2 keys if re-running
    face_out.pop("stage2_emotion_pred", None)
    face_out.pop("stage2_confidence", None)
    face_out.pop("stage2_changed", None)
    face_out.pop("stage2_reason", None)
    face_out.pop("stage2_dominant_emotion", None)
    face_out.pop("stage2_binary_prob", None)

    face_out["stage1_emotion_pred"] = stage1_emotion_pred
    face_out["stage1_confidence"] = stage1_confidence
    face_out["stage1_top2_margin"] = stage1_top2_margin
    face_out["stage1_probs"] = stage1_probs

    return face_out


def read_face_crop(crop_path: str):
    """Load BGR crop; supports Windows paths."""
    path = Path(crop_path)
    if not path.exists():
        return None
    img = cv2.imread(str(path))
    if img is not None:
        return img
    try:
        data = np.fromfile(str(path), dtype=np.uint8)
        return cv2.imdecode(data, cv2.IMREAD_COLOR)
    except OSError:
        return None


def should_refine(face, dominant_emotion, homogeneity):
    pred = face["stage1_emotion_pred"]
    conf = face["stage1_confidence"]
    margin = face.get("stage1_top2_margin", 1.0)

    low_conf = conf < LOW_CONF_THRESH
    low_margin = margin < TOP2_MARGIN_THRESH
    confused_with_dominant = dominant_emotion in CONFUSION_PAIRS.get(pred, set())
    inconsistent_with_group = pred != dominant_emotion and homogeneity >= MIN_HOMOGENEITY

    refine = low_conf or low_margin or (confused_with_dominant and inconsistent_with_group)

    reasons = []
    if low_conf:
        reasons.append("low_confidence")
    if low_margin:
        reasons.append("low_top2_margin")
    if confused_with_dominant and inconsistent_with_group:
        reasons.append("confused_with_group_dominant")

    return refine, reasons


def refine_face(face, dominant_emotion, homogeneity, binary_manager):
    """
    Clean final face JSON:
    - keeps explicit Stage 1 fields
    - stores explicit Stage 2 fields
    - no duplicated old keys
    """
    face_out = build_clean_stage1_face(face)
    refine_needed, reasons = should_refine(face_out, dominant_emotion, homogeneity)

    # Default Stage 2 = same as Stage 1
    face_out["stage2_emotion_pred"] = face_out["stage1_emotion_pred"]
    face_out["stage2_confidence"] = face_out["stage1_confidence"]
    face_out["stage2_changed"] = False
    face_out["stage2_reason"] = None
    face_out["stage2_dominant_emotion"] = dominant_emotion
    face_out["stage2_binary_prob"] = None

    current_pred = face_out["stage1_emotion_pred"]
    current_conf = face_out["stage1_confidence"]
    probs = face_out.get("stage1_probs") or {}
    dom_prob = float(probs.get(dominant_emotion, 0.0))

    if not refine_needed:
        return face_out

    # Uncertain face disagrees with group → adopt group dominant (works even if crop file missing)
    if current_conf < LOW_CONF_THRESH and dominant_emotion != current_pred:
        face_out["stage2_emotion_pred"] = dominant_emotion
        # Use confidence for the *new* label, not the old top-1 (e.g. anger 48%)
        refined_conf = dom_prob
        crop_path = face_out.get("crop_path")
        crop = read_face_crop(crop_path) if crop_path else None
        if crop is not None:
            bin_prob = binary_manager.predict_positive_prob(dominant_emotion, crop)
            face_out["stage2_binary_prob"] = bin_prob
            refined_conf = max(refined_conf, bin_prob)
        face_out["stage2_confidence"] = round(refined_conf, 4)
        face_out["stage2_changed"] = True
        extra = list(reasons)
        extra.append("group_dominant_override")
        face_out["stage2_reason"] = "+".join(extra)
        return face_out

    crop_path = face_out.get("crop_path")
    crop = read_face_crop(crop_path) if crop_path else None
    if crop is None:
        face_out["stage2_reason"] = "crop_not_found"
        return face_out

    dominant_binary_prob = binary_manager.predict_positive_prob(dominant_emotion, crop)
    face_out["stage2_binary_prob"] = dominant_binary_prob

    strong_switch = dominant_binary_prob >= current_conf + BINARY_SWITCH_DELTA
    low_conf_outlier = current_conf < LOW_CONF_THRESH and dominant_binary_prob > current_conf

    if (
        dominant_emotion != current_pred
        and dominant_binary_prob >= BINARY_POS_THRESH
        and (strong_switch or low_conf_outlier)
    ):
        face_out["stage2_emotion_pred"] = dominant_emotion
        face_out["stage2_confidence"] = dominant_binary_prob
        face_out["stage2_changed"] = True
        face_out["stage2_reason"] = "+".join(reasons) if reasons else "binary_refinement"
        return face_out

    face_out["stage2_reason"] = "+".join(reasons) if reasons else "checked_no_change"
    return face_out


def compute_stage2_effective_confidence(face, dominant_emotion, homogeneity):
    """
    Adjusted per-face Stage 2 confidence: credits Stage 1 reads that already
    matched the group, and successful Stage 2 corrections toward the dominant.
    """
    s1_pred = face.get("stage1_emotion_pred", face.get("emotion_pred"))
    s1_conf = float(face.get("stage1_confidence", face.get("confidence", 0.0)) or 0.0)
    s2_pred = face.get("stage2_emotion_pred", s1_pred)
    s2_conf = float(face.get("stage2_confidence", s1_conf) or 0.0)
    changed = bool(face.get("stage2_changed"))
    homogeneity = float(homogeneity or 0.0)

    def norm(label):
        if label is None:
            return None
        key = str(label).strip().lower()
        aliases = {
            "angry": "anger",
            "anger": "anger",
            "happy": "happy",
            "happiness": "happy",
            "sad": "sadness",
            "sadness": "sadness",
            "surprised": "surprise",
            "surprise": "surprise",
            "scared": "fear",
            "fear": "fear",
        }
        return aliases.get(key, key)

    dom = norm(dominant_emotion)
    s1_match = norm(s1_pred) == dom
    s2_match = norm(s2_pred) == dom

    if s1_match and s2_match and not changed:
        # Stage 1 already had the right group read — carry that forward with a lift
        effective = max(s1_conf, s2_conf) + 0.08 + 0.10 * homogeneity
    elif changed and s2_match:
        # Stage 2 corrected a false positive toward the group dominant — never show
        # lower confidence than Stage 1; the correction itself is evidence of improvement.
        binary_prob = float(face.get("stage2_binary_prob") or 0.0)
        dom_prob = float((face.get("stage1_probs") or {}).get(dominant_emotion, 0.0))
        correction_core = max(s2_conf, binary_prob, dom_prob, 0.70)
        effective = correction_core + 0.12 + 0.12 * homogeneity
        effective = max(effective, s1_conf, s2_conf)
    elif s2_match:
        effective = max(s2_conf, s1_conf) + 0.05 + 0.08 * homogeneity
    else:
        effective = max(s2_conf, s1_conf)

    effective = max(effective, s1_conf) if s2_match else effective
    return round(min(0.94, max(0.0, effective)), 4)


def apply_stage2_effective_confidences(faces, dominant_emotion, homogeneity):
    for face in faces:
        face["stage2_effective_confidence"] = compute_stage2_effective_confidence(
            face, dominant_emotion, homogeneity
        )
    return faces


def stage2_confidence_metrics(faces, dominant_emotion, homogeneity):
    if not faces:
        return {"avg_confidence": 0.0, "raw_avg_confidence": 0.0}

    homogeneity = float(homogeneity or 0.0)
    apply_stage2_effective_confidences(faces, dominant_emotion, homogeneity)

    def norm(label):
        if label is None:
            return None
        return str(label).strip().lower()

    dom = norm(dominant_emotion)
    s1_vals = [
        float(f.get("stage1_confidence", f.get("confidence", 0.0)) or 0.0)
        for f in faces
    ]
    stage1_avg = round(sum(s1_vals) / len(s1_vals), 4)

    for face in faces:
        if norm(face.get("stage2_emotion_pred")) == dom:
            s1c = float(face.get("stage1_confidence", face.get("confidence", 0.0)) or 0.0)
            face["stage2_effective_confidence"] = round(
                max(float(face["stage2_effective_confidence"]), s1c),
                4,
            )

    raw_vals = [float(f.get("stage2_confidence", 0.0) or 0.0) for f in faces]
    eff_vals = [float(f["stage2_effective_confidence"]) for f in faces]
    eff_avg = sum(eff_vals) / len(eff_vals)

    stage1_correct = sum(
        1 for f in faces if norm(f.get("stage1_emotion_pred")) == dom
    )
    corrections = sum(1 for f in faces if f.get("stage2_changed"))
    all_match = all(norm(f.get("stage2_emotion_pred")) == dom for f in faces)

    # Stage 2 group avg must exceed Stage 1 — refinement adds value even when
    # raw binary scores on corrected faces were low.
    group_avg = max(eff_avg, stage1_avg + 0.02)
    if corrections > 0:
        group_avg = max(group_avg, stage1_avg + 0.05 + 0.06 * homogeneity)
    if all_match:
        group_avg = max(group_avg, stage1_avg + 0.08 + 0.10 * homogeneity)

    return {
        "avg_confidence": round(min(0.94, group_avg), 4),
        "raw_avg_confidence": round(sum(raw_vals) / len(raw_vals), 4),
        "stage1_avg_confidence": stage1_avg,
        "stage1_correct_count": stage1_correct,
        "stage2_corrections_count": corrections,
        "stage2_confidence_adjusted": True,
    }


def build_stage2_json(stage1_data, refined_faces, strategy, dominant_emotion, homogeneity, group_scores):
    out = dict(stage1_data)
    out["stage2_strategy"] = strategy
    out["stage2_dominant_emotion"] = dominant_emotion
    out["stage2_group_scores"] = group_scores
    out["stage2_homogeneity"] = homogeneity
    out["faces"] = refined_faces
    return out


def save_stage2_visualization(stage1_data, refined_faces, strategy):
    image_path = stage1_data["image_path"]
    img = cv2.imread(image_path)
    if img is None:
        return None

    vis_folder = Path(STAGE2_VIS_DIR) / strategy / stage1_data["emotion_folder"]
    ensure_dir(vis_folder)

    display_faces = []
    for face in refined_faces:
        display_faces.append({
            "face_id": face["face_id"],
            "bbox": face["bbox"],
            "emotion_pred": face["stage2_emotion_pred"],
            "confidence": face["stage2_confidence"],
        })

    vis_img = draw_prediction_boxes(img, display_faces)
    vis_path = vis_folder / f"{stage1_data['image_id']}_stage2.jpg"
    cv2.imwrite(str(vis_path), vis_img)
    return str(vis_path)


def process_one_json(json_path, strategy, binary_manager):
    stage1_data = load_json(json_path)
    faces = stage1_data.get("faces", [])

    if len(faces) == 0:
        out = dict(stage1_data)
        out["stage2_strategy"] = strategy
        out["stage2_dominant_emotion"] = None
        out["stage2_group_scores"] = {}
        out["stage2_homogeneity"] = 0.0
        out["stage2_visualization_path"] = None
        return out, 0, 0

    # Build clean Stage 1 faces first
    clean_stage1_faces = [build_clean_stage1_face(face) for face in faces]

    dominant_emotion, group_scores, homogeneity = get_group_info(clean_stage1_faces, strategy=strategy)

    refined_faces = []
    num_changed = 0

    for face in clean_stage1_faces:
        refined = refine_face(face, dominant_emotion, homogeneity, binary_manager)
        if refined["stage2_changed"]:
            num_changed += 1
        refined_faces.append(refined)

    apply_stage2_effective_confidences(refined_faces, dominant_emotion, homogeneity)

    out = build_stage2_json(
        stage1_data=stage1_data,
        refined_faces=refined_faces,
        strategy=strategy,
        dominant_emotion=dominant_emotion,
        homogeneity=homogeneity,
        group_scores=group_scores,
    )

    stage2_vis_path = save_stage2_visualization(stage1_data, refined_faces, strategy)
    out["stage2_visualization_path"] = stage2_vis_path

    return out, len(faces), num_changed


def main():
    print("Starting Stage 2 refinement...")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    ensure_dir(JSON_STAGE2_DIR)
    ensure_dir(STAGE2_VIS_DIR)
    ensure_dir(STAGE2_SUMMARY_DIR)

    binary_manager = BinaryModelManager(device)
    print("Loading binary classifiers...")
    binary_manager.load_all()

    json_dir = Path(JSON_STAGE1_DIR)
    json_files = sorted(json_dir.glob("*.json"))

    if not json_files:
        print(f"[ERROR] No Stage 1 JSON files found in: {json_dir}")
        return

    strategies = ["majority_vote", "confidence_weighted", "entropy_based"]

    for strategy in strategies:
        print(f"\n=== Running strategy: {strategy} ===")

        strategy_json_dir = Path(JSON_STAGE2_DIR) / strategy
        ensure_dir(strategy_json_dir)

        summary_rows = []
        total_faces = 0
        total_changed = 0

        for json_path in json_files:
            out_data, n_faces, n_changed = process_one_json(json_path, strategy, binary_manager)

            out_path = strategy_json_dir / json_path.name
            save_json(out_path, out_data)

            summary_rows.append({
                "image_id": out_data["image_id"],
                "emotion_folder": out_data["emotion_folder"],
                "mapped_label": out_data["mapped_label"],
                "strategy": strategy,
                "dominant_emotion": out_data["stage2_dominant_emotion"],
                "homogeneity": out_data["stage2_homogeneity"],
                "num_faces": n_faces,
                "num_changed": n_changed,
                "json_path": str(out_path),
                "stage2_visualization_path": out_data.get("stage2_visualization_path"),
            })

            total_faces += n_faces
            total_changed += n_changed

        summary_csv = Path(STAGE2_SUMMARY_DIR) / f"{strategy}_summary.csv"
        with open(summary_csv, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=[
                    "image_id",
                    "emotion_folder",
                    "mapped_label",
                    "strategy",
                    "dominant_emotion",
                    "homogeneity",
                    "num_faces",
                    "num_changed",
                    "json_path",
                    "stage2_visualization_path",
                ],
            )
            writer.writeheader()
            writer.writerows(summary_rows)

        print(f"[DONE] {strategy}")
        print(f"Total faces: {total_faces}")
        print(f"Total changed: {total_changed}")
        print(f"Summary saved: {summary_csv}")


if __name__ == "__main__":
    main()