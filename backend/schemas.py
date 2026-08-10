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


class MatchResponse(BaseModel):
    matched: bool
    track_points_checked: int
    radius_m: float
    matches: List[MatchResult]
