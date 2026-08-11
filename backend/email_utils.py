"""System-email relay for the internal messaging system and the lost/
stolen radius alerts.

Messages between a searcher and a finder are stored in the DB and shown
in-app, but each new message also triggers a relay email to the *other*
participant's real address - neither party's email is ever shown to the
other in the UI. This module owns that relay (and the radius-alert email).

Email settings come from settings_store.get_email_config(db)
(admin-editable via the web UI, falling back to environment variables)
rather than being fixed at import time, so an admin's change takes effect
on the very next email without a container restart.

Two providers are supported, picked automatically by EmailConfig.provider:
- **Resend** (https://resend.com), via a plain HTTP POST - the preferred
  path whenever a RESEND_API_KEY/`resend_api_key` is configured. No SDK
  dependency; the API is a single JSON POST.
- **SMTP**, as a fallback for installs that configured it before Resend
  support existed (or that simply prefer their own relay).

Email is optional end-to-end: without either provider configured,
`send_email` logs and returns False instead of raising, so the messaging
feature still works in-app (the recipient just won't get an email nudge)
rather than breaking on an unconfigured install. Every attempt where a
provider *was* configured is recorded in the `email_logs` table
(status "sent"/"failed" + the failure detail) so an admin has a concrete
delivery record without needing to grep container logs - see
settings_store.get_or_create_settings for the sibling AppSettings table.
"""
import logging
import smtplib
from email.message import EmailMessage
from typing import Optional, Tuple

import httpx
from sqlalchemy.orm import Session

from models import EmailLog
from settings_store import EmailConfig

logger = logging.getLogger("trailfound.email")

RESEND_API_URL = "https://api.resend.com/emails"


def _send_via_resend(config: EmailConfig, to_email: str, subject: str, body: str) -> Tuple[bool, Optional[str]]:
    try:
        resp = httpx.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {config.resend_api_key}"},
            json={"from": config.resend_from, "to": [to_email], "subject": subject, "text": body},
            timeout=10,
        )
    except httpx.HTTPError as exc:
        return False, f"Netzwerkfehler: {exc}"

    if resp.status_code >= 400:
        # Resend's error body (e.g. "domain not verified", "invalid API
        # key" -> the classic 403 this integration is built to avoid by
        # defaulting resend_from to the always-usable sandbox sender) is
        # the single most useful diagnostic here - keep it in full.
        return False, f"HTTP {resp.status_code}: {resp.text[:300]}"
    return True, None


def _send_via_smtp(config: EmailConfig, to_email: str, subject: str, body: str) -> Tuple[bool, Optional[str]]:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = config.smtp_from
    msg["To"] = to_email
    msg.set_content(body)

    try:
        with smtplib.SMTP(config.smtp_host, config.smtp_port, timeout=10) as server:
            if config.smtp_use_tls:
                server.starttls()
            if config.smtp_user and config.smtp_password:
                server.login(config.smtp_user, config.smtp_password)
            server.send_message(msg)
        return True, None
    except Exception as exc:  # noqa: BLE001 - relay is best-effort, never fatal
        return False, str(exc)


def _log_attempt(
    db: Optional[Session],
    *,
    recipient: str,
    subject: str,
    body: str,
    status: str,
    provider: str,
    error: Optional[str],
) -> None:
    """Best-effort DB write - a logging failure must never take down an
    email send that already succeeded (or mask one that already failed)."""
    if db is None:
        return
    try:
        db.add(
            EmailLog(
                recipient=recipient,
                subject=subject,
                body=body,
                status=status,
                provider=provider,
                error=error,
            )
        )
        db.commit()
    except Exception:  # noqa: BLE001
        logger.exception("E-Mail-Log für %s konnte nicht gespeichert werden", recipient)
        db.rollback()


def send_email(
    config: EmailConfig,
    to_email: str,
    subject: str,
    body: str,
    db: Optional[Session] = None,
) -> bool:
    """Best-effort send via whichever provider is configured (Resend
    preferred, SMTP as fallback - see EmailConfig.provider). Returns True
    on success, False if not configured or if sending failed (never
    raises - a failed relay must not break the in-app action that
    triggered it). Pass `db` to also persist the attempt to `email_logs`;
    omit it (e.g. in a context with no session handy) to just log/return.
    """
    if not config.is_configured:
        logger.info("Kein E-Mail-Provider konfiguriert - E-Mail an %s wird übersprungen: %s", to_email, subject)
        return False

    provider = config.provider
    if provider == "resend":
        ok, error = _send_via_resend(config, to_email, subject, body)
    else:
        ok, error = _send_via_smtp(config, to_email, subject, body)

    if ok:
        logger.info("E-Mail an %s gesendet (%s): %s", to_email, provider, subject)
    else:
        logger.error("E-Mail an %s fehlgeschlagen (%s): %s", to_email, provider, error)

    _log_attempt(
        db,
        recipient=to_email,
        subject=subject,
        body=body,
        status="sent" if ok else "failed",
        provider=provider,
        error=error,
    )
    return ok


def send_new_message_notification(
    config: EmailConfig,
    to_email: str,
    found_item_title: str,
    message_body: str,
    app_url: Optional[str] = None,
    db: Optional[Session] = None,
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
    return send_email(config, to_email, f'Neue Nachricht zu "{found_item_title}" - TrailFound', body, db=db)


def send_radius_alert(
    config: EmailConfig,
    to_email: str,
    *,
    report_type: str,
    title: str,
    category: str,
    distance_km: float,
    serial_number: Optional[str] = None,
    description: Optional[str] = None,
    app_url: Optional[str] = None,
    db: Optional[Session] = None,
) -> bool:
    """Notify an opted-in user that someone filed a lost/stolen report
    within their alert radius. Never reveals the reporter's contact
    details - only the item details they'd need to keep an eye out."""
    kind_de = "gestohlen" if report_type == "stolen" else "verloren"
    lines = [
        f"In deiner Umgebung (ca. {distance_km:.1f} km entfernt) wurde soeben ein Gegenstand als {kind_de} gemeldet:",
        "",
        f"Titel: {title}",
        f"Kategorie: {category}",
    ]
    if serial_number:
        lines.append(f"Seriennummer/Rahmennummer: {serial_number}")
    if description:
        lines.append(f"Beschreibung: {description}")
    if app_url:
        lines.append("")
        lines.append(f"Details in der App: {app_url}")
    lines.append("")
    lines.append(
        "Du erhältst diese Benachrichtigung, weil du in deinem Profil Umkreis-Alarme aktiviert hast. "
        "Du kannst das dort jederzeit wieder abschalten."
    )
    body = "\n".join(lines)
    subject_kind = "Diebstahl" if report_type == "stolen" else "Verlust"
    return send_email(config, to_email, f"⚠️ {subject_kind} in deiner Nähe - TrailFound", body, db=db)
