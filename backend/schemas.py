import datetime
import re
from typing import Optional, List
from pydantic import BaseModel, field_validator

CATEGORIES = ["Trinkflasche", "Radcomputer", "Pumpe", "Brille", "Sonstiges"]

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class FoundItemOut(BaseModel):
    id: int
    category: str
    description: Optional[str] = None
    photo_path: Optional[str] = None
    lat: float
    lng: float
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class MatchResult(BaseModel):
    item: FoundItemOut
    distance_m: float
    matched_track_point: dict


class TrackPoint(BaseModel):
    lat: float
    lng: float


class MatchResponse(BaseModel):
    matched: bool
    track_points_checked: int
    radius_m: float
    matches: List[MatchResult]
    # Downsampled polyline of the uploaded route, so the frontend can draw
    # it on the result map alongside the matched pins.
    track_preview: List[TrackPoint] = []
    # Earliest/latest timestamp found in the GPX track, if any point had one.
    track_started_at: Optional[datetime.datetime] = None
    track_finished_at: Optional[datetime.datetime] = None


# --- Auth / users -----------------------------------------------------------


class UserCreate(BaseModel):
    email: str
    password: str

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


class UserOut(BaseModel):
    id: int
    email: str
    role: str
    created_at: datetime.datetime
    strava_id: Optional[str] = None
    komoot_id: Optional[str] = None
    garmin_id: Optional[str] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProfileUpdate(BaseModel):
    # Placeholder fields for future external-service linking (Strava, Komoot,
    # Garmin). A value of "" or null clears the connection.
    strava_id: Optional[str] = None
    komoot_id: Optional[str] = None
    garmin_id: Optional[str] = None
