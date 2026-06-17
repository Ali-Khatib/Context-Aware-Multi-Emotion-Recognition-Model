# Professor video — website + pipeline (Stages 0–2)

Record the **React app** running a full upload, not the Python terminal alone.

## Before recording (one time)

1. **Postgres** running, database **`sengroup`** exists.
2. **Python venv** for the pipeline API (first time only, ~5–15 min):

```powershell
cd AI_BACKEND_INTEGRATION_PACKAGE\AI_BACKEND_INTEGRATION_PACKAGE
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -r pipeline_api\requirements.txt
```

3. Test once: from repo root run `.\start.ps1` — you should get **3** PowerShell windows:
   - Pipeline API (**port 8000**)
   - Spring Boot (**8080**)
   - Vite UI (**5173**)

4. Open **http://localhost:5173**, upload a **clear group photo**, click **Start full analysis**.  
   First run is slow (models loading). Wait until status is **COMPLETED** (or check **Stages** tab).

## What to show in the video (~2–3 min)

1. **Say:** “Our capstone UI uploads a group image; the Java server orchestrates the pipeline; Stages 0–2 call the AI team’s models over HTTP.”
2. **Show** `.\start.ps1` or the three running terminals (8000, 8080, 5173).
3. **Browser — Start tab:** choose image, preview, **Start full analysis**.
4. **Browser — Stages tab:** timeline with **Face detection → Refinement 1 → Refinement 2** (face counts / confidence filling in).
5. **Browser — Report tab:** dominant emotion, table, confidence bars (if data present).
6. **Optional:** pgAdmin → `sengroup` → tables with new rows after the run.

## If the run fails

| Symptom | Fix |
|--------|-----|
| Failed immediately | Pipeline window not running — start `.\start.ps1` again or run uvicorn manually (below). |
| Stuck on RUNNING | Watch pipeline terminal for errors; first request loads large `.pt` files. |
| No faces | Use another photo (visible faces, good light). |
| 8080 error | Postgres / `sengroup` / password in `application.yml`. |

## Manual pipeline API only (debug)

```powershell
cd AI_BACKEND_INTEGRATION_PACKAGE\AI_BACKEND_INTEGRATION_PACKAGE
.\.venv\Scripts\Activate.ps1
$env:PYTHONPATH = "$PWD\inference_code"
cd pipeline_api
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```
