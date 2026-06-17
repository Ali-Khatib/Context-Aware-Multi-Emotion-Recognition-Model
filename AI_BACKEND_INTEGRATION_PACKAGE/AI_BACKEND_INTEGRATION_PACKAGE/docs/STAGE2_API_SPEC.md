# Stage 2 API Specification

## Description

Stage 2 takes the Stage 1 JSON output and improves face-level emotion predictions using group emotional context and specialized binary classifiers.

---

## Input

Stage 1 JSON file.

Required image-level fields:

* image_id
* image_path
* num_faces

Required face-level fields:

* face_id
* emotion_pred
* confidence
* top2_margin
* probs
* crop_path

---

## Output

A refined JSON file per image.

Image-level fields:

* image_id
* image_path
* stage2_strategy
* stage2_dominant_emotion
* stage2_group_scores
* stage2_homogeneity
* stage2_visualization_path

Face-level fields:

* face_id
* bbox
* crop_path
* stage1_emotion_pred
* stage1_confidence
* stage1_top2_margin
* stage1_probs
* stage2_emotion_pred
* stage2_confidence
* stage2_changed
* stage2_reason
* stage2_dominant_emotion
* stage2_binary_prob

---

## Strategies

Stage 2 supports:

* majority_vote
* confidence_weighted
* entropy_based

Final selected strategy:

* confidence_weighted

---

## Usage

Run:

python process_stage2_refinement.py

---

## Evaluation

Manual face-level evaluation was performed on 7,283 labeled faces.

Best result:

* Stage 1 accuracy: 62.60%
* Stage 2 accuracy: 65.98%
* Improvement: +3.38 percentage points
* McNemar's statistical test: p < 0.05

The confidence-weighted strategy achieved the best overall refinement performance and was selected as the final Stage 2 method.

---

## Output Usage

Stage 3 can use:

* image_id
* face_id
* crop_path
* stage2_emotion_pred
* stage2_confidence
* stage2_dominant_emotion
* stage2_reason

Frontend can use:

* stage2_visualization_path
* stage2_dominant_emotion
* stage2_homogeneity
* stage2_changed
* stage2_reason

The image_id and face_id fields must remain unchanged across Stage 1, Stage 2, and Stage 3 to maintain traceability and allow correct mapping between predictions, visualizations, and textual descriptions.
