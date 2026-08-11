"""Admin-editable runtime configuration: DB-backed overrides for the
Strava OAuth app and email delivery settings, merged with environment-
variable defaults so an install can still be bootstrapped via
.env/docker-compose and only needs the web UI (Admin -> API-Konfiguration)
for changes that don't warrant a redeploy.

Precedence: a non-empty value saved via the admin UI (stored in the
AppSettings singleton row) always wins; otherwise the environment
variable is used; otherwise the value is None/unset.
"""
import os
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session

from models import AppSettings

_ENV_DEFAULTS = {
    "strava_client_id": "STRAVA_CLIENT_ID",
    "strava_client_secret": "STRAVA_CLIENT_SECRET",
    "strava_redirect_uri": "STRAVA_REDIRECT_URI",
    "resend_api_key": "RESEND_API_KEY",
    "resend_from": "RESEND_FROM",
    "smtp_host": "SMTP_HOST",
    "smtp_user": "SMTP_USER",
    "smtp_password": "SMTP_PASSWORD",
    "smtp_from": "SMTP_FROM",
}

# Resend's built-in sandbox sender - always deliverable without verifying a
# domain first, so a fresh install can send email immediately once an API
# key is set. Swap for a verified-domain address once one is set up
# (Admin -> API-Konfiguration -> Resend -> Absender).
RESEND_SANDBOX_FROM = "TrailFound <onboarding@resend.dev>"


def get_or_create_settings(db: Session) -> AppSettings:
    settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
    if not settings:
        settings = AppSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def _resolve(settings: AppSettings, field: str) -> Optional[str]:
    db_value = getattr(settings, field, None)
    if db_value:
        return db_value
    env_var = _ENV_DEFAULTS.get(field)
    return os.environ.get(env_var) if env_var else None


@dataclass
class StravaConfig:
    client_id: Optional[str]
    client_secret: Optional[str]
    redirect_uri: str

    @property
    def is_configured(self) -> bool:
        return bool(self.client_id and self.client_secret)


@dataclass
class EmailConfig:
    """Covers both supported email providers. `provider` picks Resend
    whenever an API key is configured (it's the preferred path - see the
    module docstring); SMTP is only used as a fallback for installs that
    configured it before Resend support existed, or that simply prefer it.
    """

    resend_api_key: Optional[str]
    resend_from: str
    smtp_host: Optional[str]
    smtp_port: int
    smtp_user: Optional[str]
    smtp_password: Optional[str]
    smtp_from: str
    smtp_use_tls: bool

    @property
    def provider(self) -> str:
        if self.resend_api_key:
            return "resend"
        if self.smtp_host:
            return "smtp"
        return "none"

    @property
    def is_configured(self) -> bool:
        return self.provider != "none"

    @property
    def from_address(self) -> str:
        return self.resend_from if self.provider == "resend" else self.smtp_from


def get_strava_config(db: Session) -> StravaConfig:
    settings = get_or_create_settings(db)
    redirect_uri = _resolve(settings, "strava_redirect_uri") or "http://localhost:8000/api/strava/callback"
    return StravaConfig(
        client_id=_resolve(settings, "strava_client_id"),
        client_secret=_resolve(settings, "strava_client_secret"),
        redirect_uri=redirect_uri,
    )


def get_email_config(db: Session) -> EmailConfig:
    settings = get_or_create_settings(db)
    smtp_port = settings.smtp_port or int(os.environ.get("SMTP_PORT", "587"))
    smtp_from = _resolve(settings, "smtp_from") or "TrailFound <no-reply@trailfound.local>"
    resend_from = _resolve(settings, "resend_from") or RESEND_SANDBOX_FROM
    use_tls = os.environ.get("SMTP_USE_TLS", "true").lower() != "false"
    return EmailConfig(
        resend_api_key=_resolve(settings, "resend_api_key"),
        resend_from=resend_from,
        smtp_host=_resolve(settings, "smtp_host"),
        smtp_port=smtp_port,
        smtp_user=_resolve(settings, "smtp_user"),
        smtp_password=_resolve(settings, "smtp_password"),
        smtp_from=smtp_from,
        smtp_use_tls=use_tls,
    )
