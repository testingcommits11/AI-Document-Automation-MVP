"""PDF generation using a per-document field-schema snapshot when available."""

from __future__ import annotations

from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from database import list_fields
from industries import get_industry


def build_demo_pdf(
    industry_key: str,
    negative: bool = False,
    filled_values: dict | None = None,
    user_id: int | None = None,
    field_schema: list[dict] | None = None,
) -> bytes:
    cfg = get_industry(industry_key)
    fields = field_schema if field_schema is not None else list_fields(industry_key, user_id)
    filled_values = filled_values or {}

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    top_y = height - 70
    bottom_y = 70
    line_height = 32

    def draw_header() -> None:
        pdf.setFillColorRGB(0, 0, 0)
        pdf.setFont("Helvetica-Bold", 16)
        pdf.drawString(60, top_y, cfg["doc_title"])
        pdf.setStrokeColorRGB(0.7, 0.7, 0.7)
        pdf.line(60, top_y - 12, width - 60, top_y - 12)

    draw_header()
    y = height - 120

    for field in fields:
        if y < bottom_y:
            pdf.showPage()
            draw_header()
            y = height - 120

        field_key = field["key"]
        if field_key in filled_values:
            value = str(filled_values[field_key] or "")
        else:
            is_negative = negative and field_key == cfg.get("negative_field")
            value = "" if is_negative else str(cfg.get("demo_values", {}).get(field_key, ""))

        pdf.setFillColorRGB(0, 0, 0)
        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(60, y, f"{field['label']}:")
        pdf.setFont("Helvetica", 12)
        pdf.drawString(220, y, value)
        y -= line_height

    pdf.setFont("Helvetica", 9)
    pdf.setFillColorRGB(0.55, 0.55, 0.55)
    if filled_values:
        footer = "Updated Document with User Filled Data"
    elif negative:
        footer = "Fictional demo document — missing-field test"
    else:
        footer = "Fictional demo document"

    pdf.drawString(60, 40, f"{footer} — AI Document Automation MVP")
    pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def build_combined_pdf(records: list, user_id: int | None = None) -> bytes:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    top_y = height - 70
    bottom_y = 80
    line_height = 22

    def draw_header() -> None:
        pdf.setFillColorRGB(0, 0, 0)
        pdf.setFont("Helvetica-Bold", 18)
        pdf.drawString(60, top_y, "Processed Documents — Combined Summary")
        pdf.setStrokeColorRGB(0.7, 0.7, 0.7)
        pdf.line(60, top_y - 12, width - 60, top_y - 12)

    draw_header()
    y = height - 120

    for index, record in enumerate(records):
        industry_key = record.get("industry")
        extracted = record.get("extracted") or {}
        try:
            cfg = get_industry(industry_key)
        except KeyError:
            continue

        # Use the historical schema stored with this document.
        # Fall back only for legacy records that predate snapshots.
        fields = record.get("fieldSchema") or list_fields(industry_key, user_id)

        if y < bottom_y + 100:
            pdf.showPage()
            draw_header()
            y = height - 120

        pdf.setFillColorRGB(0.1, 0.1, 0.1)
        pdf.setFont("Helvetica-Bold", 13)
        pdf.drawString(60, y, f"{index + 1}. {cfg['doc_title']} ({cfg['label']})")
        y -= 16

        source_label = record.get("sourceLabel") or cfg["doc_title"]
        pdf.setFont("Helvetica-Oblique", 9)
        pdf.setFillColorRGB(0.45, 0.45, 0.45)
        pdf.drawString(60, y, f"Source: {source_label}")
        y -= 24

        for field in fields:
            if y < bottom_y:
                pdf.showPage()
                draw_header()
                y = height - 120

            value = str(extracted.get(field["key"], "") or "—")
            pdf.setFillColorRGB(0.2, 0.2, 0.2)
            pdf.setFont("Helvetica-Bold", 11)
            pdf.drawString(70, y, f"{field['label']}:")
            pdf.setFont("Helvetica", 11)
            pdf.drawString(230, y, value)
            y -= line_height

        y -= 18
        pdf.setStrokeColorRGB(0.85, 0.85, 0.85)
        pdf.line(60, y, width - 60, y)
        y -= 20

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()