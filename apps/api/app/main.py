from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .database import (
    duplicate_cv,
    get_cv,
    init_db,
    list_cvs,
    save_cv,
    set_default_cv,
    update_cv,
)
from .models import CVPayload, CVSummary, SaveCVResponse
from .ordering import normalize_payload
from .pdf_service import generate_cv_pdf

app = FastAPI(title="CV Maker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/templates")
def list_templates() -> dict[str, list[dict[str, str]]]:
    return {
        "templates": [
            {"id": "classic", "name": "Classic ATS"},
            {"id": "minimal", "name": "Minimal ATS"},
            {"id": "modern", "name": "Modern ATS"},
        ]
    }


@app.post("/cvs", response_model=SaveCVResponse)
def create_cv(payload: CVPayload) -> SaveCVResponse:
    normalized = normalize_payload(payload)
    cv_id = save_cv(normalized)
    return SaveCVResponse(id=cv_id)


@app.get("/cvs", response_model=list[CVSummary])
def read_cvs() -> list[CVSummary]:
    return [CVSummary(**item) for item in list_cvs()]


@app.get("/cvs/{cv_id}")
def read_cv(cv_id: str) -> dict:
    cv = get_cv(cv_id)
    if cv is None:
        raise HTTPException(status_code=404, detail="CV not found")
    return cv


@app.put("/cvs/{cv_id}", response_model=SaveCVResponse)
def save_existing_cv(cv_id: str, payload: CVPayload) -> SaveCVResponse:
    normalized = normalize_payload(payload)
    updated = update_cv(cv_id, normalized)
    if not updated:
        raise HTTPException(status_code=404, detail="CV not found")
    return SaveCVResponse(id=cv_id)


@app.post("/cvs/{cv_id}/duplicate", response_model=SaveCVResponse)
def duplicate_existing_cv(cv_id: str) -> SaveCVResponse:
    duplicated_id = duplicate_cv(cv_id)
    if duplicated_id is None:
        raise HTTPException(status_code=404, detail="CV not found")
    return SaveCVResponse(id=duplicated_id)


@app.post("/cvs/{cv_id}/set-default")
def set_main_default_cv(cv_id: str) -> dict[str, str]:
    updated = set_default_cv(cv_id)
    if not updated:
        raise HTTPException(status_code=404, detail="CV not found")
    return {"status": "ok"}


@app.post("/generate/pdf")
def generate_pdf(payload: CVPayload) -> StreamingResponse:
    normalized = normalize_payload(payload)
    pdf_bytes = generate_cv_pdf(normalized)
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="cv.pdf"'},
    )
