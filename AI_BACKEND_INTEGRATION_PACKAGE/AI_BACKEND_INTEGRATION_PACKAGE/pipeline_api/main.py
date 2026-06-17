"""
HTTP API for the Spring Boot backend (port 8000, base path /api/v1).

Run:
  uvicorn main:app --host 127.0.0.1 --port 8000
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from inference_runner import get_engine

app = FastAPI(title="Group emotion pipeline API", version="1.0.0")


class ImagePayload(BaseModel):
    image_base64: str


class Stage1Payload(BaseModel):
    image_base64: str
    stage0: dict


class Stage2Payload(BaseModel):
    image_base64: str
    stage1: dict


class Stage3Payload(BaseModel):
    image_base64: str
    stage2: dict


@app.get("/api/v1/health")
def health():
    return {"status": "ok"}


@app.post("/api/v1/detect-faces")
def detect_faces(body: ImagePayload):
    try:
        return get_engine().detect_faces(body.image_base64)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/v1/stage1/predict")
def stage1_predict(body: Stage1Payload):
    try:
        return get_engine().stage1_predict(body.image_base64, body.stage0)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/v1/stage2/refine")
def stage2_refine(body: Stage2Payload):
    try:
        return get_engine().stage2_refine(body.image_base64, body.stage1)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/v1/stage3/reason")
def stage3_reason(body: Stage3Payload):
    try:
        return get_engine().stage3_fuse(body.image_base64, body.stage2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
