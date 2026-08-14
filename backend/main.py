import os
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel, EmailStr, Field

from industries import INDUSTRIES, get_industry
from pdf_utils import extract_text, PdfExtractionError
from ai_extraction import extract_structured_data, AIExtractionError
from validation import validate
from demo_pdfs import build_demo_pdf, build_combined_pdf
from database import (
    init_db,
    list_fields,
    add_field,
    update_field,
    deactivate_field,
)
from email_service import send_pdf_email, EmailDeliveryError


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

init_db()


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="AI Document Automation MVP API"
)


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

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


# ===========================================================================
# INDUSTRIES
# ===========================================================================

@app.get("/api/industries")
def list_industries():
    """
    Return industry configuration and the current dynamic field schema.
    """

    return {
        key: {
            "label": cfg["label"],
            "doc_title": cfg["doc_title"],
            "fields": list_fields(key),
        }
        for key, cfg in INDUSTRIES.items()
    }


# ===========================================================================
# DYNAMIC FIELDS
# ===========================================================================

class FieldCreateRequest(BaseModel):
    label: str = Field(
        min_length=1,
        max_length=120,
    )

    type: str = Field(
        default="text",
    )

    key: str | None = Field(
        default=None,
        max_length=100,
    )


class FieldUpdateRequest(BaseModel):
    label: str = Field(
        min_length=1,
        max_length=120,
    )

    type: str = Field(
        default="text",
    )


@app.get("/api/fields/{industry_key}")
def get_fields(industry_key: str):
    try:
        get_industry(industry_key)
    except KeyError:
        raise HTTPException(
            status_code=404,
            detail="Unknown industry",
        )

    return {
        "industry": industry_key,
        "fields": list_fields(industry_key),
    }


@app.post("/api/fields/{industry_key}")
def create_field(
    industry_key: str,
    req: FieldCreateRequest,
):
    try:
        get_industry(industry_key)

        return add_field(
            industry_key,
            req.label,
            req.type,
            req.key,
        )

    except KeyError:
        raise HTTPException(
            status_code=404,
            detail="Unknown industry",
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


@app.patch("/api/fields/{industry_key}/{field_id}")
def edit_field(
    industry_key: str,
    field_id: int,
    req: FieldUpdateRequest,
):
    try:
        get_industry(industry_key)

        return update_field(
            industry_key,
            field_id,
            req.label,
            req.type,
        )

    except KeyError:
        raise HTTPException(
            status_code=404,
            detail="Unknown industry",
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


@app.delete("/api/fields/{industry_key}/{field_id}")
def delete_field(
    industry_key: str,
    field_id: int,
):
    try:
        get_industry(industry_key)

        deactivate_field(
            industry_key,
            field_id,
        )

        return {
            "ok": True,
        }

    except KeyError:
        raise HTTPException(
            status_code=404,
            detail="Unknown industry",
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )


# ===========================================================================
# DEMO PDF
# ===========================================================================

@app.get("/api/demo/{industry_key}")
def get_demo_pdf(
    industry_key: str,
    negative: bool = False,
):
    """
    Serve a demo PDF or negative/missing-field test PDF.
    """

    try:
        get_industry(industry_key)
    except KeyError:
        raise HTTPException(
            status_code=404,
            detail="Unknown industry",
        )

    pdf_bytes = build_demo_pdf(
        industry_key,
        negative=negative,
    )

    filename = (
        f"{industry_key}_"
        f"{'negative_test' if negative else 'demo'}.pdf"
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'inline; filename="{filename}"'
            )
        },
    )


# ===========================================================================
# PROCESS DOCUMENT
# ===========================================================================

@app.post("/api/process")
async def process_document(
    industry: str = Form(...),
    file: UploadFile = File(...),
):
    """
    PDF -> text extraction -> AI extraction -> validation.
    """

    try:
        get_industry(industry)
    except KeyError:
        raise HTTPException(
            status_code=400,
            detail="Unknown industry",
        )

    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file type. "
                "Please upload a PDF."
            ),
        )

    pdf_bytes = await file.read()

    # PDF extraction
    try:
        text = extract_text(pdf_bytes)
    except PdfExtractionError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        )

    # AI extraction
    try:
        extracted, ai_provider, fallback_used = (
            extract_structured_data(
                industry,
                text,
            )
        )
    except AIExtractionError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        )

    # Validation
    result = validate(
        industry,
        extracted,
    )

    return JSONResponse(
        {
            "industry": industry,
            "extracted": extracted,
            "validation": result["fields"],
            "overall": result["overall"],
            "ai_provider": ai_provider,
            "fallback_used": fallback_used,
        }
    )


