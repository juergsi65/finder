import datetime
import re
from typing import Optional, List
from pydantic import BaseModel, field_validator

CATEGORIES = ["Trinkflasche", "Radcomputer", "Pumpe", "Brille", "Sonstiges"]
ROLES = ["user", "verein"]  # "admin" is never self-selectable at registration

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


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

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    komoot_id: Optional[str] = None
    garmin_id: Optional[str] = None


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

    class Config:
        from_attributes = True
