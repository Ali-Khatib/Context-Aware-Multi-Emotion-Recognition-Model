# AI Backend Integration Package

## Project

**From Individuals to Groups: Context-Aware Multi-Emotion Recognition**

Bahçeşehir University – Artificial Intelligence Engineering Capstone Project

AI Team:

* Nour Al Dakkak
* Zahraa Hasan

---

# Overview

This package contains the AI models, inference pipelines, documentation, and demo outputs required for integration with the Software Engineering team's web application.

The system consists of three stages:

1. Stage 1 – Facial Emotion Recognition
2. Stage 2 – Context-Aware Refinement
3. Stage 3 – Multimodal Vision-Language Integration (under development)

The package provides both production inference code and demo outputs for frontend development and testing.

---

# Stage 1 – Facial Emotion Recognition

## Objective

Detect all faces in a group image and predict one of the seven basic emotions for each face.

## Face Detection

Face detection is performed using:

* MTCNN
* RetinaFace (optional)

The detector returns:

* Face bounding boxes
* Detection confidence scores
* Face crops

## Emotion Classification

Stage 1 uses deep learning models trained using transfer learning.

Models:

* ConvNeXt-Tiny
* EfficientNetV2-S

Final Stage 1 prediction uses:

* Ensemble inference
* Test-Time Augmentation (TTA)

## Emotion Classes

The system predicts:

* anger
* disgust
* fear
* happy
* neutral
* sadness
* surprise

## Stage 1 Outputs

Generated files:

* stage1_output.json
* stage1_annotated.jpg

Generated information:

* Face IDs
* Bounding boxes
* Emotion predictions
* Confidence scores
* Probability distribution across all emotions

---

# Stage 2 – Context-Aware Refinement

## Objective

Improve Stage 1 predictions using group-level emotional context.

Instead of analyzing faces independently, Stage 2 considers the emotional composition of the entire group.

## Dominant Emotion Detection

Implemented strategies:

### Majority Voting

Uses the most frequently predicted emotion in the image.

### Confidence-Weighted Voting

Weights predictions according to confidence scores.

### Entropy-Based Refinement

Uses group homogeneity and uncertainty information.

## Selected Strategy

Final selected strategy:

**Confidence-Weighted Voting**

## Binary Classifiers

Seven binary classifiers are used:

* anger vs rest
* disgust vs rest
* fear vs rest
* happy vs rest
* neutral vs rest
* sadness vs rest
* surprise vs rest

These classifiers are used when:

* confidence is low
* prediction ambiguity exists
* dominant group emotion conflicts with face prediction

## Stage 2 Outputs

Generated files:

* stage2_output.json
* stage2_refinement.jpg

Generated information:

* Refined emotion predictions
* Dominant group emotion
* Refinement reasoning
* Binary classifier confidence
* Homogeneity score

## Evaluation

Manual face-level evaluation was performed.

Results:

* Stage 1 Accuracy: 62.60%
* Stage 2 Accuracy: 65.98%
* Improvement: +3.38 percentage points

Statistical validation:

* McNemar Test
* p < 0.05

The improvement was statistically significant.

---

# Stage 3 – Multimodal Vision-Language Integration

## Current Status

Under development.

## Planned Functionality

Stage 3 will combine:

* Original image
* Stage 2 predictions
* Vision-Language Models (VLMs)

Supported VLM approaches:

* Zero-shot classification
* Few-shot classification
* Context-enhanced classification

Candidate VLMs:

* Gemini
* GPT-4V
* LLaVA

## Expected Outputs

Generated files:

* stage3_output.json

Generated information:

* Group-level description
* Face-level descriptions
* Multimodal emotion reasoning
* Final Stage 3 prediction

## Sample Outputs

Sample Stage 3 JSON files are included for frontend development and testing.

---

# Demo Cases

Folder:

```text
demo_cases/
```

Contains prepared examples for frontend integration.

Each case contains:

```text
original.jpg
stage1_annotated.jpg
stage1_output.json
stage2_refinement.jpg
stage2_output.json
stage3_output.json
```

