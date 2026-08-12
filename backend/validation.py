"""
Deterministic, non-AI validation of extracted fields.
This is what proves the app isn't blindly trusting whatever the model returns.
"""
import re
from industries import get_industry

DATE_HINT = re.compile(r"\d")
NUMBER_HINT = re.compile(r"[\d.,$]")


def validate(industry_key: str, extracted: dict) -> dict:
    cfg = get_industry(industry_key)
    field_results = []

    for f in cfg["fields"]:
        raw_value = extracted.get(f["key"], "")
        value = str(raw_value).strip() if raw_value is not None else ""

        if not value:
            status = "missing"
        elif f["type"] == "number" and not NUMBER_HINT.search(value):
            status = "invalid"
        elif f["type"] == "date" and not DATE_HINT.search(value):
            status = "invalid"
        else:
            status = "valid"

        field_results.append({
            "key": f["key"],
            "label": f["label"],
            "value": value,
            "ok": status == "valid",   # kept for backward compatibility with existing UI
            "status": status,          # "valid" | "missing" | "invalid"
        })

    overall = "ready" if all(r["ok"] for r in field_results) else "review"
    return {"fields": field_results, "overall": overall}
