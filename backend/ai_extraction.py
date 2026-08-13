"""
AI extraction with a provider fallback chain.

Primary provider: Google Gemini.
Fallback provider: OpenRouter (defaults to the free-model router).

The extraction contract is intentionally identical across providers: both must
return a JSON object containing exactly the fields for the selected industry.
"""
import json
import os
import urllib.error
import urllib.request
from dotenv import load_dotenv

from google import genai
from google.genai import types
from industries import get_industry
from database import list_fields
from openrouter_config import (
    OPENROUTER_APP_NAME,
    OPENROUTER_FALLBACK_MODELS,
    OPENROUTER_MAX_TOKENS,
    OPENROUTER_MODEL,
    OPENROUTER_TIMEOUT,
    OPENROUTER_URL,
    OPENROUTER_HTTP_REFERER,
)


load_dotenv()

_client: genai.Client | None = None

# Keep model names configurable so you can change them without code changes.
MODEL_CANDIDATES = [
    model.strip()
    for model in os.getenv(
        "GEMINI_MODELS",
        "gemini-3.1-flash-lite,gemini-3-flash-preview",
    ).split(",")
    if model.strip()
]

class AIExtractionError(Exception):
    pass


class ProviderExtractionError(Exception):
    pass


# This is intentionally a minimal schema accepted by Gemini's responseSchema.
# Do not add JSON-Schema-only keywords such as additionalProperties here.
def build_response_schema(industry_key: str) -> dict:
    fields = list_fields(industry_key)
    properties = {f["key"]: {"type": "string"} for f in fields}
    return {
        "type": "object",
        "properties": properties,
        "required": [f["key"] for f in fields],
    }


def get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ProviderExtractionError("GEMINI_API_KEY is not set on the server.")
        _client = genai.Client(api_key=api_key)
    return _client


def _parse_json_object(text: str) -> dict:
    if not text or not text.strip():
        raise ProviderExtractionError("Provider returned an empty response.")

    candidate = text.strip()

    # Some OpenRouter free models may still wrap JSON in Markdown fences even
    # when JSON-schema output is requested. Remove those fences before parsing.
    if candidate.startswith("```json") and candidate.endswith("```"):
        candidate = candidate[7:-3].strip()
    elif candidate.startswith("```") and candidate.endswith("```"):
        candidate = candidate[3:-3].strip()

    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError:
        # Be tolerant of a response containing a short preamble around the
        # JSON object, while still requiring the actual payload to be valid.
        start = candidate.find("{")
        end = candidate.rfind("}")
        if start >= 0 and end > start:
            try:
                parsed = json.loads(candidate[start : end + 1])
            except json.JSONDecodeError as exc:
                raise ProviderExtractionError(
                    f"Provider returned invalid JSON: {exc}"
                ) from exc
        else:
            raise ProviderExtractionError(
                "Provider returned invalid JSON: no JSON object found."
            )

    if not isinstance(parsed, dict):
        raise ProviderExtractionError("Provider returned JSON that is not an object.")

    return parsed


def _validate_extracted_shape(industry_key: str, data: dict) -> dict:
    expected = [field["key"] for field in list_fields(industry_key)]
    missing = [key for key in expected if key not in data]
    if missing:
        raise ProviderExtractionError(
            "Provider response is missing required fields: " + ", ".join(missing)
        )

    # Normalize values to strings because the frontend/validation layer expects strings.
    return {key: "" if data[key] is None else str(data[key]) for key in expected}


def _extract_with_gemini(industry_key: str, pdf_text: str) -> dict:
    cfg = get_industry(industry_key)
    fields = list_fields(industry_key)
    field_list = ", ".join(f["key"] for f in fields)
    system_prompt = (
        f"You extract structured data from a {cfg['document_type']} document. "
        f"Return exactly these fields: {field_list}. "
        "If a field is not present in the document, return an empty string for it. "
        "Never invent values that are not in the text."
    )

    client = get_client()
    last_err: Exception | None = None

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
            return _validate_extracted_shape(
                industry_key,
                _parse_json_object(response.text),
            )
        except Exception as exc:
            last_err = exc

    raise ProviderExtractionError(
        "All configured Gemini models failed. Last error: " + str(last_err)
    )


def _openrouter_request(payload: dict, api_key: str) -> dict:
    request = urllib.request.Request(
        OPENROUTER_URL,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": OPENROUTER_HTTP_REFERER,
            "X-OpenRouter-Title": OPENROUTER_APP_NAME,
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=OPENROUTER_TIMEOUT) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise ProviderExtractionError(f"HTTP {exc.code}: {body}") from exc
    except urllib.error.URLError as exc:
        raise ProviderExtractionError(f"Network error: {exc.reason}") from exc
    except TimeoutError as exc:
        raise ProviderExtractionError("Request timed out.") from exc

    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ProviderExtractionError("OpenRouter returned invalid JSON.") from exc