These files represent the expected outputs of the AI pipeline.

---

# Important Identifiers

The following identifiers must remain unchanged throughout the entire pipeline:

* image_id
* face_id

These identifiers are used to connect:

```text
Stage 1
↓
Stage 2
↓
Stage 3
```

The frontend and backend must preserve these identifiers.

---

# AI Backend Execution Flow

The expected backend workflow is:

1. User uploads image.
2. Stage 1 performs face detection.
3. Stage 1 predicts facial emotions.
4. Stage 1 generates:

   * stage1_output.json
   * stage1_annotated.jpg
5. Stage 2 reads Stage 1 output.
6. Stage 2 estimates dominant group emotion.
7. Stage 2 refines low-confidence predictions.
8. Stage 2 generates:

   * stage2_output.json
   * stage2_refinement.jpg
9. Stage 3 reads:

   * original image
   * Stage 2 predictions
   * face crops
10. Stage 3 generates:

* group description
* face descriptions
* stage3_output.json

11. Frontend displays all results.

Pipeline:

```text
Image Upload
    ↓
Stage 1
    ↓
Stage 2
    ↓
Stage 3
    ↓
Frontend Visualization
```

---

# Frontend Integration Requirements

## Original Image

Display:

* uploaded image

---

## Stage 1

Display:

* annotated image
* face IDs
* bounding boxes
* predicted emotions
* confidence scores

---

## Stage 2

Display:

* refined image
* dominant group emotion
* selected strategy
* Stage 1 vs Stage 2 comparison
* refinement indicators
* confidence scores

---

## Stage 3

Display:

* group description
* face descriptions
* multimodal analysis
* final prediction

---

# Python Files Overview

## config.py

Central configuration file.

Contains:

* model paths
* dataset paths
* thresholds
* image settings
* class mappings

Used by all AI modules.

---

## detect_faces.py

Face detection module.

Responsibilities:

* detect faces
* generate bounding boxes
* create face crops
* save cropped faces

Outputs:

* face crops
* bounding boxes

---

## models_stage1.py

Stage 1 classification models.

Responsibilities:

* load ConvNeXt model
* load EfficientNet model
* perform emotion classification

Outputs:

* emotion prediction
* confidence score
* probability distribution

---

## process_all_faces_stage1.py

Main Stage 1 pipeline.

Responsibilities:

1. Load image
2. Detect faces
3. Run emotion classification
4. Generate JSON output
5. Generate annotated image

Outputs:

* stage1_output.json
* stage1_annotated.jpg

---

## binary_models_stage2.py

Binary classifier manager.

Responsibilities:

* load seven binary classifiers
* evaluate candidate emotions
* support Stage 2 refinement

Outputs:

* binary probabilities

---

## process_stage2_refinement.py

Main Stage 2 pipeline.

Responsibilities:

1. Read Stage 1 output
2. Estimate dominant emotion
3. Apply context-aware refinement
4. Execute binary classifiers
5. Generate Stage 2 output
6. Generate Stage 2 visualization

Outputs:

* stage2_output.json
* stage2_refinement.jpg

---

## stage1_ensemble_tta_evaluation.py

Research and evaluation script.

Responsibilities:

* load ConvNeXt
* load EfficientNet
* apply TTA
* perform ensemble evaluation
* generate confusion matrices
* generate evaluation reports

Purpose:

Used for model evaluation and reporting.

Not required for production inference.

---

## requirements.txt

Python dependencies required to run the AI backend.

Install using:

```bash
pip install -r requirements.txt
```

---

# Package Contents

The integration package contains:

```text
demo_cases/
models/
inference_code/
docs/
requirements.txt
README.md
```

---

# Current Status

## Completed

* Dataset collection
* Face detection pipeline
* Multi-class emotion classification
* Ensemble + TTA evaluation
* Binary classifier training
* Context-aware refinement
* Stage 1 JSON generation
* Stage 2 JSON generation
* Statistical evaluation
* Demo cases

## In Progress

* Stage 3 multimodal integration
* VLM evaluation
* End-to-end deployment
* Final web integration
