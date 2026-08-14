from __future__ import annotations

from datetime import date, datetime

from database import list_fields
from industries import get_industry


def _validate_type(
    value: str,
    field_type: str,
) -> str | None:
    value = (value or "").strip()

    if not value:
        return None

    # ------------------------------------------------------------------------
    # NUMBER
    # ------------------------------------------------------------------------
    if field_type == "number":
        normalized = value.replace(
            ",",
            "",
        ).replace(
            "$",
            "",
        ).replace(
            " ",
            "",
        )

        try:
            float(normalized)
        except ValueError:
            return "Expected a number."

    # ------------------------------------------------------------------------
    # DATE
    # ------------------------------------------------------------------------
    elif field_type == "date":
        accepted_formats = [
            "%Y-%m-%d",
            "%d-%m-%Y",
            "%d/%m/%Y",
            "%m/%d/%Y",
            "%Y/%m/%d",
        ]

        parsed_date: date | None = None

        for date_format in accepted_formats:
            try:
                parsed_date = datetime.strptime(
                    value,
                    date_format,
                ).date()
                break
            except ValueError:
                continue

        if parsed_date is None:
            return "Invalid date."

        today = date.today()

        if parsed_date > today:
            return "Date cannot be in the future."

    return None


def validate(
    industry_key: str,
    extracted: dict,
    user_id: int | None = None,
) -> dict:
    get_industry(
        industry_key,
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
                "is_default": field.get(
                    "is_default",
                    False,
                ),
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