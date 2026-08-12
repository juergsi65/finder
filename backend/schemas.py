import datetime
import re
from typing import Optional, List
from pydantic import BaseModel, field_validator

# Default category suggestions offered by the picker - no longer a hard
# whitelist (see validate_category_value below): any user can type a
# custom category when reporting an item. GET /api/categories merges this
# list with whatever custom categories are already in use, so the
# suggestions grow organically instead of needing a code change.
CATEGORIES = ["Trinkflasche", "Radcomputer", "Pumpe", "Brille", "Sonstiges"]
ROLES = ["user", "verein"]  # "admin" is never self-selectable at registration
REPORT_TYPES = ["lost", "stolen"]

MAX_CATEGORY_LEN = 60
MAX_ICON_LEN = 16

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def validate_category_value(v: str) -> str:
    """Shared by every endpoint that accepts a category as a raw Form
    field (found items, lost items) rather than through a pydantic model -
    just a sanity check now, not a whitelist membership test."""
    v = v.strip()
    if not v:
        raise ValueError("Bitte eine Kategorie angeben.")
    if len(v) > MAX_CATEGORY_LEN:
        raise ValueError(f"Kategorie ist zu lang (max. {MAX_CATEGORY_LEN} Zeichen).")
    return v


def validate_icon_value(v: Optional[str]) -> Optional[str]:
    """Emoji (or short icon string) chosen for one specific item. Blank
    normalizes to None so the frontend's category-based fallback kicks in
    instead of storing an empty string."""
    if v is None:
        return None
    v = v.strip()
    if not v:
        return None
    if len(v) > MAX_ICON_LEN:
        raise ValueError(f"Icon ist zu lang (max. {MAX_ICON_LEN} Zeichen).")
    return v


# --- Found items -------------------------------------------------------


class ReporterOut(BaseModel):
    """Minimal, non-identifying info about who reported a find - no email."""

    id: int
    display_name: Optional[str] = None
    role: str

    class Config:
        from_attributes = True


class FoundItemOut(BaseModel):
    id: int
    title: str
    category: str
    # User-picked emoji for this item; None falls back to the frontend's
    # name-based default (see categoryIcons.js) for items predating this.
    icon: Optional[str] = None
    description: Optional[str] = None
    # Photo is mandatory for *new* reports (enforced in the create endpoint),
    # but plenty of real rows predate that rule - it used to be an optional
    # field, so any find reported before that change has photo_path=NULL in
    # the database. Modeling it as required here would 500 on every one of
    # those rows (ResponseValidationError) the moment it's read back.
    photo_path: Optional[str] = None
    lat: float
    lng: float
    found_date: datetime.date
    status: str
    reporter: Optional[ReporterOut] = None
    # None of the models' created_at columns actually declare
    # nullable=False (an oversight present since the very first schema,
    # not something the recent rewrite introduced) - the Python-side
    # `default=` only fills it in on inserts made through the ORM, so it's
    # required in practice but not guaranteed by the database. Optional
    # here for the same reason as photo_path above: a hypothetical row
    # without one must never turn into a 500 instead of just omitting the
    # field.
    created_at: Optional[datetime.datetime] = None
    # Only populated when the request included a reference lat/lng (see
    # GET /api/found-items) - powers "X in deiner Nähe" without a separate
    # endpoint.
    distance_m: Optional[float] = None

    class Config:
        from_attributes = True


class MatchResult(BaseModel):
    item: FoundItemOut
    distance_m: float
    matched_track_point: dict


class TrackPoint(BaseModel):
    lat: float
    lng: float


class SearchResponse(BaseModel):
    matched: bool
    track_points_checked: int
    radius_m: float
    matches: List[MatchResult]
    track_preview: List[TrackPoint] = []
    track_started_at: Optional[datetime.datetime] = None
    track_finished_at: Optional[datetime.datetime] = None
    source: str = "gpx"  # "gpx" | "strava"
    source_label: Optional[str] = None  # e.g. the Strava activity name


# --- Auth / users -----------------------------------------------------------


class UserCreate(BaseModel):
    email: str
    password: str
    role: str = "user"
    display_name: Optional[str] = None
    # GDPR-relevant opt-in, off by default - see User.alert_opt_in.
    alert_opt_in: bool = False

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("Ungültige E-Mail-Adresse")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Passwort muss mindestens 8 Zeichen lang sein")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ROLES:
            raise ValueError(f"Ungültige Rolle: {v}")
        return v


class UserOut(BaseModel):
    id: int
    email: str
    role: str
    display_name: Optional[str] = None
    # See FoundItemOut.created_at - same "column isn't actually NOT NULL"
    # situation.
    created_at: Optional[datetime.datetime] = None
    komoot_id: Optional[str] = None
    garmin_id: Optional[str] = None
    strava_connected: bool = False
    alert_opt_in: bool = False
    home_lat: Optional[float] = None
    home_lng: Optional[float] = None
    # Bumped on every authenticated request (throttled, see
    # auth.get_current_user) - powers the admin "online now" view. None
    # for an account that's never made an authenticated request.
    last_seen_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# --- Admin: API configuration -------------------------------------------


