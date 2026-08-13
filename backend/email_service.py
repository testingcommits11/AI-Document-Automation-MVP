from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage

from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
MAIL_FROM = os.getenv("MAIL_FROM", SMTP_USERNAME)
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"


class EmailDeliveryError(Exception):
    pass


def send_pdf_email(
    recipient: str,
    subject: str,
    body: str,
    filename: str,
    pdf_bytes: bytes,
) -> None:
    if not SMTP_USERNAME or not SMTP_PASSWORD or not MAIL_FROM:
        raise EmailDeliveryError(
            "SMTP email settings are not configured on the server."
        )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = MAIL_FROM
    msg["To"] = recipient
    msg.set_content(body)
    msg.add_attachment(
        pdf_bytes,
        maintype="application",
        subtype="pdf",
        filename=filename,
    )

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
            if SMTP_USE_TLS:
                server.starttls()

            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)

    except Exception as exc:
        raise EmailDeliveryError(f"Failed to send email: {exc}") from exc