def _extract_with_openrouter(industry_key: str, pdf_text: str) -> dict:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise ProviderExtractionError("OPENROUTER_API_KEY is not set on the server.")

    cfg = get_industry(industry_key)
    fields = list_fields(industry_key)
    field_list = ", ".join(f["key"] for f in fields)
    schema = build_response_schema(industry_key)
    system_prompt = (
        f"You extract structured data from a {cfg['document_type']} document. "
        f"Return exactly these fields: {field_list}. "
        "If a field is not present in the document, return an empty string for it. "
        "Never invent values that are not in the text."
    )

    # openrouter/free is intentionally first. Explicit free models can be added
    # through OPENROUTER_FALLBACK_MODELS if you want deterministic fallbacks.
    models = [OPENROUTER_MODEL, *OPENROUTER_FALLBACK_MODELS]
    last_err: Exception | None = None

    for model in dict.fromkeys(models):
        # OpenRouter requires a stricter schema than Gemini. In particular,
        # additionalProperties=false is valid here and helps compatible free
        # endpoints enforce the exact extraction shape.
        openrouter_schema = {**schema, "additionalProperties": False}

        request_variants = [
            {
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {
                        "name": "document_extraction",
                        "strict": True,
                        "schema": openrouter_schema,
                    },
                },
                "plugins": [{"id": "response-healing"}],
                "provider": {"require_parameters": True},
            },
            {
                # Compatibility retry for OpenRouter models/endpoints that
                # accept JSON objects but reject full json_schema.
                "response_format": {"type": "json_object"},
                "plugins": [{"id": "response-healing"}],
                "provider": {"require_parameters": True},
            },
        ]

        try:
            last_variant_err: Exception | None = None
            for variant in request_variants:
                payload = {
                    "model": model,
                    "temperature": 0,
                    "stream": False,
                    "max_tokens": OPENROUTER_MAX_TOKENS,
                    "messages": [
                        {"role": "system", "content": system_prompt + " Return JSON only, with no markdown or explanation."},
                        {"role": "user", "content": f"Document text:\n\n{pdf_text}"},
                    ],
                    **variant,
                }

                try:
                    response = _openrouter_request(payload, api_key)

                    if response.get("error"):
                        raise ProviderExtractionError(
                            "OpenRouter API error: " + json.dumps(response["error"], ensure_ascii=False)
                        )

                    choices = response.get("choices") or []
                    if not choices:
                        raise ProviderExtractionError("OpenRouter returned no choices.")

                    message = choices[0].get("message") or {}
                    content = message.get("content")

                    if content is None:
                        refusal = message.get("refusal")
                        finish_reason = choices[0].get("finish_reason")
                        detail = []
                        if refusal:
                            detail.append(f"refusal={refusal}")
                        if finish_reason:
                            detail.append(f"finish_reason={finish_reason}")
                        raise ProviderExtractionError(
                            "OpenRouter returned no message content"
                            + (f" ({', '.join(detail)})" if detail else ".")
                        )

                    # OpenAI-compatible APIs may return content as text or as a
                    # list of content parts. Normalize both forms.
                    if isinstance(content, list):
                        parts = []
                        for part in content:
                            if isinstance(part, dict) and part.get("text"):
                                parts.append(str(part["text"]))
                            elif isinstance(part, str):
                                parts.append(part)
                        content = "".join(parts)

                    return _validate_extracted_shape(
                        industry_key,
                        _parse_json_object(content),
                    )
                except Exception as exc:
                    last_variant_err = exc

            if last_variant_err is not None:
                raise last_variant_err

        except Exception as exc:
            last_err = exc

    raise ProviderExtractionError(
        "All configured OpenRouter models failed. Last error: " + str(last_err)
    )


def extract_structured_data(industry_key: str, pdf_text: str) -> tuple[dict, str, bool]:
    """Run Gemini first, then OpenRouter if Gemini fails for any reason."""
    errors: list[str] = []

    try:
        return _extract_with_gemini(industry_key, pdf_text), "gemini", False
    except Exception as exc:
        errors.append(f"Gemini: {exc}")

    try:
        return _extract_with_openrouter(industry_key, pdf_text), "openrouter", True
    except Exception as exc:
        errors.append(f"OpenRouter: {exc}")

    raise AIExtractionError(
        "AI extraction failed after trying all configured providers. " + " | ".join(errors)
    )