# ===========================================================================
# EXPORT SINGLE PDF
# ===========================================================================

class ExportRequest(BaseModel):
    industry: str
    extracted: dict


@app.post("/api/export-pdf")
def export_pdf(req: ExportRequest):
    """
    Generate one updated PDF using the user's extracted/corrected values.
    """

    try:
        get_industry(req.industry)
    except KeyError:
        raise HTTPException(
            status_code=400,
            detail="Unknown industry",
        )

    pdf_bytes = build_demo_pdf(
        req.industry,
        filled_values=req.extracted,
    )

    filename = (
        f"{req.industry}_updated.pdf"
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"'
            )
        },
    )


# ===========================================================================
# COMBINED PDF
# ===========================================================================

class CombinedExportRecord(BaseModel):
    industry: str
    extracted: dict
    sourceLabel: Optional[str] = None


class CombinedExportRequest(BaseModel):
    records: List[CombinedExportRecord]


@app.post("/api/export-combined-pdf")
def export_combined_pdf(
    req: CombinedExportRequest,
):
    """
    Generate one combined PDF from all processed session records.
    """

    if not req.records:
        raise HTTPException(
            status_code=400,
            detail="No documents to export.",
        )

    pdf_bytes = build_combined_pdf(
        [
            record.model_dump()
            for record in req.records
        ]
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                'attachment; '
                'filename="processed_documents_combined.pdf"'
            )
        },
    )


# ===========================================================================
# EMAIL SINGLE PDF
# ===========================================================================

class EmailPdfRequest(BaseModel):
    industry: str
    extracted: dict
    recipient: EmailStr
    filename: str | None = None


@app.post("/api/email-pdf")
def email_pdf(req: EmailPdfRequest):
    """
    Generate one PDF and send it as an email attachment.
    """

    try:
        get_industry(req.industry)
    except KeyError:
        raise HTTPException(
            status_code=400,
            detail="Unknown industry",
        )

    pdf_bytes = build_demo_pdf(
        req.industry,
        filled_values=req.extracted,
    )

    filename = (
        req.filename
        or f"{req.industry}_updated.pdf"
    )

    try:
        send_pdf_email(
            recipient=str(req.recipient),
            subject=(
                f"{req.industry.title()} "
                "document export"
            ),
            body=(
                "Attached is the generated document "
                "from AI Document Automation."
            ),
            filename=filename,
            pdf_bytes=pdf_bytes,
        )

    except EmailDeliveryError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        )

    return {
        "ok": True,
        "message": (
            f"PDF sent to {req.recipient}"
        ),
    }


# ===========================================================================
# EMAIL ALL / COMBINED PDF
# ===========================================================================

class EmailCombinedPdfRequest(BaseModel):
    records: List[CombinedExportRecord]
    recipient: EmailStr


@app.post("/api/email-combined-pdf")
def email_combined_pdf(
    req: EmailCombinedPdfRequest,
):
    """
    Generate the same combined PDF used by Download All
    and send it as one email attachment.
    """

    if not req.records:
        raise HTTPException(
            status_code=400,
            detail="No documents to email.",
        )

    pdf_bytes = build_combined_pdf(
        [
            record.model_dump()
            for record in req.records
        ]
    )

    filename = (
        "processed_documents_combined.pdf"
    )

    try:
        send_pdf_email(
            recipient=str(req.recipient),
            subject=(
                "Processed Documents — "
                "Combined PDF"
            ),
            body=(
                "Attached is the combined PDF "
                "containing all processed documents "
                "from your current session."
            ),
            filename=filename,
            pdf_bytes=pdf_bytes,
        )

    except EmailDeliveryError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        )

    return {
        "ok": True,
        "message": (
            f"Combined PDF sent to "
            f"{req.recipient}"
        ),
    }


# ===========================================================================
# HEALTH
# ===========================================================================

@app.get("/api/health")
def health():
    return {
        "status": "ok",
    }