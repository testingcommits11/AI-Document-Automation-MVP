"""
Text extraction for text-based PDFs. OCR is intentionally out of scope for the MVP.
"""
from io import BytesIO
from pypdf import PdfReader


class PdfExtractionError(Exception):
    pass


def extract_text(pdf_bytes: bytes) -> str:
    try:
        reader = PdfReader(BytesIO(pdf_bytes))
    except Exception as e:
        raise PdfExtractionError(f"Could not read PDF: {e}")

    if len(reader.pages) == 0:
        raise PdfExtractionError("PDF has no pages.")

    text_parts = []
    for page in reader.pages:
        text_parts.append(page.extract_text() or "")

    text = "\n".join(text_parts).strip()

    if not text:
        raise PdfExtractionError(
            "No extractable text found. This MVP supports text-based PDFs only — "
            "scanned/image PDFs need OCR, which is out of scope."
        )
    return text
