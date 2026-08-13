import os
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from pydantic import BaseModel, EmailStr, Field
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse

from industries import INDUSTRIES, get_industry
from pdf_utils import extract_text, PdfExtractionError
from ai_extraction import extract_structured_data, AIExtractionError
from validation import validate
from demo_pdfs import build_demo_pdf, build_combined_pdf
from database import init_db, list_fields, add_field, update_field, deactivate_field
from email_service import send_pdf_email, EmailDeliveryError

init_db()

app = FastAPI(title="AI Document Automation MVP API")

# In production, replace "*" with your deployed Vercel frontend URL.
# Allowed frontend origins.
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/industries")
def list_industries():
    """Frontend uses this to render industry cards + field labels without duplicating config."""
    return {
        key: {
            "label": cfg["label"],
            "doc_title": cfg["doc_title"],
            "fields": list_fields(key),
        }
        for key, cfg in INDUSTRIES.items()
    }


class FieldCreateRequest(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    type: str = Field(default="text")
    key: str | None = Field(default=None, max_length=100)


class FieldUpdateRequest(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    type: str = Field(default="text")


@app.get("/api/fields/{industry_key}")
def get_fields(industry_key: str):
    try:
        get_industry(industry_key)
    except KeyError:
        raise HTTPException(status_code=404, detail="Unknown industry")
    return {"industry": industry_key, "fields": list_fields(industry_key)}


@app.post("/api/fields/{industry_key}")
def create_field(industry_key: str, req: FieldCreateRequest):
    try:
        get_industry(industry_key)
        return add_field(industry_key, req.label, req.type, req.key)
    except KeyError:
        raise HTTPException(status_code=404, detail="Unknown industry")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.patch("/api/fields/{industry_key}/{field_id}")
def edit_field(industry_key: str, field_id: int, req: FieldUpdateRequest):
    try:
        get_industry(industry_key)
        return update_field(industry_key, field_id, req.label, req.type)
    except KeyError:
        raise HTTPException(status_code=404, detail="Unknown industry")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.delete("/api/fields/{industry_key}/{field_id}")
def delete_field(industry_key: str, field_id: int):
    try:
        get_industry(industry_key)
        deactivate_field(industry_key, field_id)
        return {"ok": True}
    except KeyError:
        raise HTTPException(status_code=404, detail="Unknown industry")
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.get("/api/demo/{industry_key}")
def get_demo_pdf(industry_key: str, negative: bool = False):
    """Serves a preloaded demo PDF (or the negative/missing-field test PDF) for an industry."""
    try:
        get_industry(industry_key)
    except KeyError:
        raise HTTPException(status_code=404, detail="Unknown industry")

    pdf_bytes = build_demo_pdf(industry_key, negative=negative)
    filename = f"{industry_key}_{'negative_test' if negative else 'demo'}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@app.post("/api/process")
async def process_document(industry: str = Form(...), file: UploadFile = File(...)):
    """
    Core pipeline: PDF -> extract text -> AI structured extraction -> deterministic validation.
    No data is persisted — the response is the entire record; the frontend keeps it in memory only.
    """
    try:
        get_industry(industry)
    except KeyError:
        raise HTTPException(status_code=400, detail="Unknown industry")

    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Unsupported file type. Please upload a PDF.")

    pdf_bytes = await file.read()

    try:
        text = extract_text(pdf_bytes)
    except PdfExtractionError as e:
        raise HTTPException(status_code=422, detail=str(e))

    try:
        extracted, ai_provider, fallback_used = extract_structured_data(industry, text)
    except AIExtractionError as e:
        raise HTTPException(status_code=502, detail=str(e))

    result = validate(industry, extracted)

    return JSONResponse({
        "industry": industry,
        "extracted": extracted,
        "validation": result["fields"],
        "overall": result["overall"],
        "ai_provider": ai_provider,
        "fallback_used": fallback_used,
    })


from pydantic import BaseModel
from typing import List, Optional

class ExportRequest(BaseModel):
    industry: str
    extracted: dict

@app.post("/api/export-pdf")
def export_pdf(req: ExportRequest):
    """
    Generates and returns an updated PDF document pre-filled with user inputs and corrections.
    """
    try:
        get_industry(req.industry)
    except KeyError:
        raise HTTPException(status_code=400, detail="Unknown industry")

    pdf_bytes = build_demo_pdf(req.industry, filled_values=req.extracted)
    filename = f"{req.industry}_updated.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


class CombinedExportRecord(BaseModel):
    industry: str
    extracted: dict
    sourceLabel: Optional[str] = None


class CombinedExportRequest(BaseModel):
    records: List[CombinedExportRecord]


@app.post("/api/export-combined-pdf")
def export_combined_pdf(req: CombinedExportRequest):
    """
    Generates one PDF that collects the data from every processed document
    passed in (e.g. the whole "Processed Documents" session list) so it can
    be downloaded and reviewed as a single file.
    """
    if not req.records:
        raise HTTPException(status_code=400, detail="No documents to export.")

    pdf_bytes = build_combined_pdf([r.dict() for r in req.records])
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="processed_documents_combined.pdf"'},
    )


class EmailPdfRequest(BaseModel):
    industry: str
    extracted: dict
    recipient: EmailStr
    filename: str | None = None


@app.post("/api/email-pdf")
def email_pdf(req: EmailPdfRequest):
    try:
        get_industry(req.industry)
    except KeyError:
        raise HTTPException(status_code=400, detail="Unknown industry")

    pdf_bytes = build_demo_pdf(req.industry, filled_values=req.extracted)
    filename = req.filename or f"{req.industry}_updated.pdf"
    try:
        send_pdf_email(
            recipient=str(req.recipient),
            subject=f"{req.industry.title()} document export",
            body="Attached is the generated document from AI Document Automation.",
            filename=filename,
            pdf_bytes=pdf_bytes,
        )
    except EmailDeliveryError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return {"ok": True, "message": f"PDF sent to {req.recipient}"}


@app.get("/api/health")
def health():
    return {"status": "ok"}
