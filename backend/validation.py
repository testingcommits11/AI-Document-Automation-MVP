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
        ok = len(value) > 0

        if ok and f["type"] == "number":
            ok = bool(NUMBER_HINT.search(value))
        if ok and f["type"] == "date":
            ok = bool(DATE_HINT.search(value))

        field_results.append({
            "key": f["key"],
            "label": f["label"],
            "value": value,
            "ok": ok,
        })

    overall = "ready" if all(r["ok"] for r in field_results) else "review"
    return {"fields": field_results, "overall": overall}
