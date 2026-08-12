import os
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse

from industries import INDUSTRIES, get_industry
from pdf_utils import extract_text, PdfExtractionError
from ai_extraction import extract_structured_data, AIExtractionError
from validation import validate
from demo_pdfs import build_demo_pdf, build_combined_pdf

app = FastAPI(title="AI Document Automation MVP API")

# In production, replace "*" with your deployed Vercel frontend URL.
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
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
            "fields": cfg["fields"],
        }
        for key, cfg in INDUSTRIES.items()
    }


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
        extracted = extract_structured_data(industry, text)
    except AIExtractionError as e:
        raise HTTPException(status_code=502, detail=str(e))

    result = validate(industry, extracted)

    return JSONResponse({
        "industry": industry,
        "extracted": extracted,
        "validation": result["fields"],
        "overall": result["overall"],
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


@app.get("/api/health")
def health():
    return {"status": "ok"}
