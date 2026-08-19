from __future__ import annotations

from datetime import date, datetime

from database import list_fields
from industries import get_industry


ACCEPTED_DATE_FORMATS = [
    # ISO
    "%Y-%m-%d",

    # Numeric
    "%d-%m-%Y",
    "%d/%m/%Y",
    "%m/%d/%Y",
    "%Y/%m/%d",

    # Short month names
    "%d %b %Y",
    "%d-%b-%Y",
    "%d/%b/%Y",
    "%b %d %Y",
    "%b-%d-%Y",
    "%b/%d/%Y",

    # Full month names
    "%d %B %Y",
    "%d-%B-%Y",
    "%d/%B/%Y",
    "%B %d %Y",
    "%B-%d-%Y",
    "%B/%d/%Y",
]


def parse_date_value(
    value: str,
) -> date | None:
    value = (
        value or ""
    ).strip()

    if not value:
        return None

    for date_format in ACCEPTED_DATE_FORMATS:
        try:
            return datetime.strptime(
                value,
                date_format,
            ).date()
        except ValueError:
            continue

    return None


def _validate_type(
    value: str,
    field_type: str,
) -> str | None:
    value = (
        value or ""
    ).strip()

    if not value:
        return None

    # ------------------------------------------------------------------
    # NUMBER
    # ------------------------------------------------------------------
    if field_type == "number":
        normalized = (
            value
            .replace(",", "")
            .replace("$", "")
            .replace("₹", "")
            .replace("€", "")
            .replace("£", "")
            .replace(" ", "")
        )

        try:
            float(normalized)
        except ValueError:
            return "Expected a number."

        return None

    # ------------------------------------------------------------------
    # DATE
    # ------------------------------------------------------------------
    if field_type == "date":
        parsed_date = parse_date_value(
                value,
            )

        if parsed_date is None:
            return "Invalid date format."

        if parsed_date > date.today():
            return "Date cannot be in the future."

        return None

    # ------------------------------------------------------------------
    # TEXT
    # ------------------------------------------------------------------
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

        value = str(
            value
        ).strip()

        # Missing
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