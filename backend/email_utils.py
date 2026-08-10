"""System-email relay for the internal messaging system.

Messages between a searcher and a finder are stored in the DB and shown
in-app, but each new message also triggers a relay email to the *other*
participant's real address - neither party's email is ever shown to the
other in the UI. This module owns that relay.

SMTP settings come from settings_store.get_smtp_config(db) (admin-editable
via the web UI, falling back to environment variables) rather than being
fixed at import time, so an admin's change takes effect on the very next
message without a container restart. SMTP is optional: without a host
configured, `send_email` logs a warning and returns False instead of
raising, so the messaging feature still works in-app (the recipient just
won't get an email nudge) rather than breaking message sending entirely on
an unconfigured install.
"""
import logging
import smtplib
from email.message import EmailMessage
from typing import Optional

from settings_store import SmtpConfig

logger = logging.getLogger("trailfound.email")


def send_email(config: SmtpConfig, to_email: str, subject: str, body: str) -> bool:
    """Best-effort send. Returns True on success, False if not configured
    or if sending failed (never raises - a failed relay must not break the
    in-app message that already succeeded)."""
    if not config.is_configured:
        logger.info("SMTP nicht konfiguriert - E-Mail an %s wird übersprungen: %s", to_email, subject)
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = config.from_address
    msg["To"] = to_email
    msg.set_content(body)

    try:
        with smtplib.SMTP(config.host, config.port, timeout=10) as server:
            if config.use_tls:
                server.starttls()
            if config.user and config.password:
                server.login(config.user, config.password)
            server.send_message(msg)
        return True
    except Exception:  # noqa: BLE001 - relay is best-effort, never fatal
        logger.exception("E-Mail-Relay an %s fehlgeschlagen", to_email)
        return False


def send_new_message_notification(
    config: SmtpConfig,
    to_email: str,
    found_item_title: str,
    message_body: str,
    app_url: Optional[str] = None,
) -> bool:
    """Notify a conversation participant about a new message, without
    revealing the sender's own contact details."""
    link_line = f"\n\nIn der App ansehen: {app_url}" if app_url else ""
    body = (
        f"Du hast eine neue Nachricht zu deinem Fund-Pin \"{found_item_title}\" auf TrailFound erhalten:\n\n"
        f'"{message_body}"'
        f"{link_line}\n\n"
        "Antworte direkt in der App - deine E-Mail-Adresse wird dabei nicht an die andere Person weitergegeben."
    )
    return send_email(config, to_email, f'Neue Nachricht zu "{found_item_title}" - TrailFound', body)
