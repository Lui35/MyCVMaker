import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .ai_service import AIServiceError, enhance_section, import_cv_from_text, tailor_cv_to_job
from .database import (
    delete_cv,
    duplicate_cv,
    get_cv,
    init_db,
    list_cvs,
    save_cv,
    set_default_cv,
    update_cv,
)
from .document_service import DocumentExtractionError, extract_document_text
from .models import (
    CVPayload,
    CVSummary,
    EnhanceSectionRequest,
    EnhanceSectionResponse,
    ImportCVResponse,
    PDFExportRequest,
    SaveCVResponse,
    TailorCVRequest,
    TailorCVResponse,
)
from .ordering import normalize_payload
from .pdf_service import PDFGenerationError, generate_cv_pdf

load_dotenv(Path(__file__).resolve().parents[3] / ".env")

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


@app.get("/ai/status")
def ai_status() -> dict[str, str | bool]:
    return {
        "configured": bool(os.getenv("GROQ_API_KEY", "").strip()),
        "provider": "Groq",
        "model": os.getenv("GROQ_MODEL", "openai/gpt-oss-20b"),
    }


@app.post("/ai/import-cv", response_model=ImportCVResponse)
async def import_cv(file: UploadFile = File(...)) -> ImportCVResponse:
    filename = file.filename or "uploaded-cv"
    try:
        content = await file.read()
        text, extraction_warnings = extract_document_text(filename, content)
        cv, ai_warnings = import_cv_from_text(text, filename)
    except DocumentExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except AIServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    finally:
        await file.close()
    return ImportCVResponse(
        cv=cv,
        warnings=[*extraction_warnings, *ai_warnings],
        source_name=filename,
    )


@app.post("/ai/tailor", response_model=TailorCVResponse)
def tailor_cv(request: TailorCVRequest) -> TailorCVResponse:
    try:
        return tailor_cv_to_job(request.cv, request.job_description)
    except AIServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/ai/enhance-section", response_model=EnhanceSectionResponse)
def enhance_cv_section(request: EnhanceSectionRequest) -> EnhanceSectionResponse:
    try:
        return enhance_section(request.section_type, request.content, request.context)
    except AIServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


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


@app.delete("/cvs/{cv_id}")
def delete_existing_cv(cv_id: str) -> dict[str, str]:
    deleted = delete_cv(cv_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="CV not found")
    return {"status": "deleted"}


@app.post("/generate/pdf")
def generate_pdf(request: PDFExportRequest) -> StreamingResponse:
    normalized = normalize_payload(request.cv)
    try:
        pdf_bytes = generate_cv_pdf(normalized, request.options)
    except PDFGenerationError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="cv.pdf"'},
    )