class AppSettingsOut(BaseModel):
    """Non-secret values are echoed back as-is so the form can be
    pre-filled; secrets (client secret, Resend API key, SMTP password) are
    never sent back in plaintext - only whether one is currently set - so
    the settings screen can't leak them to anyone with a browser devtools
    tab open."""

    strava_client_id: Optional[str] = None
    strava_client_secret_set: bool = False
    strava_redirect_uri: Optional[str] = None
    strava_configured: bool = False

    # Which provider send_email() will actually use right now: "resend",
    # "smtp", or "none" - see settings_store.EmailConfig.provider.
    email_provider: str = "none"

    resend_api_key_set: bool = False
    resend_from: Optional[str] = None
    resend_configured: bool = False

    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password_set: bool = False
    smtp_from: Optional[str] = None
    smtp_configured: bool = False

    updated_at: Optional[datetime.datetime] = None


class AppSettingsUpdate(BaseModel):
    """All fields optional and only applied if provided (exclude_unset) -
    submitting the form doesn't blank out fields the admin didn't touch.
    Send an explicit empty string to clear a field."""

    strava_client_id: Optional[str] = None
    strava_client_secret: Optional[str] = None
    strava_redirect_uri: Optional[str] = None

    resend_api_key: Optional[str] = None
    resend_from: Optional[str] = None

    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = None


class EmailLogOut(BaseModel):
    id: int
    recipient: str
    subject: str
    status: str
    provider: str
    error: Optional[str] = None
    created_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True


class TestEmailRequest(BaseModel):
    """Body for POST /api/admin/email-logs/test - lets an admin verify a
    live deploy's email provider (Resend or SMTP) actually delivers,
    without needing a second real user account. Notably useful for
    catching Resend's sandbox-sender restriction (onboarding@resend.dev
    can only deliver to the Resend account's own signup address) before a
    real user hits it."""

    to: str

    @field_validator("to")
    @classmethod
    def validate_to(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("Ungültige E-Mail-Adresse")
        return v


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    komoot_id: Optional[str] = None
    garmin_id: Optional[str] = None
    # Opt-in radius alerts (see User.alert_opt_in) + the home location they
    # apply to. home_lat/home_lng of exactly 0.0 (equator/prime meridian)
    # are legitimate coordinates, not "unset" - see update_me() in main.py,
    # which must not treat them as falsy.
    alert_opt_in: Optional[bool] = None
    home_lat: Optional[float] = None
    home_lng: Optional[float] = None


class LostItemReportOut(BaseModel):
    id: int
    report_type: str
    title: str
    category: str
    icon: Optional[str] = None
    description: Optional[str] = None
    serial_number: Optional[str] = None
    photo_path: Optional[str] = None
    lat: float
    lng: float
    occurred_date: Optional[datetime.date] = None
    created_at: Optional[datetime.datetime] = None
    # Added so lost/stolen reports can now be plotted on the shared map
    # (GET /api/lost-items) with the same "who reported this" attribution
    # found items already show - never the reporter's email.
    reporter: Optional[ReporterOut] = None

    class Config:
        from_attributes = True


# --- Map note pins --------------------------------------------------------


class PinCreate(BaseModel):
    lat: float
    lng: float
    title: str
    description: Optional[str] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Bitte einen Titel angeben.")
        if len(v) > 200:
            raise ValueError("Titel ist zu lang (max. 200 Zeichen).")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if len(v) > 2000:
            raise ValueError("Beschreibung ist zu lang (max. 2000 Zeichen).")
        return v or None


class PinUpdate(BaseModel):
    """Both fields optional (exclude_unset) - editing just the description
    doesn't require resending the title. Empty string clears description;
    title can't be cleared to empty (still validated when provided)."""

    title: Optional[str] = None
    description: Optional[str] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if not v:
            raise ValueError("Titel darf nicht leer sein.")
        if len(v) > 200:
            raise ValueError("Titel ist zu lang (max. 200 Zeichen).")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if len(v) > 2000:
            raise ValueError("Beschreibung ist zu lang (max. 2000 Zeichen).")
        return v or None


class PinOut(BaseModel):
    id: int
    lat: float
    lng: float
    title: str
    description: Optional[str] = None
    owner: Optional[ReporterOut] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True


# --- Messaging ----------------------------------------------------------


class MessageCreate(BaseModel):
    body: str

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Nachricht darf nicht leer sein")
        if len(v) > 4000:
            raise ValueError("Nachricht ist zu lang (max. 4000 Zeichen)")
        return v


class MessageOut(BaseModel):
    id: int
    sender_id: int
    body: str
    created_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True


class ConversationOut(BaseModel):
    id: int
    found_item: FoundItemOut
    starter_id: int
    other_participant_id: int
    created_at: Optional[datetime.datetime] = None
    messages: List[MessageOut] = []
    # Messages from the *other* participant the viewer hasn't read yet -
    # always 0 for a viewer with no participant role (e.g. an admin
    # browsing for moderation, see main.py's _unread_count_for).
    unread_count: int = 0

    class Config:
        from_attributes = True
