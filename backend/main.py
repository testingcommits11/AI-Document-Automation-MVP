from __future__ import annotations

import os
from typing import List, Optional

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import (
    JSONResponse,
    Response,
)
from pydantic import (
    BaseModel,
    EmailStr,
    Field,
)

from ai_extraction import (
    AIExtractionError,
    extract_structured_data,
)

from auth import (
    JWT_EXPIRE_MINUTES,
    create_access_token,
    get_current_user,
    get_optional_user,
    hash_password,
    verify_password,
)

from database import (
    add_field,
    create_document,
    create_user,
    deactivate_field,
    delete_document,
    get_user_by_email,
    init_db,
    list_documents,
    list_fields,
    update_document,
    update_field,
)

from demo_pdfs import (
    build_combined_pdf,
    build_demo_pdf,
)

from email_service import (
    EmailDeliveryError,
    send_pdf_email,
)

from industries import (
    INDUSTRIES,
    get_industry,
)

from pdf_utils import (
    PdfExtractionError,
    extract_text,
)

from validation import (
    validate,
)


# ============================================================================
# INIT
# ============================================================================

init_db()

app = FastAPI(
    title="AI Document Automation MVP API",
)


# ============================================================================
# CORS
# ============================================================================

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


# ============================================================================
# AUTH MODELS
# ============================================================================

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(
        min_length=8,
        max_length=128,
    )


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(
        min_length=1,
        max_length=128,
    )


# ============================================================================
# REGISTER
# ============================================================================

@app.post("/api/auth/register")
def register(
    req: RegisterRequest,
):
    email = str(
        req.email,
    ).strip().lower()

    if get_user_by_email(
        email,
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "An account with this email already exists."
            ),
        )

    user = create_user(
        email,
        hash_password(
            req.password,
        ),
    )

    if not user:
        raise HTTPException(
            status_code=409,
            detail=(
                "An account with this email already exists."
            ),
        )

    token = create_access_token(
        int(user["id"]),
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": (
            JWT_EXPIRE_MINUTES * 60
        ),
        "user": {
            "id": user["id"],
            "email": user["email"],
        },
    }


# ============================================================================
# LOGIN
# ============================================================================

@app.post("/api/auth/login")
def login(
    req: LoginRequest,
):
    email = str(
        req.email,
    ).strip().lower()

    user = get_user_by_email(
        email,
    )

    if (
        not user
        or not verify_password(
            req.password,
            user["password_hash"],
        )
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    token = create_access_token(
        int(user["id"]),
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": (
            JWT_EXPIRE_MINUTES * 60
        ),
        "user": {
            "id": user["id"],
            "email": user["email"],
        },
    }


# ============================================================================
# CURRENT USER
# ============================================================================

@app.get("/api/auth/me")
def me(
    user=Depends(
        get_current_user,
    ),
):
    return {
        "user": {
            "id": user["id"],
            "email": user["email"],
        }
    }


# ============================================================================
# INDUSTRIES
# ============================================================================

@app.get("/api/industries")
def list_industries(
    user=Depends(
        get_current_user,
    ),
):
    user_id = int(
        user["id"],
    )

    return {
        key: {
            "label": config["label"],
            "doc_title": config["doc_title"],
            "fields": list_fields(
                key,
                user_id,
            ),
        }
        for key, config in INDUSTRIES.items()
    }


# ============================================================================
# FIELD SETTINGS
# ============================================================================

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


@app.get(
    "/api/fields/{industry_key}",
)
def get_fields(
    industry_key: str,
    user=Depends(
        get_current_user,
    ),
):
    try:
        get_industry(
            industry_key,
        )
    except KeyError:
        raise HTTPException(
            status_code=404,
            detail="Unknown industry",
        )

    return {
        "industry": industry_key,
        "fields": list_fields(
            industry_key,
            int(user["id"]),
        ),
    }


