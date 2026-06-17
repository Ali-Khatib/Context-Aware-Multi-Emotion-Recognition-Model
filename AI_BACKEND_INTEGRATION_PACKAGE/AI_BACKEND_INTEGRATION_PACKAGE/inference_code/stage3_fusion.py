"""Stage 3 — Gemini VLM + CNN signal + sentence-embedding fusion."""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

import cv2
import joblib
import numpy as np
import torch
from PIL import Image
from sentence_transformers import SentenceTransformer

STAGE3_MODEL_DIR = (
    Path(__file__).resolve().parent.parent.parent
    / "Stage3_multimodal_fusion"
    / "Stage3_multimodal_fusion"
)

def _resolve_gemini_api_key() -> str:
    env = os.environ.get("GEMINI_API_KEY", "").strip()
    if env.startswith("AIza") and len(env) >= 30:
        return env
    raise ValueError(
        "GEMINI_API_KEY is not set. Set a valid Google API key in the environment before running Stage 3."
    )

CANONICAL_EMOTIONS = [
    "anger",
    "disgust",
    "fear",
    "happiness",
    "neutral",
    "sadness",
    "surprise",
]

EMOTION_TO_ID = {
    "anger": 0,
    "angry": 0,
    "disgust": 1,
    "fear": 2,
    "scared": 2,
    "happiness": 3,
    "happy": 3,
    "neutral": 4,
    "sadness": 5,
    "sad": 5,
    "surprise": 6,
    "surprised": 6,
    "excited": 3,
    "excitement": 3,
    "joy": 3,
    "joyful": 3,
    "celebrating": 3,
    "celebration": 3,
}

# Align with Stage 1/2 class names in config.MODEL_CLASSES
LABEL_TO_PIPELINE = {
    "angry": "anger",
    "anger": "anger",
    "disgust": "disgust",
    "fear": "fear",
    "happy": "happy",
    "happiness": "happy",
    "neutral": "neutral",
    "sad": "sadness",
    "sadness": "sadness",
    "surprise": "surprise",
    "surprised": "surprise",
    "scared": "fear",
}


def _map_label(raw: str) -> str:
    key = raw.strip().lower()
    return LABEL_TO_PIPELINE.get(key, key)


_VAGUE_RATIONALE_PHRASES = (
    "group mood appears",
    "group mood seems",
    "appears to be animated",
    "seems animated",
    "mood appears",
    "overall mood",
    "the mood is",
    "emotion appears",
    "seems to be",
    "appears to be",
    "general atmosphere",
    "positive atmosphere",
    "negative atmosphere",
    "shared emotion of",
    "the group expresses",
    "expresses an emotion",
    "without a clear",
    "cannot determine the occasion",
)

_PARTY_PROP_CUES = (
    "noisemaker",
    "party horn",
    "horn",
    "confetti",
    "balloon",
    "cake",
    "candle",
    "banner",
    "streamer",
    "hat",
    "tiara",
    "sash",
)

_OCCASION_WORDS = (
    "birthday",
    "funeral",
    "memorial",
    "wedding",
    "graduation",
    "party",
    "celebration",
    "celebrating",
    "new year",
    "christmas",
    "halloween",
    "game",
    "match",
    "concert",
    "festival",
    "ceremony",
    "reunion",
    "shower",
    "anniversary",
    "office",
    "meeting",
    "protest",
    "rally",
    "parade",
    "beach",
    "restaurant",
    "bar",
    "club",
    "church",
    "mosque",
    "temple",
    "hospital",
    "classroom",
    "stage",
    "conference",
)


def _looks_generic_rationale(text: str) -> bool:
    t = text.lower()
    if any(p in t for p in _VAGUE_RATIONALE_PHRASES):
        return True
    has_occasion = any(w in t for w in _OCCASION_WORDS)
    has_party_props = any(p in t for p in _PARTY_PROP_CUES)
    if has_party_props and not has_occasion:
        return True
    if not has_occasion and "people" in t and len(t.split()) > 25:
        # Long physical-only description with no setting named
        activity_cues = (
            "doing",
            "at a",
            "at the",
            "during",
            "while",
            "because",
            "occasion",
            "event",
            "gathering",
            "ceremony",
        )
        if not any(c in t for c in activity_cues):
            return True
    return False


