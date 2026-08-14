from __future__ import annotations

from datetime import datetime

from database import list_fields
from industries import get_industry


def _validate_type(
    value: str,
    field_type: str,
) -> str | None:
    value = (value or "").strip()

    if not value:
        return None

    if field_type == "number":
        try:
            float(
                value.replace(",", "")
            )
        except ValueError:
            return "Expected a number."

    elif field_type == "date":
        # Accept common date-like values. AI output remains text.
        accepted_formats = [
            "%Y-%m-%d",
            "%d-%m-%Y",
            "%d/%m/%Y",
            "%m/%d/%Y",
            "%Y/%m/%d",
        ]

        parsed = False

        for date_format in accepted_formats:
            try:
                datetime.strptime(
                    value,
                    date_format,
                )
                parsed = True
                break
            except ValueError:
                continue

        # Do not reject natural-language dates produced by the AI.
        if not parsed:
            return None

    return None


def validate(
    industry_key: str,
    extracted: dict,
    user_id: int | None = None,
) -> dict:
    get_industry(
        industry_key
    )

    fields = list_fields(
        industry_key,
        user_id,
    )

    validation_fields = []

    overall_ready = True

    for field in fields:
        key = field["key"]

        value = extracted.get(
            key,
            "",
        )

        if value is None:
            value = ""

        value = str(value).strip()

        if not value:
            status = "missing"
            message = "Field is missing."
            overall_ready = False
        else:
            type_error = _validate_type(
                value,
                field["type"],
            )

            if type_error:
                status = "invalid"
                message = type_error
                overall_ready = False
            else:
                status = "valid"
                message = "Field is valid."

        validation_fields.append(
            {
                "key": key,
                "label": field["label"],
                "type": field["type"],
                "value": value,
                "status": status,
                "message": message,
                "is_default": field[
                    "is_default"
                ],
            }
        )

    return {
        "fields": validation_fields,
        "overall": (
            "ready"
            if overall_ready
            else "review"
        ),
    }