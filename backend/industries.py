"""
Single source of truth for the three industry configurations.
Add a new industry by adding one entry here — no other code changes needed.
"""

INDUSTRIES = {
    "insurance": {
        "label": "Insurance",
        "document_type": "insurance_claim",
        "doc_title": "Simple Insurance Claim Form",
        "fields": [
            {"key": "customer_name", "label": "Customer Name", "type": "text"},
            {"key": "policy_number", "label": "Policy Number", "type": "text"},
            {"key": "accident_date", "label": "Accident Date", "type": "date"},
            {"key": "claim_type", "label": "Claim Type", "type": "text"},
        ],
        "demo_values": {
            "customer_name": "John Smith",
            "policy_number": "POL12345",
            "accident_date": "10 Aug 2026",
            "claim_type": "Car Accident",
        },
        "negative_field": "accident_date",
    },
    "finance": {
        "label": "Finance",
        "document_type": "expense_claim",
        "doc_title": "Simple Employee Expense Claim",
        "fields": [
            {"key": "employee_name", "label": "Employee Name", "type": "text"},
            {"key": "amount", "label": "Amount", "type": "number"},
            {"key": "date", "label": "Date", "type": "date"},
            {"key": "category", "label": "Category", "type": "text"},
        ],
        "demo_values": {
            "employee_name": "Sarah Jones",
            "amount": "$250",
            "date": "8 Aug 2026",
            "category": "Travel",
        },
        "negative_field": "category",
    },
    "healthcare": {
        "label": "Healthcare",
        "document_type": "patient_registration",
        "doc_title": "Simple Patient Registration Form",
        "fields": [
            {"key": "patient_name", "label": "Patient Name", "type": "text"},
            {"key": "date_of_birth", "label": "Date of Birth", "type": "date"},
            {"key": "appointment_type", "label": "Appointment Type", "type": "text"},
            {"key": "appointment_date", "label": "Appointment Date", "type": "date"},
        ],
        "demo_values": {
            "patient_name": "David Brown",
            "date_of_birth": "12 Mar 1980",
            "appointment_type": "General Consultation",
            "appointment_date": "15 Aug 2026",
        },
        "negative_field": "appointment_date",
    },
}


def get_industry(key: str) -> dict:
    if key not in INDUSTRIES:
        raise KeyError(f"Unknown industry: {key}")
    return INDUSTRIES[key]


def field_keys(industry_key: str) -> list[str]:
    return [f["key"] for f in INDUSTRIES[industry_key]["fields"]]
