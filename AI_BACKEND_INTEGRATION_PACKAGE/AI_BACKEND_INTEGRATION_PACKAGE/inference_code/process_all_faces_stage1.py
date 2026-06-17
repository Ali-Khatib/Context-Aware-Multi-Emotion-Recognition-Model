import os
from pathlib import Path

import cv2
import torch

from config import (
    DATASET_ROOT,
    FACE_CROPS_DIR,
    JSON_STAGE1_DIR,
    VIS_DIR,
    ANNOTATED_DIR,
    EMOTION_FOLDERS,
    FOLDER_TO_LABEL,
    DETECT_CONF_THRESH,
    FACE_MIN_SIZE,
    CROP_MARGIN,
)
from utils import (
    ensure_dir,
    list_images_in_folder,
    get_image_id,
    draw_detection_boxes,
    draw_prediction_boxes,
    crop_face,
    save_json,
)
from detect_faces import detect_faces
from models_stage1 import Stage1Ensemble


def build_stage1_json(image_path, folder_name, mapped_label, image_id, faces_out, vis_path, ann_path):
    return {
        "image_id": image_id,
        "original_filename": os.path.basename(image_path),
        "image_path": image_path,
        "emotion_folder": folder_name,
        "mapped_label": mapped_label,
        "num_faces": len(faces_out),
        "visualization_path": str(vis_path),
        "annotated_prediction_path": str(ann_path),
        "faces": faces_out,
    }


def process_one_image(image_path, folder_name, model_runner):
    mapped_label = FOLDER_TO_LABEL[folder_name]
    image_id = get_image_id(image_path)

    img, faces = detect_faces(
        image_path,
        conf_thresh=DETECT_CONF_THRESH,
        min_size=FACE_MIN_SIZE,
    )

    if img is None:
        print(f"[FAILED] Could not load: {image_path}")
        return False

    # save detection-only visualization
    vis_folder = Path(VIS_DIR) / folder_name
    ensure_dir(vis_folder)

    vis_img = draw_detection_boxes(img, faces)
    vis_path = vis_folder / f"{image_id}_vis.jpg"
    cv2.imwrite(str(vis_path), vis_img)

    # crops + predictions
    crop_folder = Path(FACE_CROPS_DIR) / folder_name / image_id
    ensure_dir(crop_folder)

    faces_out = []
    for i, face in enumerate(faces):
        crop = crop_face(img, face["bbox"], margin=CROP_MARGIN)
        crop_path = crop_folder / f"face_{i}.jpg"
        cv2.imwrite(str(crop_path), crop)

        pred = model_runner.predict_ensemble(crop)

        faces_out.append({
            "face_id": i,
            "bbox": face["bbox"],
            "det_score": face["det_score"],
            "crop_path": str(crop_path),
            "emotion_pred": pred["emotion_pred"],
            "confidence": pred["confidence"],
            "top2_margin": pred["top2_margin"],
            "probs": pred["probs"],
        })

    # save annotated final image with predictions
    ann_folder = Path(ANNOTATED_DIR) / folder_name
    ensure_dir(ann_folder)

    ann_img = draw_prediction_boxes(img, faces_out)
    ann_path = ann_folder / f"{image_id}_annotated.jpg"
    cv2.imwrite(str(ann_path), ann_img)

    # save JSON
    stage1_data = build_stage1_json(
        image_path=image_path,
        folder_name=folder_name,
        mapped_label=mapped_label,
        image_id=image_id,
        faces_out=faces_out,
        vis_path=vis_path,
        ann_path=ann_path,
    )

    json_path = Path(JSON_STAGE1_DIR) / f"{image_id}.json"
    save_json(json_path, stage1_data)

    print(
        f"[OK] {folder_name} | file={os.path.basename(image_path)} "
        f"| id={image_id} | faces={len(faces)} | mapped_label={mapped_label}"
    )
    return True


def main():
    print("Starting Stage 1 inference pipeline...")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    ensure_dir(FACE_CROPS_DIR)
    ensure_dir(VIS_DIR)
    ensure_dir(ANNOTATED_DIR)
    ensure_dir(JSON_STAGE1_DIR)

    model_runner = Stage1Ensemble(device)

    total_images = 0
    total_success = 0

    for folder_name in EMOTION_FOLDERS:
        folder_path = Path(DATASET_ROOT) / folder_name
        images = list_images_in_folder(folder_path)

        print(f"\nProcessing folder: {folder_name}")
        print(f"Images found: {len(images)}")

        for image_path in images:
            total_images += 1
            ok = process_one_image(
                image_path=image_path,
                folder_name=folder_name,
                model_runner=model_runner,
            )
            if ok:
                total_success += 1

    print("\nDone.")
    print(f"Total images seen: {total_images}")
    print(f"Processed successfully: {total_success}")


if __name__ == "__main__":
    main()