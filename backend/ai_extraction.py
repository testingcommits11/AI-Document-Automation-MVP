"""
Calls Gemini to turn raw PDF text into structured JSON for a given industry schema.
Uses Gemini's structured output mode (response_mime_type=application/json +
response_schema) so the model is constrained to return exactly the fields we expect.

Gemini API keys are free to create (Google AI Studio, no credit card) and the
Flash model used here has a genuinely free daily quota — good fit for an MVP demo.
"""
import json
import os
from dotenv import load_dotenv

from google import genai
from google.genai import types
from industries import get_industry


load_dotenv()

_client: genai.Client | None = None

MODEL_CANDIDATES = ["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.5-flash"]


def get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not set on the server.")
        _client = genai.Client(api_key=api_key)
    return _client


class AIExtractionError(Exception):
    pass


def build_response_schema(industry_key: str) -> dict:
    cfg = get_industry(industry_key)
    properties = {f["key"]: {"type": "string"} for f in cfg["fields"]}
    return {
        "type": "object",
        "properties": properties,
        "required": [f["key"] for f in cfg["fields"]],
    }


def extract_structured_data(industry_key: str, pdf_text: str) -> dict:
    cfg = get_industry(industry_key)
    field_list = ", ".join(f["key"] for f in cfg["fields"])

    system_prompt = (
        f"You extract structured data from a {cfg['document_type']} document. "
        f"Return exactly these fields: {field_list}. "
        "If a field is not present in the document, return an empty string for it. "
        "Never invent values that are not in the text."
    )

    client = get_client()
    last_err = None

    for model in MODEL_CANDIDATES:
        try:
            response = client.models.generate_content(
                model=model,
                contents=f"Document text:\n\n{pdf_text}",
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="application/json",
                    response_schema=build_response_schema(industry_key),
                    temperature=0,
                ),
            )
            return json.loads(response.text)
        except Exception as e:
            last_err = e
            continue

    raise AIExtractionError(f"AI extraction failed: {last_err}")