@app.post(
    "/api/fields/{industry_key}",
)
def create_field(
    industry_key: str,
    req: FieldCreateRequest,
    user=Depends(
        get_current_user,
    ),
):
    try:
        get_industry(
            industry_key,
        )

        return add_field(
            industry_key,
            req.label,
            req.type,
            req.key,
            int(user["id"]),
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


@app.patch(
    "/api/fields/{industry_key}/{field_id}",
)
def edit_field(
    industry_key: str,
    field_id: int,
    req: FieldUpdateRequest,
    user=Depends(
        get_current_user,
    ),
):
    try:
        get_industry(
            industry_key,
        )

        return update_field(
            industry_key,
            field_id,
            req.label,
            req.type,
            int(user["id"]),
        )

    except KeyError:
        raise HTTPException(
            status_code=404,
            detail="Unknown industry",
        )

    except PermissionError as exc:
        raise HTTPException(
            status_code=403,
            detail=str(exc),
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


@app.delete(
    "/api/fields/{industry_key}/{field_id}",
)
def delete_field(
    industry_key: str,
    field_id: int,
    user=Depends(
        get_current_user,
    ),
):
    try:
        get_industry(
            industry_key,
        )

        deactivate_field(
            industry_key,
            field_id,
            int(user["id"]),
        )

        return {
            "ok": True,
        }

    except KeyError:
        raise HTTPException(
            status_code=404,
            detail="Unknown industry",
        )

    except PermissionError as exc:
        raise HTTPException(
            status_code=403,
            detail=str(exc),
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )


# ============================================================================
# DOCUMENTS
# ============================================================================

@app.get("/api/documents")
def get_documents(
    user=Depends(
        get_current_user,
    ),
):
    return {
        "documents": list_documents(
            int(user["id"]),
        ),
    }


class DocumentUpdateRequest(BaseModel):
    extracted: dict

    validation: list[dict] | None = None

    overall: str | None = None


@app.delete(
    "/api/documents/{document_id}",
)
def remove_document(
    document_id: int,
    user=Depends(
        get_current_user,
    ),
):
    try:
        delete_document(
            user_id=int(
                user["id"],
            ),
            document_id=document_id,
        )

        return {
            "ok": True,
            "document_id": document_id,
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )


@app.patch(
    "/api/documents/{document_id}",
)
def edit_document(
    document_id: int,
    req: DocumentUpdateRequest,
    user=Depends(
        get_current_user,
    ),
):
    try:
        document = update_document(
            user_id=int(
                user["id"],
            ),
            document_id=document_id,
            extracted=req.extracted,
            validation=req.validation,
            overall=req.overall,
        )

        return document

    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )


# ============================================================================
# DEMO PDF
# ============================================================================

@app.get(
    "/api/demo/{industry_key}",
)
def get_demo_pdf(
    industry_key: str,
    negative: bool = False,
    user=Depends(
        get_current_user,
    ),
):
    try:
        get_industry(
            industry_key,
        )
    except KeyError:
        raise HTTPException(
            status_code=404,
            detail="Unknown industry",
        )

    pdf_bytes = build_demo_pdf(
        industry_key,
        negative=negative,
        user_id=int(
            user["id"],
        ),
    )

    filename = (
        f"{industry_key}_"
        f"{'negative_test' if negative else 'demo'}.pdf"
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition":
                f'inline; filename="{filename}"'
        },
    )


# ============================================================================
# PROCESS PDF
# ============================================================================

@app.post("/api/process")
async def process_document(
    industry: str = Form(...),
    file: UploadFile = File(...),
    user=Depends(
        get_current_user,
    ),
):
    try:
        meta = get_industry(
            industry,
        )
    except KeyError:
        raise HTTPException(
            status_code=400,
            detail="Unknown industry",
        )

    if (
        file.content_type
        != "application/pdf"
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file type. "
                "Please upload a PDF."
            ),
        )

    pdf_bytes = await file.read()

    try:
        text = extract_text(
            pdf_bytes,
        )
    except PdfExtractionError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        )

    user_id = int(
        user["id"],
    )

    try:
        (
            extracted,
            ai_provider,
            fallback_used,
        ) = extract_structured_data(
            industry,
            text,
            user_id=user_id,
        )
    except AIExtractionError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        )

    result = validate(
        industry,
        extracted,
        user_id=user_id,
    )

    # IMPORTANT:
    # Capture the exact schema used at processing time.
    field_schema = list_fields(
        industry,
        user_id,
    )

    document = create_document(
        user_id=user_id,
        industry=industry,
        source_label=(
            file.filename
            or "document.pdf"
        ),
        doc_title=meta["doc_title"],
        industry_label=meta["label"],
        extracted=extracted,
        validation=result["fields"],
        field_schema=field_schema,
        overall=result["overall"],
        ai_provider=ai_provider,
        fallback_used=fallback_used,
    )

    return JSONResponse(
        {
            "document_id":
                document["id"],
            "industry":
                industry,
            "extracted":
                extracted,
            "validation":
                result["fields"],
            "overall":
                result["overall"],
            "ai_provider":
                ai_provider,
            "fallback_used":
                fallback_used,
            "field_schema":
                field_schema,
        }
    )


