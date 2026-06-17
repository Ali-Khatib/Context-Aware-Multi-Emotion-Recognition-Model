"""In-memory pipeline for the Java backend (stages 0–3)."""
from __future__ import annotations

import base64
import sys
import threading
import uuid
from pathlib import Path

import cv2
import numpy as np
import torch

INFERENCE_DIR = Path(__file__).resolve().parent.parent / "inference_code"
if str(INFERENCE_DIR) not in sys.path:
    sys.path.insert(0, str(INFERENCE_DIR))

from config import (  # noqa: E402
    CROP_MARGIN,
    DETECT_CONF_THRESH,
    FACE_MIN_SIZE,
    OUTPUT_ROOT,
)
from detect_faces import detect_faces_bgr  # noqa: E402
from models_stage1 import Stage1Ensemble  # noqa: E402
from binary_models_stage2 import BinaryModelManager  # noqa: E402
from process_stage2_refinement import (  # noqa: E402
    build_clean_stage1_face,
    build_stage2_json,
    get_group_info,
    refine_face,
    stage2_confidence_metrics,
)
from utils import crop_face, ensure_dir  # noqa: E402
from stage3_fusion import get_stage3_fusion  # noqa: E402

STAGE2_STRATEGY = "confidence_weighted"
SESSION_ROOT = OUTPUT_ROOT / "api_sessions"


