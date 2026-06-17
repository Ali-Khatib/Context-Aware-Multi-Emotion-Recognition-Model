# Context-Aware Multi-Emotion Recognition Model.

Bahçeşehir University capstone project. We built a full-stack application that takes a group photo, detects every face, predicts emotions per person, refines those predictions using group context, and finally runs a vision-language fusion step. The result is shown in a React web UI with stage-by-stage breakdowns, charts, and downloadable reports.

The repository contains everything: the website, the Java orchestration server, the Python inference pipeline with trained model weights, and the Stage 3 multimodal fusion assets.

## What it does

You upload a group image. The system runs four pipeline steps:

**Stage 0 — Face detection.** Finds all faces in the image, assigns each a `face_id`, and returns bounding boxes with detection confidence.

**Stage 1 — Facial emotion recognition.** For each detected face, predicts one of seven basic emotions using an ensemble of ConvNeXt-Tiny and EfficientNetV2-S with test-time augmentation. Outputs per-face labels, confidence scores, and probability distributions.

**Stage 2 — Context-aware refinement.** Uses the emotional makeup of the whole group to improve uncertain or conflicting predictions. Dominant group emotion is estimated with confidence-weighted voting. Seven binary classifiers (one per emotion vs. rest) help resolve low-confidence cases. Stage 2 improved face-level accuracy from 62.60% to 65.98% in our evaluation, with a statistically significant McNemar test (p < 0.05).

**Stage 3 — Multimodal fusion.** Sends the image to Google Gemini for a scene-level description and VLM emotion signal, combines that with CNN predictions from earlier stages, and fuses everything through a sentence-embedding classifier (`fusion_model.pkl`). The final `fusion_prediction` is what the UI treats as the Stage 3 result.

Emotion classes throughout the pipeline: anger, disgust, fear, happy, neutral, sadness, surprise.

`image_id` and `face_id` stay consistent across all stages so the frontend, backend, and models can line up results.

## Team

**Software Engineering**

- Ali Khatib — ali.khatib@bahcesehir.edu.tr
- Kareem Hijazi — kareem.hijazi@bahcesehir.edu.tr

**Artificial Intelligence**

- Nour Al Dakkak
- Zahraa Hasan

## Architecture

Three services run locally and talk to each other:

1. **React frontend** (Vite, port 5173) — upload, live status, stage timeline, report tab, CSV export, PDF-style report download.
2. **Spring Boot backend** (Java 17, port 8080) — REST API, image storage, PostgreSQL persistence, async job orchestration. Calls the Python pipeline over HTTP.
3. **Python pipeline API** (FastAPI + Uvicorn, port 8000) — loads PyTorch models, runs stages 0–3 in memory, returns JSON payloads.

PostgreSQL database `sengroup` stores images, analysis jobs, per-stage JSON payloads, face records, emotion results, and metrics.

```
Browser (5173)
    → Spring Boot (8080)
        → PostgreSQL (sengroup)
        → Pipeline API (8000)
            → Stage 0 detect
            → Stage 1 predict
            → Stage 2 refine
            → Stage 3 fuse (Gemini + fusion model)
```

## Repository layout

```
backend/                          Java Spring Boot API and JPA entities
frontend/                         React + TypeScript + Tailwind UI
start.ps1                         Windows launcher (all three services)
run.cmd                           Double-click wrapper for start.ps1

AI_BACKEND_INTEGRATION_PACKAGE/
  AI_BACKEND_INTEGRATION_PACKAGE/
    inference_code/               Core Python modules (detection, stage 1/2/3)
    models/                       Trained .pt weights (Stage 1 ensemble + Stage 2 binary)
    pipeline_api/                 FastAPI service the Java backend calls
    docs/                         API specs and AI package documentation
    requirements.txt              PyTorch, OpenCV, etc.
    requirements-retina.txt       RetinaFace + TensorFlow (Python 3.10–3.12)
    install_pipeline.ps1          First-time venv setup script
    RECORDING_DEMO.md             Step-by-step demo recording guide

  Stage3_multimodal_fusion/
    Stage3_multimodal_fusion/     fusion_model.pkl, fusion_label_map.json, standalone API
```

Runtime folders like `backend/storage/`, `.venv/`, and `demo_runs/` are created when you run the app and are gitignored.

## Prerequisites

- **Java 17** and **Maven**
- **Node.js** (LTS) and **npm**
- **PostgreSQL** with a database named `sengroup` (default credentials in `application.yml`: user `postgres`, password `postgres`, host `localhost:5432`)
- **Python 3.10–3.12** recommended (3.13+ works but uses OpenCV Haar detection instead of RetinaFace/TensorFlow)
- **Google Gemini API key** for Stage 3 (set as environment variable `GEMINI_API_KEY`)
- **Windows** for the one-click `start.ps1` launcher; other platforms can start each service manually (see below)
- A machine with enough RAM for PyTorch model loading (first request is slow while weights load)
- Internet connection for Stage 3 Gemini calls

## Quick start (Windows)

1. Install PostgreSQL and create the database if it does not exist:
   ```sql
   CREATE DATABASE sengroup;
   ```

2. Set your Gemini key (PowerShell):
   ```powershell
   $env:GEMINI_API_KEY = "your_key_here"
   ```

3. From the repo root, run:
   ```powershell
   .\start.ps1
   ```
   Or double-click `run.cmd`.

   This opens three terminal windows: pipeline API on 8000, Spring Boot on 8080, Vite dev server on 5173. On first run it creates a Python venv and installs dependencies (can take 10–20 minutes).

