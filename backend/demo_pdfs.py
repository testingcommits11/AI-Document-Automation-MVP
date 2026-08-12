"""
Generates the three preloaded demo PDFs, and a negative/missing-field test PDF,
on the fly with reportlab. Keeps the repo free of binary assets while still
satisfying "provide one preloaded demo PDF per industry" + "one negative test PDF".
"""
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from industries import get_industry


def build_demo_pdf(industry_key: str, negative: bool = False, filled_values: dict = None) -> bytes:
    cfg = get_industry(industry_key)
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4

    c.setFont("Helvetica-Bold", 16)
    c.drawString(60, height - 70, cfg["doc_title"])
    c.setStrokeColorRGB(0.7, 0.7, 0.7)
    c.line(60, height - 82, width - 60, height - 82)

    y = height - 120
    c.setFont("Helvetica", 12)
    for f in cfg["fields"]:
        if filled_values and f["key"] in filled_values:
            value = str(filled_values[f["key"]])
        else:
            omit = negative and f["key"] == cfg["negative_field"]
            value = "" if omit else str(cfg["demo_values"].get(f["key"], ""))
            
        c.setFont("Helvetica-Bold", 12)
        c.drawString(60, y, f["label"] + ":")
        c.setFont("Helvetica", 12)
        c.drawString(220, y, value)
        y -= 32

    c.setFont("Helvetica", 9)
    c.setFillColorRGB(0.55, 0.55, 0.55)
    is_edited = filled_values is not None
    if is_edited:
        label = "Updated Document with User Filled Data"
    elif negative:
        label = "Fictional demo document — missing-field test"
    else:
        label = "Fictional demo document"
        
    c.drawString(60, 60, f"{label} — AI Document Automation MVP")

    c.showPage()
    c.save()
    return buf.getvalue()


def build_combined_pdf(records: list) -> bytes:
    """
    Builds a single PDF that collects the data from multiple processed documents
    (one section per record, paginated as needed). Used by the "Processed Documents"
    list to let a user download everything gathered in one session as one file.
    """
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    margin_bottom = 70

    def draw_header():
        c.setFont("Helvetica-Bold", 18)
        c.drawString(60, height - 70, "Processed Documents — Combined Summary")
        c.setStrokeColorRGB(0.7, 0.7, 0.7)
        c.line(60, height - 82, width - 60, height - 82)
        c.setFont("Helvetica", 9)
        c.setFillColorRGB(0.55, 0.55, 0.55)
        c.drawString(60, 60, f"{len(records)} document(s) — AI Document Automation MVP")
        c.setFillColorRGB(0, 0, 0)

    draw_header()
    y = height - 120

    for idx, record in enumerate(records):
        industry_key = record.get("industry")
        extracted = record.get("extracted") or {}
        try:
            cfg = get_industry(industry_key)
        except KeyError:
            continue

        section_height = 40 + 28 * len(cfg["fields"])
        if y - section_height < margin_bottom:
            c.showPage()
            draw_header()
            y = height - 120

        c.setFont("Helvetica-Bold", 13)
        c.setFillColorRGB(0.1, 0.1, 0.1)
        title = record.get("sourceLabel") or cfg["doc_title"]
        c.drawString(60, y, f"{idx + 1}. {cfg['doc_title']} ({cfg['label']})")
        y -= 16
        c.setFont("Helvetica-Oblique", 9)
        c.setFillColorRGB(0.45, 0.45, 0.45)
        c.drawString(60, y, f"Source: {title}")
        y -= 20

        c.setFont("Helvetica", 11)
        for f in cfg["fields"]:
            value = str(extracted.get(f["key"], "") or "—")
            c.setFillColorRGB(0.2, 0.2, 0.2)
            c.setFont("Helvetica-Bold", 11)
            c.drawString(70, y, f["label"] + ":")
            c.setFont("Helvetica", 11)
            c.drawString(230, y, value)
            y -= 22

        y -= 18
        c.setStrokeColorRGB(0.85, 0.85, 0.85)
        c.line(60, y, width - 60, y)
        y -= 20

    c.showPage()
    c.save()
    return buf.getvalue()
