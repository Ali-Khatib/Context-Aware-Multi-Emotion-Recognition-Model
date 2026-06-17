"""
Run Stage 1 then Stage 2 on a single group photo (for demos / professor video).

Usage (from inference_code/):
  python run_demo_one_image.py --image "..\\demo_input\\my_group.jpg"

Outputs under ../demo_runs/ (JSON + annotated images).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import torch

from config import JSON_STAGE1_DIR, JSON_STAGE2_DIR, OUTPUT_ROOT
from process_all_faces_stage1 import process_one_image
from process_stage2_refinement import process_one_json
from models_stage1 import Stage1Ensemble
from binary_models_stage2 import BinaryModelManager
from utils import ensure_dir, save_json


def main() -> int:
    parser = argparse.ArgumentParser(description="Stage 1 + Stage 2 on one image")
    parser.add_argument(
        "--image",
        required=True,
        help="Path to a group photo (PNG or JPEG)",
    )
    parser.add_argument(
        "--strategy",
        default="confidence_weighted",
        choices=["majority_vote", "confidence_weighted", "entropy_based"],
        help="Stage 2 group strategy (default: confidence_weighted)",
    )
    args = parser.parse_args()

    image_path = Path(args.image).resolve()
    if not image_path.is_file():
        print(f"[ERROR] Image not found: {image_path}")
        return 1

    ensure_dir(OUTPUT_ROOT)
    ensure_dir(JSON_STAGE1_DIR)
    ensure_dir(JSON_STAGE2_DIR)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    print(f"Image: {image_path}")
    print()

    print("=== Stage 1: face detection + emotion prediction ===")
    model_runner = Stage1Ensemble(device)
    ok = process_one_image(
        image_path=str(image_path),
        folder_name="demo",
        model_runner=model_runner,
    )
    if not ok:
        print("[ERROR] Stage 1 failed (no faces or could not load image).")
        return 1

    json_files = sorted(Path(JSON_STAGE1_DIR).glob("*.json"))
    if not json_files:
        print("[ERROR] Stage 1 did not write JSON.")
        return 1
    stage1_json = json_files[-1]
    print(f"Stage 1 JSON: {stage1_json}")

    print()
    print(f"=== Stage 2: context refinement ({args.strategy}) ===")
    binary_manager = BinaryModelManager(device)
    print("Loading binary classifiers...")
    binary_manager.load_all()

    out_data, n_faces, n_changed = process_one_json(
        stage1_json, args.strategy, binary_manager
    )

    out_dir = Path(JSON_STAGE2_DIR) / args.strategy
    ensure_dir(out_dir)
    stage2_json = out_dir / stage1_json.name
    save_json(stage2_json, out_data)

    print(f"Faces: {n_faces} | refined (changed): {n_changed}")
    print(f"Dominant group emotion: {out_data.get('stage2_dominant_emotion')}")
    print(f"Stage 2 JSON: {stage2_json}")
    vis = out_data.get("stage2_visualization_path") or out_data.get(
        "annotated_prediction_path"
    )
    if vis:
        print(f"Visualization: {vis}")
    print()
    print("Done. Open the JSON files and JPG paths above for your recording.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