4. Open http://localhost:5173, upload a clear group photo with visible faces, and click **Start full analysis**.

5. Use the **Stages** tab to watch detection → Stage 1 → Stage 2 → Stage 3 fill in. Use **Report** for charts, confusion-style views, refinement progression, and downloads.

## Manual start (any OS)

**PostgreSQL** — ensure `sengroup` exists and matches `backend/src/main/resources/application.yml`.

**Pipeline API:**
```bash
cd AI_BACKEND_INTEGRATION_PACKAGE/AI_BACKEND_INTEGRATION_PACKAGE
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
pip install -r pipeline_api/requirements.txt
# Optional on Python 3.10–3.12 for RetinaFace:
pip install -r requirements-retina.txt

export GEMINI_API_KEY=your_key_here   # or set in Windows env
export PYTHONPATH=inference_code
cd pipeline_api
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

**Backend:**
```bash
cd backend
mvn spring-boot:run
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

If the pipeline runs on another host or port, change `app.pipeline.remote-base-url` in `application.yml` (default `http://localhost:8000/api/v1`).

## Configuration

**Database** — `backend/src/main/resources/application.yml`:
- JDBC URL, username, password
- Upload limit: 10 MB per image

**Pipeline URL** — same file, `app.pipeline.remote-base-url`

**Gemini** — `GEMINI_API_KEY` environment variable. Stage 3 will not work without it.

**Frontend API base** — optional `VITE_API_BASE` env var (defaults to `/api`, proxied to 8080 in dev via Vite config)

## Pipeline HTTP API

Base path: `/api/v1` on port 8000.

- `GET /health` — liveness check
- `POST /detect-faces` — body: `{ "image_base64": "..." }`
- `POST /stage1/predict` — body: `{ "image_base64", "stage0" }`
- `POST /stage2/refine` — body: `{ "image_base64", "stage1" }`
- `POST /stage3/reason` — body: `{ "image_base64", "stage2" }`

The Java backend calls these in sequence inside `AnalysisService` and persists each stage's JSON to Postgres.

More detail: `AI_BACKEND_INTEGRATION_PACKAGE/AI_BACKEND_INTEGRATION_PACKAGE/docs/STAGE1_API_SPEC.md` and `STAGE2_API_SPEC.md`.

## Backend REST API (port 8080)

Main routes used by the UI:

- `POST /api/images/upload` — upload image file
- `POST /api/analysis/start/{imageId}` — start async analysis job
- `GET /api/analysis/{analysisId}/status` — job status (PENDING, RUNNING, COMPLETED, FAILED)
- `GET /api/analysis/{analysisId}/stages` — all stage payloads
- `GET /api/analysis/{analysisId}/metrics` — aggregated metrics
- `GET /api/analysis/{analysisId}/export/csv` — CSV download

## Frontend

Three tabs:

- **Start** — choose and preview a photo, start analysis
- **Stages** — original image, face overlays, per-stage annotations, refinement indicators, Stage 3 panel
- **Report** — dominant emotion, confidence bars, pie charts, stage confusion matrices, refinement progression, downloadable report

Built with React 19, TypeScript, Tailwind CSS 4, and Vite 8.

Production build: `cd frontend && npm run build` (output in `frontend/dist/`).

## AI models included

**Stage 1** (in `models/`):
- `best_convnext_tiny_full_merged_strong.pt`
- `best_efficientnet_v2_s_full_merged_strong.pt`

**Stage 2** (in `models/binary_classifiers/<emotion>/`):
- Seven `best_<emotion>_vs_rest.pt` binary classifiers

**Stage 3** (in `Stage3_multimodal_fusion/Stage3_multimodal_fusion/`):
- `fusion_model.pkl`
- `fusion_label_map.json`

These files are large. Clone may take a while.

## Standalone AI scripts

You can run parts of the pipeline outside the web app:

- `inference_code/run_demo_one_image.py` — one-image Stage 1/2 demo
- `Stage3_multimodal_fusion/Stage3_multimodal_fusion/stage3_fusion_api.py` — interactive Stage 3 CLI
- `install_pipeline.ps1` — rebuild the Python venv from scratch on Windows

Full AI documentation: `AI_BACKEND_INTEGRATION_PACKAGE/AI_BACKEND_INTEGRATION_PACKAGE/docs/README.md`.

## Troubleshooting

**Analysis fails immediately** — pipeline API not running on port 8000. Check the pipeline terminal window.

**Stuck on RUNNING** — first request loads large model files; watch the pipeline terminal for errors.

**No faces detected** — try a different photo with clear, well-lit faces.

**8080 errors** — PostgreSQL not running, wrong password, or `sengroup` database missing.

**Stage 3 errors** — missing or invalid `GEMINI_API_KEY`, or no internet.

**Broken Python packages** — run `AI_BACKEND_INTEGRATION_PACKAGE/AI_BACKEND_INTEGRATION_PACKAGE/install_pipeline.ps1` on Windows, or recreate the venv manually.

**Python 3.13+** — RetinaFace/TensorFlow are skipped; OpenCV Haar cascade is used for detection instead. Python 3.12 is the sweet spot if you want RetinaFace.

For a recorded demo walkthrough, see `AI_BACKEND_INTEGRATION_PACKAGE/AI_BACKEND_INTEGRATION_PACKAGE/RECORDING_DEMO.md`.

## License and use

This project was built for academic and research purposes as part of a university capstone. The trained models, Gemini integration, and UI are intended for educational demonstration. Do not commit API keys to version control; use environment variables.
