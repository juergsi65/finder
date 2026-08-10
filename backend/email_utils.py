"""System-email relay for the internal messaging system.

Messages between a searcher and a finder are stored in the DB and shown
in-app, but each new message also triggers a relay email to the *other*
participant's real address - neither party's email is ever shown to the
other in the UI. This module owns that relay.

SMTP is optional: without SMTP_HOST configured, `send_email` logs a warning
and returns False instead of raising, so the messaging feature still works
in-app (the recipient just won't get an email nudge) rather than breaking
message sending entirely on an unconfigured install.
"""
import logging
import os
import smtplib
from email.message import EmailMessage
from typing import Optional

logger = logging.getLogger("trailfound.email")

SMTP_HOST = os.environ.get("SMTP_HOST")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
SMTP_FROM = os.environ.get("SMTP_FROM", "TrailFound <no-reply@trailfound.local>")
SMTP_USE_TLS = os.environ.get("SMTP_USE_TLS", "true").lower() != "false"

is_configured = bool(SMTP_HOST)


def send_email(to_email: str, subject: str, body: str) -> bool:
    """Best-effort send. Returns True on success, False if not configured
    or if sending failed (never raises - a failed relay must not break the
    in-app message that already succeeded)."""
    if not is_configured:
        logger.info("SMTP nicht konfiguriert - E-Mail an %s wird übersprungen: %s", to_email, subject)
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    msg.set_content(body)

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            if SMTP_USE_TLS:
                server.starttls()
            if SMTP_USER and SMTP_PASSWORD:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception:  # noqa: BLE001 - relay is best-effort, never fatal
        logger.exception("E-Mail-Relay an %s fehlgeschlagen", to_email)
        return False


def send_new_message_notification(to_email: str, found_item_title: str, message_body: str, app_url: Optional[str] = None) -> bool:
    """Notify a conversation participant about a new message, without
    revealing the sender's own contact details."""
    link_line = f"\n\nIn der App ansehen: {app_url}" if app_url else ""
    body = (
        f"Du hast eine neue Nachricht zu deinem Fund-Pin \"{found_item_title}\" auf TrailFound erhalten:\n\n"
        f'"{message_body}"'
        f"{link_line}\n\n"
        "Antworte direkt in der App - deine E-Mail-Adresse wird dabei nicht an die andere Person weitergegeben."
    )
    return send_email(to_email, f'Neue Nachricht zu "{found_item_title}" - TrailFound', body)
