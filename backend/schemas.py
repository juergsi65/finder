import datetime
from typing import Optional, List
from pydantic import BaseModel

CATEGORIES = ["Trinkflasche", "Radcomputer", "Pumpe", "Brille", "Sonstiges"]


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
