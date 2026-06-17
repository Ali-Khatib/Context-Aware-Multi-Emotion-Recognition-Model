"""Standalone Stage 3 inference script (local testing)."""
from __future__ import annotations

import json
import os
from pathlib import Path

import joblib
import numpy as np
import torch
from PIL import Image
from sentence_transformers import SentenceTransformer
from google import genai

BASE_DIR = Path(__file__).resolve().parent

def _resolve_gemini_api_key() -> str:
    env = os.environ.get("GEMINI_API_KEY", "").strip()
    if env.startswith("AIza") and len(env) >= 30:
        return env
    raise ValueError(
        "GEMINI_API_KEY is not set. Set a valid Google API key in the environment before running Stage 3."
    )


_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=_resolve_gemini_api_key())
    return _client
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

fusion_model = joblib.load(BASE_DIR / "fusion_model.pkl")

with open(BASE_DIR / "fusion_label_map.json", encoding="utf-8") as f:
    label_map = json.load(f)

CANONICAL = ["anger", "disgust", "fear", "happiness", "neutral", "sadness", "surprise"]
id2label = {}
for label, idx in label_map.items():
    idx = int(idx)
    if idx not in id2label:
        id2label[idx] = CANONICAL[idx] if idx < len(CANONICAL) else label

embedder = SentenceTransformer("all-MiniLM-L6-v2")

emotion_map = {
    "anger": 0, "angry": 0,
    "disgust": 1,
    "fear": 2, "scared": 2,
    "happiness": 3, "happy": 3,
    "neutral": 4,
    "sadness": 5, "sad": 5,
    "surprise": 6, "surprised": 6,
}


def norm(e: str | None) -> int | None:
    if e is None:
        return None
    return emotion_map.get(e.lower().strip())


def run_vlm(image_path: str) -> tuple[str, str]:
    image = Image.open(image_path).convert("RGB")

    prompt = """
    You are an emotion recognition system.

    Return ONLY one word:
    anger, disgust, fear, happiness, sadness, surprise, neutral
    """

    client = _get_client()
    response = client.models.generate_content(
        model="gemini-2.5-flash-lite",
        contents=[prompt, image],
    )
    emotion = (response.text or "").strip().lower()

    desc_prompt = """
    Describe the facial expression and group emotion in one sentence.
    """
    desc = client.models.generate_content(
        model="gemini-2.5-flash-lite",
        contents=[desc_prompt, image],
    ).text.strip()

    return emotion, desc


def build_features(cnn_pred: str, vlm_pred: str, text: str) -> np.ndarray | None:
    c = norm(cnn_pred)
    v = norm(vlm_pred)
    if c is None or v is None:
        return None

    cnn_vec = np.zeros(7)
    cnn_vec[c] = 1

    vlm_vec = np.zeros(7)
    vlm_vec[v] = 1

    text_vec = embedder.encode(text)
    if len(text_vec) != 384:
        text_vec = np.zeros(384)

    agreement = np.array([1 if c == v else 0])
    return np.concatenate([cnn_vec, vlm_vec, text_vec, agreement]).reshape(1, -1)


def predict(image_path: str) -> dict:
    vlm_emotion, description = run_vlm(image_path)
    cnn_emotion = vlm_emotion

    features = build_features(cnn_emotion, vlm_emotion, description)
    if features is None:
        return {
            "error": "Invalid prediction",
            "cnn_prediction": None,
            "vlm_prediction": vlm_emotion,
            "fusion_prediction": None,
        }

    pred_id = int(fusion_model.predict(features)[0])
    emotion = id2label[int(pred_id)]

    return {
        "cnn_prediction": cnn_emotion,
        "vlm_prediction": vlm_emotion,
        "description": description,
        "fusion_prediction": emotion,
    }


if __name__ == "__main__":
    path = input("Enter image path: ").strip()
    result = predict(path)
    print("\nFINAL RESULT:\n", json.dumps(result, indent=2))