def _ensure_for_this_photo(text: str) -> str:
    text = text.strip()
    if not text:
        return text
    if not text.lower().startswith("for this photo"):
        text = f"For this photo, {text[0].lower()}{text[1:]}"
    return text


def _norm_emotion(value: str | None) -> int | None:
    if value is None:
        return None
    return EMOTION_TO_ID.get(value.lower().strip())


class Stage3Fusion:
    def __init__(self) -> None:
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._loaded = False
        self.fusion_model = None
        self.id2label: dict[int, str] = {}
        self.embedder: SentenceTransformer | None = None
        self._genai_client = None

    def _ensure_loaded(self) -> None:
        if self._loaded:
            return

        model_dir = STAGE3_MODEL_DIR
        fusion_path = model_dir / "fusion_model.pkl"
        label_path = model_dir / "fusion_label_map.json"

        for p in (fusion_path, label_path):
            if not p.exists():
                raise FileNotFoundError(f"Stage 3 model file missing: {p}")

        self.fusion_model = joblib.load(fusion_path)
        with open(label_path, encoding="utf-8") as f:
            label_map = json.load(f)

        self.id2label = {}
        for label, idx in label_map.items():
            idx = int(idx)
            if idx not in self.id2label:
                self.id2label[idx] = CANONICAL_EMOTIONS[idx] if idx < len(CANONICAL_EMOTIONS) else label

        self.embedder = SentenceTransformer("all-MiniLM-L6-v2")
        self._loaded = True

    def _get_genai_client(self):
        if self._genai_client is not None:
            return self._genai_client

        api_key = _resolve_gemini_api_key()

        from google import genai

        self._genai_client = genai.Client(api_key=api_key)
        return self._genai_client

    def _run_vlm(
        self,
        image_path: str,
        stage_context: str | None = None,
    ) -> tuple[str, str, str]:
        client = self._get_genai_client()
        image = Image.open(image_path).convert("RGB")

        context_block = ""
        if stage_context:
            context_block = f"""
        Pipeline context (verify against the image — do not copy blindly):
        {stage_context}
        """

        def fetch_combined(*, strict: bool) -> tuple[str, str]:
            extra = ""
            if strict:
                extra = """
        Your last answer was too vague — you listed poses but never named the occasion or what they are doing.
        You MUST state: (1) the specific event/setting (e.g. birthday party, funeral, wedding, sports game, graduation),
        (2) what the group is actively doing there, (3) which visible props prove it.
        Do NOT say "group mood appears animated" or similar hedging without naming the event.
        """
            prompt = f"""
        Analyze this ONE group photo for emotion recognition.
        {context_block}
        {extra}
        Return EXACTLY two lines and nothing else:
        EMOTION: <one word from anger, disgust, fear, happiness, sadness, surprise, neutral>
        WHY: <3-5 sentences starting with "For this photo," — (1) count people and name the occasion/setting inferred from visible props, clothing, and environment (birthday party, funeral/memorial, wedding, sports game, graduation, office meeting, night out at a bar, etc.); if props like noisemakers, party horns, cake, candles, balloons, black formal wear, jerseys, or signs are visible, name the most likely event; (2) say what they are actively doing (celebrating a birthday, mourning, cheering, posing, eating, etc.); (3) cite 2-3 specific visible details; (4) tie that occasion/activity to the chosen EMOTION. No vague "animated mood" without naming the event.>
        """
            response = client.models.generate_content(
                model="gemini-2.5-flash-lite",
                contents=[prompt, image],
            )
            raw = (response.text or "").strip()
            emotion = ""
            why = ""
            for line in raw.splitlines():
                stripped = line.strip()
                upper = stripped.upper()
                if upper.startswith("EMOTION:"):
                    emotion = stripped.split(":", 1)[1].strip().lower().split()[0]
                    emotion = emotion.strip(".,;:")
                elif upper.startswith("WHY:"):
                    why = stripped.split(":", 1)[1].strip()
            if not why:
                why = raw
            if not emotion:
                emotion = "neutral"
            emotion = LABEL_TO_PIPELINE.get(emotion, emotion)
            return emotion, _ensure_for_this_photo(why)

        vlm_emotion, group_rationale = fetch_combined(strict=False)
        if _looks_generic_rationale(group_rationale):
            vlm_emotion, group_rationale = fetch_combined(strict=True)

        description = group_rationale
        return vlm_emotion, description, group_rationale

    def _build_features(
        self,
        cnn_pred: str | None,
        vlm_pred: str | None,
        text: str,
    ) -> np.ndarray | None:
        assert self.embedder is not None

        c = _norm_emotion(cnn_pred)
        v = _norm_emotion(vlm_pred)
        if c is None or v is None:
            return None

        cnn_vec = np.zeros(7)
        cnn_vec[c] = 1

        vlm_vec = np.zeros(7)
        vlm_vec[v] = 1

        text_vec = self.embedder.encode(text)
        if len(text_vec) != 384:
            text_vec = np.zeros(384)

        agreement = np.array([1 if c == v else 0])
        return np.concatenate([cnn_vec, vlm_vec, text_vec, agreement]).reshape(1, -1)

    def predict_image_path(
        self,
        image_path: str,
        cnn_emotion: str | None = None,
        stage_context: str | None = None,
    ) -> dict:
        self._ensure_loaded()
        assert self.fusion_model is not None

        vlm_emotion, description, group_rationale = self._run_vlm(
            image_path,
            stage_context=stage_context,
        )
        cnn_signal = cnn_emotion or vlm_emotion

        features = self._build_features(cnn_signal, vlm_emotion, description)
        if features is None:
            return {
                "emotion_pred": None,
                "raw_label": None,
                "confidence": 0.0,
                "text_context": description,
                "modality": "gemini_vlm_sentence_fusion",
                "cnn_prediction": cnn_signal,
                "vlm_prediction": vlm_emotion,
                "description": description,
                "group_emotion_rationale": group_rationale,
                "fusion_prediction": None,
                "error": "Invalid VLM or CNN emotion for fusion.",
            }

        pred_id = int(self.fusion_model.predict(features)[0])
        raw_label = self.id2label.get(pred_id, CANONICAL_EMOTIONS[pred_id] if pred_id < 7 else str(pred_id))
        mapped = _map_label(raw_label)

        confidence = 0.0
        if hasattr(self.fusion_model, "predict_proba"):
            try:
                proba = self.fusion_model.predict_proba(features)[0]
                confidence = float(np.max(proba))
            except Exception:
                confidence = 0.0

        return {
            "emotion_pred": mapped,
            "raw_label": raw_label,
            "confidence": round(confidence, 4),
            "text_context": description,
            "modality": "gemini_vlm_sentence_fusion",
            "cnn_prediction": cnn_signal,
            "vlm_prediction": vlm_emotion,
            "description": description,
            "group_emotion_rationale": group_rationale,
            "fusion_prediction": mapped,
        }

    def predict_bgr(
        self,
        bgr: np.ndarray,
        cnn_emotion: str | None = None,
        stage_context: str | None = None,
    ) -> dict:
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        pil = Image.fromarray(rgb)
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            path = tmp.name
            pil.save(path, format="JPEG", quality=92)
        try:
            return self.predict_image_path(
                path,
                cnn_emotion=cnn_emotion,
                stage_context=stage_context,
            )
        finally:
            Path(path).unlink(missing_ok=True)


_fusion: Stage3Fusion | None = None


def get_stage3_fusion() -> Stage3Fusion:
    global _fusion
    if _fusion is None:
        _fusion = Stage3Fusion()
    return _fusion