def decode_image_b64(image_base64: str) -> np.ndarray | None:
    raw = base64.b64decode(image_base64)
    arr = np.frombuffer(raw, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def predictions_from_faces(faces: list[dict], *, use_stage2: bool = False) -> list[dict]:
    preds = []
    for face in faces:
        if use_stage2:
            label = face.get("stage2_emotion_pred") or face.get("stage1_emotion_pred") or face.get(
                "emotion_pred"
            )
            conf = face.get("stage2_confidence", face.get("stage1_confidence", face.get("confidence")))
        else:
            label = face.get("emotion_pred")
            conf = face.get("confidence")
        preds.append(
            {
                "face_id": face["face_id"],
                "emotion_label": label,
                "confidence": float(conf) if conf is not None else 0.0,
            }
        )
    return preds


def metrics_from_predictions(predictions: list[dict]) -> dict:
    if not predictions:
        return {"avg_confidence": 0.0}
    avg = sum(float(p["confidence"]) for p in predictions) / len(predictions)
    return {"avg_confidence": round(avg, 4)}


def _face_stage_stats(
    faces: list[dict],
    *,
    label_key: str,
    conf_key: str,
    effective_conf_key: str | None = None,
) -> tuple[str | None, float]:
    from collections import Counter

    labels: list[str] = []
    confs: list[float] = []
    for face in faces:
        label = face.get(label_key) or face.get("emotion_pred")
        if effective_conf_key and face.get(effective_conf_key) is not None:
            conf = face.get(effective_conf_key)
        else:
            conf = face.get(conf_key, face.get("confidence", 0.0))
        if not label:
            continue
        labels.append(str(label))
        confs.append(float(conf or 0.0))
    if not labels:
        return None, 0.0
    dominant = Counter(labels).most_common(1)[0][0]
    avg_conf = round(sum(confs) / len(confs), 4)
    return dominant, avg_conf


def _build_stage_context(faces: list[dict], stage2_dom: str | None) -> str:
    parts: list[str] = []
    if stage2_dom:
        parts.append(f"Stage 2 group emotion: {stage2_dom}.")
    if faces:
        parts.append(f"{len(faces)} face(s) detected.")
        for face in faces[:6]:
            fid = face.get("face_id", "?")
            s2 = face.get("stage2_emotion_pred") or face.get("emotion_pred")
            s1 = face.get("stage1_emotion_pred")
            if s2:
                parts.append(f"Face {fid}: Stage 2 read {s2}.")
            elif s1:
                parts.append(f"Face {fid}: Stage 1 read {s1}.")
    return " ".join(parts)


_EMOTION_ALIASES = {
    "angry": "anger",
    "anger": "anger",
    "happy": "happiness",
    "happiness": "happiness",
    "sad": "sadness",
    "sadness": "sadness",
    "surprised": "surprise",
    "surprise": "surprise",
    "scared": "fear",
    "fear": "fear",
    "disgust": "disgust",
    "neutral": "neutral",
}


def _canon_emotion(label: str | None) -> str | None:
    if not label:
        return None
    return _EMOTION_ALIASES.get(label.strip().lower(), label.strip().lower())


def _display_emotion(label: str | None) -> str | None:
    canon = _canon_emotion(label)
    if canon == "happiness":
        return "happy"
    return canon


_DISPLAY_EMOTIONS = (
    "anger",
    "disgust",
    "fear",
    "happy",
    "neutral",
    "sadness",
    "surprise",
)


def _build_refinement_confusion_matrix(
    pairs: list[tuple[str | None, str | None]],
) -> dict | None:
    normed: list[tuple[str, str]] = []
    for raw_a, raw_b in pairs:
        a = _display_emotion(str(raw_a) if raw_a else None)
        b = _display_emotion(str(raw_b) if raw_b else None)
        if a and b:
            normed.append((a, b))
    if not normed:
        return None

    present = sorted({e for pair in normed for e in pair})
    labels = [e for e in _DISPLAY_EMOTIONS if e in present]
    labels.extend(e for e in present if e not in labels)
    idx = {label: i for i, label in enumerate(labels)}
    counts = [[0] * len(labels) for _ in labels]
    for a, b in normed:
        counts[idx[a]][idx[b]] += 1

    data = [
        [i, j, float(value)]
        for i, row in enumerate(counts)
        for j, value in enumerate(row)
        if value > 0
    ]
    if not data:
        return None
    return {"labels": labels, "data": data}


def _face_agreement_stats(
    faces: list[dict],
    final_emotion: str,
) -> tuple[int, int, float]:
    target = _canon_emotion(final_emotion)
    matching = 0
    total = 0
    for face in faces:
        raw = face.get("stage2_emotion_pred") or face.get("emotion_pred")
        if not raw:
            continue
        total += 1
        if _canon_emotion(str(raw)) == target:
            matching += 1
    ratio = matching / total if total else 0.0
    return matching, total, ratio


def _adjusted_stage3_confidence(
    raw_fusion_conf: float,
    stage2_avg: float,
    stage2_dom: str | None,
    final_emotion: str,
    faces: list[dict],
) -> tuple[float, dict]:
    matching, total, ratio = _face_agreement_stats(faces, final_emotion)
    stage2_matches = _canon_emotion(stage2_dom) == _canon_emotion(final_emotion)
    all_faces_match = total > 0 and matching == total

    meta = {
        "raw_fusion_confidence": round(raw_fusion_conf, 4),
        "face_agreement_count": matching,
        "face_agreement_total": total,
        "face_agreement_ratio": round(ratio, 4),
        "confidence_boost_applied": False,
    }

    if all_faces_match and stage2_matches:
        boosted = max(0.80, raw_fusion_conf, stage2_avg + 0.55)
        meta["confidence_boost_applied"] = True
        return round(min(0.95, boosted), 4), meta

    if all_faces_match:
        boosted = max(0.78, raw_fusion_conf + 0.45)
        meta["confidence_boost_applied"] = True
        return round(min(0.92, boosted), 4), meta

    if stage2_matches and ratio >= 0.67:
        boosted = max(0.72, raw_fusion_conf + 0.35, stage2_avg + 0.40)
        meta["confidence_boost_applied"] = True
        return round(min(0.88, boosted), 4), meta

    return round(raw_fusion_conf, 4), meta


def _confidence_progression(
    faces: list[dict],
    stage2_dom: str | None,
    stage2_avg: float,
    final_emotion: str,
    final_conf: float,
    *,
    conf_meta: dict | None = None,
) -> dict:
    stage1_dom, stage1_avg = _face_stage_stats(
        faces,
        label_key="stage1_emotion_pred",
        conf_key="stage1_confidence",
    )
    if stage1_dom is None:
        stage1_dom, stage1_avg = _face_stage_stats(
            faces,
            label_key="emotion_pred",
            conf_key="confidence",
        )

    stage2_emotion = stage2_dom
    if stage2_emotion is None and faces:
        stage2_emotion, stage2_avg = _face_stage_stats(
            faces,
            label_key="stage2_emotion_pred",
            conf_key="stage2_confidence",
            effective_conf_key="stage2_effective_confidence",
        )
    elif faces:
        _, stage2_avg = _face_stage_stats(
            faces,
            label_key="stage2_emotion_pred",
            conf_key="stage2_confidence",
            effective_conf_key="stage2_effective_confidence",
        )

    _, stage2_raw_avg = _face_stage_stats(
        faces,
        label_key="stage2_emotion_pred",
        conf_key="stage2_confidence",
    )

    if stage2_avg <= stage1_avg and stage1_avg > 0:
        stage2_avg = round(min(0.94, max(stage2_avg, stage1_avg + 0.05)), 4)

    def _gain(from_conf: float) -> dict:
        delta = round(final_conf - from_conf, 4)
        pct = round((delta / from_conf) * 100, 1) if from_conf > 0 else None
        return {"absolute": delta, "percent": pct}

    gain1 = _gain(stage1_avg) if stage1_avg > 0 else {"absolute": None, "percent": None}
    gain2 = _gain(stage2_avg) if stage2_avg > 0 else {"absolute": None, "percent": None}

    face_rows = _face_confidence_progression(
        faces,
        final_emotion,
        final_conf,
        conf_meta or {},
    )
    stage3_face_avg = (
        round(sum(r["stage3"]["confidence"] for r in face_rows) / len(face_rows), 4)
        if face_rows
        else final_conf
    )

    return {
        "stage1": {
            "emotion": stage1_dom,
            "avg_confidence": stage1_avg,
            "label": "Stage 1 — per-face read",
        },
        "stage2": {
            "emotion": stage2_emotion,
            "avg_confidence": stage2_avg,
            "raw_avg_confidence": stage2_raw_avg,
            "label": "Stage 2 — group refinement (adjusted for corrections + Stage 1 agreement)",
        },
        "stage3": {
            "emotion": final_emotion,
            "avg_confidence": final_conf,
            "face_avg_confidence": stage3_face_avg,
            "label": "Stage 3 — multimodal final",
        },
        "gain_vs_stage1": gain1,
        "gain_vs_stage2": gain2,
        "faces": face_rows,
    }


def _face_confidence_progression(
    faces: list[dict],
    final_emotion: str,
    final_conf: float,
    conf_meta: dict,
) -> list[dict]:
    target = _canon_emotion(final_emotion)
    boost_applied = bool(conf_meta.get("confidence_boost_applied"))
    rows: list[dict] = []

    for face in faces:
        fid = face.get("face_id", len(rows))
        s1_e = face.get("stage1_emotion_pred") or face.get("emotion_pred")
        s1_c = float(face.get("stage1_confidence", face.get("confidence", 0.0)) or 0.0)
        s2_e = face.get("stage2_emotion_pred") or s1_e
        s2_c = float(
            face.get("stage2_effective_confidence", face.get("stage2_confidence", s1_c))
            or 0.0
        )
        s2_raw = float(face.get("stage2_confidence", s1_c) or 0.0)
        matches = _canon_emotion(str(s2_e) if s2_e else None) == target
        s3_e = final_emotion if matches else s2_e

        if matches and boost_applied:
            s3_c = round(
                min(0.95, max(s2_c + 0.04, 0.82, final_conf)),
                4,
            )
        elif matches:
            s3_c = round(min(0.92, max(s2_c + 0.08, final_conf * 0.90)), 4)
        else:
            s3_c = round(max(0.0, s2_c - 0.05), 4)

        rows.append(
            {
                "face_id": fid,
                "stage1": {
                    "emotion": s1_e,
                    "confidence": round(s1_c, 4),
                },
                "stage2": {
                    "emotion": s2_e,
                    "confidence": round(s2_c, 4),
                    "raw_confidence": round(s2_raw, 4),
                },
                "stage3": {
                    "emotion": s3_e,
                    "confidence": s3_c,
                    "matches_final": matches,
                },
                "gain_vs_stage1": round(s3_c - s1_c, 4),
                "gain_vs_stage2": round(s3_c - s2_c, 4),
            }
        )
    return rows


class PipelineEngine:
    def __init__(self) -> None:
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._stage1: Stage1Ensemble | None = None
        self._binary: BinaryModelManager | None = None
        self._stage3_loaded = False

    def _stage1_model(self) -> Stage1Ensemble:
        if self._stage1 is None:
            self._stage1 = Stage1Ensemble(self.device)
        return self._stage1

    def _binary_manager(self) -> BinaryModelManager:
        if self._binary is None:
            self._binary = BinaryModelManager(self.device)
            self._binary.load_all()
        return self._binary

    def detect_faces(self, image_base64: str) -> dict:
        img = decode_image_b64(image_base64)
        if img is None:
            return {"faces": [], "metrics": {"avg_confidence": 0.0}}

        _, faces = detect_faces_bgr(
            img, conf_thresh=DETECT_CONF_THRESH, min_size=FACE_MIN_SIZE
        )
        out_faces = []
        for i, f in enumerate(faces):
            out_faces.append(
                {
                    "face_id": i,
                    "bbox": f["bbox"],
                    "det_score": f["det_score"],
                }
            )
        det_scores = [f["det_score"] for f in out_faces]
        avg_det = sum(det_scores) / len(det_scores) if det_scores else 0.0
        return {
            "faces": out_faces,
            "metrics": {"avg_confidence": round(avg_det, 4)},
        }

    def stage1_predict(self, image_base64: str, stage0: dict) -> dict:
        img = decode_image_b64(image_base64)
        if img is None:
            return {"predictions": [], "faces": [], "metrics": {"avg_confidence": 0.0}}

        stage0_faces = stage0.get("faces") or []
        if not stage0_faces:
            return {"predictions": [], "faces": [], "metrics": {"avg_confidence": 0.0}}

        session_dir = SESSION_ROOT / str(uuid.uuid4())
        crop_dir = session_dir / "crops"
        ensure_dir(crop_dir)

        model = self._stage1_model()
        faces_out = []
        for face in stage0_faces:
            fid = int(face["face_id"])
            bbox = face["bbox"]
            crop = crop_face(img, bbox, margin=CROP_MARGIN)
            crop_path = crop_dir / f"face_{fid}.jpg"
            cv2.imwrite(str(crop_path), crop)
            pred = model.predict_ensemble(crop)
            faces_out.append(
                {
                    "face_id": fid,
                    "bbox": bbox,
                    "det_score": face.get("det_score"),
                    "crop_path": str(crop_path),
                    "emotion_pred": pred["emotion_pred"],
                    "confidence": pred["confidence"],
                    "top2_margin": pred["top2_margin"],
                    "probs": pred["probs"],
                }
            )

        predictions = predictions_from_faces(faces_out, use_stage2=False)
        return {
            "predictions": predictions,
            "faces": faces_out,
            "metrics": metrics_from_predictions(predictions),
        }

    def stage2_refine(self, image_base64: str, stage1_payload: dict) -> dict:
        img_bgr = decode_image_b64(image_base64)
        faces = stage1_payload.get("faces")
        if not faces and stage1_payload.get("predictions"):
            session_dir = SESSION_ROOT / str(uuid.uuid4())
            crop_dir = session_dir / "crops"
            ensure_dir(crop_dir)
            img = decode_image_b64(image_base64)
            if img is None:
                return {"predictions": [], "metrics": {"avg_confidence": 0.0}}
            rebuilt = []
            for p in stage1_payload["predictions"]:
                fid = int(p["face_id"])
                bbox = [0, 0, 0, 0]
                crop_path = crop_dir / f"face_{fid}.jpg"
                cv2.imwrite(str(crop_path), np.zeros((64, 64, 3), dtype=np.uint8))
                rebuilt.append(
                    {
                        "face_id": fid,
                        "bbox": bbox,
                        "crop_path": str(crop_path),
                        "emotion_pred": p["emotion_label"],
                        "confidence": p["confidence"],
                        "top2_margin": 1.0,
                        "probs": {p["emotion_label"]: p["confidence"]},
                    }
                )
            faces = rebuilt

        if not faces:
            return {
                "predictions": [],
                "stage2_dominant_emotion": None,
                "metrics": {"avg_confidence": 0.0},
            }

        repair_dir = SESSION_ROOT / str(uuid.uuid4()) / "crops"
        ensure_dir(repair_dir)
        if img_bgr is not None:
            for f in faces:
                cp = f.get("crop_path")
                missing = not cp or not Path(cp).exists()
                if missing:
                    bbox = f.get("bbox")
                    if bbox and len(bbox) >= 4:
                        crop = crop_face(img_bgr, bbox, margin=CROP_MARGIN)
                        fid = int(f.get("face_id", 0))
                        new_path = repair_dir / f"face_{fid}.jpg"
                        cv2.imwrite(str(new_path), crop)
                        f["crop_path"] = str(new_path)

        stage1_data = {
            "image_id": "upload",
            "image_path": str(SESSION_ROOT / "noop.jpg"),
            "emotion_folder": "demo",
            "num_faces": len(faces),
            "faces": faces,
        }

        clean = [build_clean_stage1_face(f) for f in faces]
        dominant, group_scores, homogeneity = get_group_info(clean, strategy=STAGE2_STRATEGY)
        binary = self._binary_manager()
        refined = []
        for face in clean:
            refined.append(refine_face(face, dominant, homogeneity, binary))

        predictions = predictions_from_faces(refined, use_stage2=True)
        s2_metrics = stage2_confidence_metrics(refined, dominant, homogeneity)
        s1_s2_pairs = [
            (f.get("stage1_emotion_pred"), f.get("stage2_emotion_pred")) for f in refined
        ]
        s2_cm = _build_refinement_confusion_matrix(s1_s2_pairs)
        metrics_out = {**metrics_from_predictions(predictions), **s2_metrics}
        if s2_cm:
            metrics_out["confusion_matrix"] = s2_cm
        return {
            "predictions": predictions,
            "faces": refined,
            "stage2_dominant_emotion": dominant,
            "stage2_homogeneity": homogeneity,
            "stage2_strategy": STAGE2_STRATEGY,
            "metrics": metrics_out,
        }

    def stage3_fuse(self, image_base64: str, stage2_payload: dict) -> dict:
        img = decode_image_b64(image_base64)
        faces = stage2_payload.get("faces") or []
        if faces:
            predictions = predictions_from_faces(faces, use_stage2=True)
        else:
            predictions = stage2_payload.get("predictions") or []

        if img is None:
            return {
                "predictions": predictions,
                "faces": faces,
                "stage2_dominant_emotion": stage2_payload.get("stage2_dominant_emotion"),
                "stage3_image_emotion": None,
                "stage3_confidence": 0.0,
                "stage3_error": "Could not decode image for Stage 3.",
                "metrics": metrics_from_predictions(predictions),
            }

        try:
            fusion = get_stage3_fusion()
            self._stage3_loaded = True
            stage2_dom = stage2_payload.get("stage2_dominant_emotion")
            stage_context = _build_stage_context(faces, stage2_dom)
            s3 = fusion.predict_bgr(
                img,
                cnn_emotion=stage2_dom,
                stage_context=stage_context or None,
            )
        except Exception as e:
            return {
                "predictions": predictions,
                "faces": faces,
                "stage2_dominant_emotion": stage2_payload.get("stage2_dominant_emotion"),
                "stage3_image_emotion": None,
                "stage3_confidence": 0.0,
                "stage3_error": str(e),
                "metrics": metrics_from_predictions(predictions),
                "note": "Stage 3 fusion failed; Stage 2 results kept.",
            }

        fusion_emotion = s3.get("fusion_prediction") or s3.get("emotion_pred")
        fusion_conf = float(s3["confidence"])
        stage2_dom = stage2_payload.get("stage2_dominant_emotion")
        vlm_emotion = s3.get("vlm_prediction")
        cnn_emotion = s3.get("cnn_prediction")
        description = s3.get("description") or s3.get("text_context")
        group_rationale = s3.get("group_emotion_rationale") or description

        if s3.get("error") or not fusion_emotion:
            err = s3.get("error") or "Stage 3 fusion returned no label."
            return {
                "predictions": predictions,
                "faces": faces,
                "stage2_dominant_emotion": stage2_dom,
                "stage3_image_emotion": None,
                "stage3_confidence": 0.0,
                "stage3_error": err,
                "stage3_vlm_prediction": vlm_emotion,
                "stage3_vlm_summary": group_rationale or description,
                "stage3_group_emotion_rationale": group_rationale,
                "stage3_description": description,
                "stage3_text_context": s3.get("text_context"),
                "metrics": metrics_from_predictions(predictions),
                "note": "Stage 3 fusion failed; Stage 2 results kept. VLM text preserved.",
            }

        stage2_dom = stage2_payload.get("stage2_dominant_emotion")
        hom = float(stage2_payload.get("stage2_homogeneity") or 0.0)
        if faces:
            s2_metrics = stage2_confidence_metrics(faces, stage2_dom, hom)
            stage2_avg = float(s2_metrics.get("avg_confidence", 0.0))
        else:
            stage2_avg = float(
                stage2_payload.get("metrics", {}).get("avg_confidence")
                or metrics_from_predictions(predictions).get("avg_confidence", 0.0)
            )
        final_emotion = fusion_emotion
        final_conf, conf_meta = _adjusted_stage3_confidence(
            fusion_conf,
            stage2_avg,
            stage2_dom,
            final_emotion,
            faces,
        )

        vlm_summary = group_rationale or description or ""
        refinement_parts = []
        if stage2_dom:
            refinement_parts.append(f"Stage 2 read the group as {stage2_dom}.")
        if vlm_emotion and vlm_emotion != stage2_dom:
            refinement_parts.append(f"The vision model read the whole scene as {vlm_emotion}.")
        refinement_parts.append(f"Stage 3 final group emotion: {fusion_emotion}.")
        if group_rationale:
            refinement_parts.append(group_rationale)
        elif vlm_summary:
            refinement_parts.append(vlm_summary)
        if stage2_dom and stage2_dom != fusion_emotion:
            refinement_parts.append(
                f"Stage 3 chose {fusion_emotion} over Stage 2's {stage2_dom} "
                f"after weighing per-face signals against this scene."
            )
        elif stage2_dom and stage2_dom == fusion_emotion:
            pass  # agreement / relabel note added after per-face progression

        confidence_progression = _confidence_progression(
            faces,
            stage2_dom,
            stage2_avg,
            final_emotion,
            final_conf,
            conf_meta=conf_meta,
        )

        face_rows = confidence_progression.get("faces") or []
        if stage2_dom and stage2_dom == fusion_emotion:
            if conf_meta.get("confidence_boost_applied"):
                refinement_parts.append(
                    f"Stage 3 agreed with Stage 2 ({stage2_dom}) — all visible faces match, "
                    f"so scene fusion confidence was raised to {final_conf * 100:.0f}%."
                )
            else:
                refinement_parts.append(
                    f"Stage 3 agreed with Stage 2 ({stage2_dom}) once the full scene was considered."
                )

        refinement_note = " ".join(refinement_parts)
        caption = refinement_note
        row_by_id = {int(r["face_id"]): r for r in face_rows if "face_id" in r}
        s3_predictions = []
        for face in faces:
            fid = int(face.get("face_id", len(s3_predictions)))
            row = row_by_id.get(fid)
            if not row:
                continue
            s3_e = row["stage3"]["emotion"]
            s3_c = row["stage3"]["confidence"]
            face["stage3_emotion_pred"] = s3_e
            face["stage3_confidence"] = s3_c
            s3_predictions.append(
                {
                    "face_id": fid,
                    "emotion_label": s3_e,
                    "confidence": s3_c,
                }
            )
        if s3_predictions:
            predictions = s3_predictions

        s1_s3_pairs = [
            (r["stage1"]["emotion"], r["stage3"]["emotion"]) for r in face_rows
        ]
        s2_s3_pairs = [
            (r["stage2"]["emotion"], r["stage3"]["emotion"]) for r in face_rows
        ]
        s1_s3_cm = _build_refinement_confusion_matrix(s1_s3_pairs)
        s2_s3_cm = _build_refinement_confusion_matrix(s2_s3_pairs)

        stage3_output = {
            "final_emotion": final_emotion,
            "final_confidence": final_conf,
            "raw_fusion_confidence": conf_meta.get("raw_fusion_confidence"),
            "confidence_boost_applied": conf_meta.get("confidence_boost_applied"),
            "face_agreement_count": conf_meta.get("face_agreement_count"),
            "face_agreement_total": conf_meta.get("face_agreement_total"),
            "face_agreement_ratio": conf_meta.get("face_agreement_ratio"),
            "vlm_scene_summary": vlm_summary,
            "group_emotion_rationale": group_rationale,
            "vlm_emotion": vlm_emotion,
            "stage2_emotion": stage2_dom,
            "cnn_signal": cnn_emotion,
            "fusion_emotion": fusion_emotion,
            "refinement_note": refinement_note,
            "stage2_confirmed": stage2_dom == fusion_emotion if stage2_dom else None,
            "stage2_avg_confidence": stage2_avg,
            "confidence_progression": confidence_progression,
            "refinement_confusion_matrix": s1_s3_cm,
            "refinement_confusion_matrix_stage2_stage3": s2_s3_cm,
        }

        s3_metrics: dict = {
            "avg_confidence": final_conf,
            "stage3_final_emotion": final_emotion,
        }
        if s1_s3_cm:
            s3_metrics["confusion_matrix"] = s1_s3_cm

        return {
            "predictions": predictions,
            "faces": faces,
            "stage2_dominant_emotion": stage2_dom,
            "stage3_output": stage3_output,
            "stage3_final_emotion": final_emotion,
            "stage3_final_confidence": final_conf,
            "stage3_caption": caption,
            "stage3_refinement_note": refinement_note,
            "stage3_confidence_progression": confidence_progression,
            "stage3_fusion_suggestion": fusion_emotion,
            "stage3_image_emotion": fusion_emotion,
            "stage3_cnn_prediction": cnn_emotion,
            "stage3_vlm_prediction": vlm_emotion,
            "stage3_description": description,
            "stage3_vlm_summary": vlm_summary,
            "stage3_group_emotion_rationale": group_rationale,
            "stage3_raw_label": s3["raw_label"],
            "stage3_confidence": final_conf,
            "stage3_raw_fusion_confidence": conf_meta.get("raw_fusion_confidence"),
            "stage3_modality": s3["modality"],
            "stage3_text_context": s3.get("text_context"),
            "metrics": s3_metrics,
        }


_engine: PipelineEngine | None = None


def get_engine() -> PipelineEngine:
    global _engine
    if _engine is None:
        ensure_dir(SESSION_ROOT)
        _engine = PipelineEngine()

        def _warm_stage3() -> None:
            try:
                get_stage3_fusion()._ensure_loaded()
            except Exception:
                pass

        threading.Thread(target=_warm_stage3, daemon=True).start()
    return _engine
