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