# ============================================================================
# SINGLE PDF EXPORT
# ============================================================================

class ExportRequest(BaseModel):
    industry: str
    extracted: dict
    field_schema: list[dict] | None = None


@app.post(
    "/api/export-pdf",
)
def export_pdf(
    req: ExportRequest,
    user=Depends(
        get_current_user,
    ),
):
    try:
        get_industry(
            req.industry,
        )
    except KeyError:
        raise HTTPException(
            status_code=400,
            detail="Unknown industry",
        )

    pdf_bytes = build_demo_pdf(
        req.industry,
        filled_values=req.extracted,
        user_id=int(
            user["id"],
        ),
        field_schema=req.field_schema,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition":
                f'attachment; filename="{req.industry}_updated.pdf"'
        },
    )


# ============================================================================
# COMBINED EXPORT
# ============================================================================

class CombinedExportRecord(BaseModel):
    industry: str
    extracted: dict
    sourceLabel: Optional[str] = None
    fieldSchema: list[dict] | None = None


class CombinedExportRequest(BaseModel):
    records: List[
        CombinedExportRecord
    ]


@app.post(
    "/api/export-combined-pdf",
)
def export_combined_pdf(
    req: CombinedExportRequest,
    user=Depends(
        get_current_user,
    ),
):
    if not req.records:
        raise HTTPException(
            status_code=400,
            detail="No documents to export.",
        )

    pdf_bytes = build_combined_pdf(
        [
            record.model_dump()
            for record in req.records
        ],
        user_id=int(
            user["id"],
        ),
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition":
                'attachment; filename="processed_documents_combined.pdf"'
        },
    )


# ============================================================================
# EMAIL SINGLE PDF
# ============================================================================

class EmailPdfRequest(BaseModel):
    industry: str
    extracted: dict
    recipient: EmailStr
    filename: str | None = None
    field_schema: list[dict] | None = None


@app.post(
    "/api/email-pdf",
)
def email_pdf(
    req: EmailPdfRequest,
    user=Depends(
        get_current_user,
    ),
):
    try:
        get_industry(
            req.industry,
        )
    except KeyError:
        raise HTTPException(
            status_code=400,
            detail="Unknown industry",
        )

    pdf_bytes = build_demo_pdf(
        req.industry,
        filled_values=req.extracted,
        user_id=int(
            user["id"],
        ),
        field_schema=req.field_schema,
    )

    filename = (
        req.filename
        or f"{req.industry}_updated.pdf"
    )

    try:
        send_pdf_email(
            recipient=str(
                req.recipient,
            ),
            subject=(
                f"{req.industry.title()} "
                "document export"
            ),
            body=(
                "Attached is the generated "
                "document from "
                "AI Document Automation."
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
        "message":
            f"PDF sent to {req.recipient}",
    }


# ============================================================================
# EMAIL ALL
# ============================================================================

class EmailCombinedPdfRequest(BaseModel):
    records: List[
        CombinedExportRecord
    ]
    recipient: EmailStr


@app.post(
    "/api/email-combined-pdf",
)
def email_combined_pdf(
    req: EmailCombinedPdfRequest,
    user=Depends(
        get_current_user,
    ),
):
    if not req.records:
        raise HTTPException(
            status_code=400,
            detail="No documents to email.",
        )

    pdf_bytes = build_combined_pdf(
        [
            record.model_dump()
            for record in req.records
        ],
        user_id=int(
            user["id"],
        ),
    )

    try:
        send_pdf_email(
            recipient=str(
                req.recipient,
            ),
            subject=(
                "Processed Documents — "
                "Combined PDF"
            ),
            body=(
                "Attached is the combined PDF "
                "containing all processed "
                "documents from your account."
            ),
            filename=(
                "processed_documents_combined.pdf"
            ),
            pdf_bytes=pdf_bytes,
        )

    except EmailDeliveryError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        )

    return {
        "ok": True,
        "message":
            f"Combined PDF sent to {req.recipient}",
    }


# ============================================================================
# HEALTH
# ============================================================================

@app.get("/api/health")
def health():
    return {
        "status": "ok",
    }