"""Admin-editable runtime configuration: DB-backed overrides for the
Strava OAuth app and SMTP relay settings, merged with environment-variable
defaults so an install can still be bootstrapped via .env/docker-compose
and only needs the web UI (Admin -> API-Konfiguration) for changes that
don't warrant a redeploy.

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
    "smtp_host": "SMTP_HOST",
    "smtp_user": "SMTP_USER",
    "smtp_password": "SMTP_PASSWORD",
    "smtp_from": "SMTP_FROM",
}


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
class SmtpConfig:
    host: Optional[str]
    port: int
    user: Optional[str]
    password: Optional[str]
    from_address: str
    use_tls: bool

    @property
    def is_configured(self) -> bool:
        return bool(self.host)


def get_strava_config(db: Session) -> StravaConfig:
    settings = get_or_create_settings(db)
    redirect_uri = _resolve(settings, "strava_redirect_uri") or "http://localhost:8000/api/strava/callback"
    return StravaConfig(
        client_id=_resolve(settings, "strava_client_id"),
        client_secret=_resolve(settings, "strava_client_secret"),
        redirect_uri=redirect_uri,
    )


def get_smtp_config(db: Session) -> SmtpConfig:
    settings = get_or_create_settings(db)
    port = settings.smtp_port or int(os.environ.get("SMTP_PORT", "587"))
    from_address = _resolve(settings, "smtp_from") or "TrailFound <no-reply@trailfound.local>"
    use_tls = os.environ.get("SMTP_USE_TLS", "true").lower() != "false"
    return SmtpConfig(
        host=_resolve(settings, "smtp_host"),
        port=port,
        user=_resolve(settings, "smtp_user"),
        password=_resolve(settings, "smtp_password"),
        from_address=from_address,
        use_tls=use_tls,
    )
