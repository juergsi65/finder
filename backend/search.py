"""Shared 'find lost items along a track' logic.

Used by both the GPX-upload search (/api/search/gpx) and the Strava
"did you lose something on today's activity?" add-on (/api/strava/today-track)
so the actual matching code exists exactly once.
"""
from typing import List, Optional

from sqlalchemy.orm import Session

from models import FoundItem, STATUS_ACTIVE
from gpx_matching import GpxPoint, find_matches, downsample_track, track_time_range, DEFAULT_RADIUS_M


def candidate_items(db: Session, category: Optional[str], query: Optional[str]) -> List[FoundItem]:
    """Active found items matching an optional category + free-text query.

    Each word of the query must appear somewhere in the title or
    description (case-insensitive substring, words ANDed together) - not
    the query as one contiguous phrase. A search for "Garmin Uhr" should
    find a found item titled "Garmin Fenix Uhr", not just an exact
    "Garmin Uhr" substring.
    """
    q = db.query(FoundItem).filter(FoundItem.status == STATUS_ACTIVE)
    if category:
        q = q.filter(FoundItem.category == category)
    if query and query.strip():
        for word in query.strip().split():
            like = f"%{word}%"
            q = q.filter((FoundItem.title.ilike(like)) | (FoundItem.description.ilike(like)))
    return q.all()


def build_search_response(
    track_points: List[GpxPoint],
    db: Session,
    category: Optional[str],
    query: Optional[str],
    radius_m: float = DEFAULT_RADIUS_M,
    source: str = "gpx",
    source_label: Optional[str] = None,
) -> dict:
    items = candidate_items(db, category, query)
    matches = find_matches(track_points, items, radius_m=radius_m)
    preview = downsample_track(track_points)
    started_at, finished_at = track_time_range(track_points)

    return {
        "matched": len(matches) > 0,
        "track_points_checked": len(track_points),
        "radius_m": radius_m,
        "matches": matches,
        "track_preview": [{"lat": p.lat, "lng": p.lng} for p in preview],
        "track_started_at": started_at,
        "track_finished_at": finished_at,
        "source": source,
        "source_label": source_label,
    }
