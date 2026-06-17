# Stage 1 API Specification

## Description

Stage 1 takes a group image and outputs detected faces with emotion predictions.

---

## Input

* image_path (path to image file)

---

## Output

A JSON file per image.

The JSON contains:

* image_id: unique image identifier
* original_filename: original image filename
* image_path: original image path
* emotion_folder: dataset emotion category
* mapped_label: ground-truth emotion label (if available)
* num_faces: number of detected faces
* visualization_path: Stage 1 visualization image
* annotated_prediction_path: annotated prediction image
* faces: list of detected faces

Each face contains:

* face_id: unique face identifier within the image
* bbox: [x, y, width, height]
* det_score: face detection confidence score
* crop_path: path to cropped face image
* emotion_pred: predicted emotion
* confidence: prediction confidence
* top2_margin: difference between top two prediction probabilities
* probs: probabilities for all seven emotions

---

## Emotion Classes

* anger
* disgust
* fear
* happy
* neutral
* sadness
* surprise

---

## Usage

Run:

python process_all_faces_stage1.py

---

## Output Usage

Stage 2 uses:

* image_id
* face_id
* emotion_pred
* confidence
* top2_margin
* probs

Stage 3 uses:

* image_id
* face_id
* crop_path
* emotion_pred
* confidence

The image_id and face_id fields must remain unchanged across all stages to ensure traceability and frontend integration.
