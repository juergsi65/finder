import datetime
import re
from typing import Optional
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
    # Only populated when the request included a reference lat/lng (see
    # GET /api/found-items) - lets the map show "3.2 km entfernt" per pin
    # and power the "X Gegenstände in deiner Nähe" count, without a
    # separate endpoint or route-matching logic.
    distance_m: Optional[float] = None

    class Config:
        from_attributes = True


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
