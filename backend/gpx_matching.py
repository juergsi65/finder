"""GPX parsing + radius matching logic - the core of the TrailFound matching prototype."""
import math
import re
from dataclasses import dataclass
from datetime import datetime
from typing import List, Tuple, Optional

import gpxpy
import gpxpy.gpx

from geo import haversine_distance_m, point_to_segment_distance_m
from models import FoundItem

DEFAULT_RADIUS_M = 30.0
MAX_RADIUS_M = 1000.0
# Points returned to the frontend for drawing the route are downsampled to
# keep the response small - this is purely for the map preview, matching
# always runs against the full-resolution track.
MAX_TRACK_POINTS_IN_RESPONSE = 1000


class GpxParseError(ValueError):
    """Raised for any problem turning uploaded bytes into usable track points.

    Kept distinct from generic exceptions so the API layer can always map it
    to a clean 400 response instead of leaking a raw parser traceback.
    """


@dataclass(frozen=True)
class GpxPoint:
    """A single validated track point: coordinates plus optional timestamp."""

    lat: float
    lng: float
    time: Optional[datetime] = None


def _decode_gpx_bytes(gpx_bytes: bytes) -> str:
    """Decode a GPX file's bytes into a string, robust to real-world exports.

    Most modern tools (Strava, Komoot, Garmin Connect) write UTF-8, but
    plenty of GPX files - especially from older devices - declare (and use)
    ISO-8859-1/Windows-1252. gpxpy itself always decodes as UTF-8 internally,
    which raises UnicodeDecodeError on those files, so we decode ourselves
    first and hand gpxpy an already-correct string.
    """
    for encoding in ("utf-8-sig", "utf-8"):
        try:
            return gpx_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue

    # Fall back to whatever encoding the XML prolog declares, e.g.
    # <?xml version="1.0" encoding="ISO-8859-1"?>
    declared = re.search(rb'encoding=["\']([\w-]+)["\']', gpx_bytes[:200])
    if declared:
        try:
            return gpx_bytes.decode(declared.group(1).decode("ascii", "ignore"))
        except (UnicodeDecodeError, LookupError):
            pass

    # Last resort: latin-1 maps every byte 0-255, so this never raises.
    return gpx_bytes.decode("latin-1")


def _valid_coordinate(lat, lng) -> bool:
    """Reject points that can't possibly be real GPS fixes.

    Real-world GPX files occasionally contain corrupted rows (GPS glitches,
    firmware bugs writing lat/lon as 0/NaN, hand-edited files, ...). Letting
    those through would silently poison the distance calculation - e.g. a
    (0, 0) "null island" point would just look like a very distant, harmless
    track point, but a NaN would make every downstream comparison undefined.
    """
    if lat is None or lng is None:
        return False
    if not (math.isfinite(lat) and math.isfinite(lng)):
        return False
    if not (-90.0 <= lat <= 90.0):
        return False
    if not (-180.0 <= lng <= 180.0):
        return False
    return True


def extract_track_points(gpx_bytes: bytes) -> List[GpxPoint]:
    """Parse a GPX file and return a flat, validated list of GpxPoints.

    Covers tracks, routes and waypoints so most GPX exports (Garmin,
    Strava, Komoot, ...) work out of the box. Coordinates are validated
    (finite, in-range) and invalid rows are skipped rather than corrupting
    the match; timestamps are carried along when present but are optional -
    plenty of valid GPX files (manually drawn routes, some route exports)
    have none.

    Raises GpxParseError with a human-readable (German) message for
    anything that isn't a parseable GPX document.
    """
    try:
        xml_text = _decode_gpx_bytes(gpx_bytes)
        gpx = gpxpy.parse(xml_text)
    except gpxpy.gpx.GPXXMLSyntaxException as exc:
        raise GpxParseError("Die Datei ist kein gültiges XML/GPX-Dokument.") from exc
    except gpxpy.gpx.GPXException as exc:
        raise GpxParseError(f"Die GPX-Datei ist ungültig: {exc}") from exc
    except Exception as exc:  # noqa: BLE001 - anything else is still "bad input", not a 500
        raise GpxParseError(f"GPX konnte nicht gelesen werden: {exc}") from exc

    raw_points: List[Tuple[float, float, Optional[datetime]]] = []

    for track in gpx.tracks:
        for segment in track.segments:
            for point in segment.points:
                raw_points.append((point.latitude, point.longitude, point.time))

    for route in gpx.routes:
        for point in route.points:
            raw_points.append((point.latitude, point.longitude, point.time))

    # Only fall back to waypoints if the file has no actual track/route -
    # a GPX can carry unrelated points-of-interest as waypoints alongside a
    # track, and lumping those in would distort segment-based matching.
    if not raw_points:
        for waypoint in gpx.waypoints:
            raw_points.append((waypoint.latitude, waypoint.longitude, waypoint.time))

    points: List[GpxPoint] = []
    skipped_invalid = 0
    for lat, lng, time in raw_points:
        if not _valid_coordinate(lat, lng):
            skipped_invalid += 1
            continue
        points.append(GpxPoint(lat=lat, lng=lng, time=time))

    if not points and skipped_invalid:
        raise GpxParseError(
            f"Alle {skipped_invalid} Koordinaten in der GPX-Datei sind ungültig "
            "(außerhalb des gültigen Wertebereichs)."
        )

    # If (and only if) every point carries a timestamp, sort chronologically.
    # This guards against multi-segment files where segments aren't stored
    # in time order, without silently reordering files that never had
    # reliable timestamps to begin with.
    if points and all(p.time is not None for p in points):
        points.sort(key=lambda p: p.time)

    deduped: List[GpxPoint] = []
    for p in points:
        if not deduped or (deduped[-1].lat, deduped[-1].lng) != (p.lat, p.lng):
            deduped.append(p)
    return deduped


def track_time_range(points: List[GpxPoint]) -> Tuple[Optional[datetime], Optional[datetime]]:
    """Earliest/latest timestamp in the track, or (None, None) if it has none."""
    times = [p.time for p in points if p.time is not None]
    if not times:
        return None, None
    return min(times), max(times)


def _closest_point_on_track(
    item_pos: Tuple[float, float], track_points: List[Tuple[float, float]]
) -> Tuple[float, Tuple[float, float]]:
    """Closest distance (meters) from item_pos to the polyline through track_points.

    Walks every segment of the track and keeps the best perpendicular
    distance, not just the distance to the recorded vertices - this is what
    correctly matches items that sit *between* two GPS fixes. Degenerate
    single-point "tracks" fall back to a plain Haversine point distance.
    """
    if len(track_points) == 1:
        only = track_points[0]
        return haversine_distance_m(*item_pos, *only), only

    best_distance: Optional[float] = None
    best_point: Tuple[float, float] = track_points[0]

    for a, b in zip(track_points, track_points[1:]):
        distance, closest = point_to_segment_distance_m(item_pos, a, b)
        if best_distance is None or distance < best_distance:
            best_distance = distance
            best_point = closest

    return best_distance if best_distance is not None else float("inf"), best_point


def find_matches(
    track_points: List[GpxPoint],
    found_items: List[FoundItem],
    radius_m: float = DEFAULT_RADIUS_M,
):
    """For every found item, find the closest point on the route (not just
    the closest recorded GPS vertex - see `_closest_point_on_track`).

    Returns a list of dicts: {item, distance_m, matched_track_point} for
    every item within radius_m of the route. Each item appears at most
    once (its best/closest match), sorted nearest-first.
    """
    if radius_m <= 0:
        raise ValueError("radius_m must be positive")

    plain_points = [(p.lat, p.lng) for p in track_points]
    matches = []

    for item in found_items:
        if not _valid_coordinate(item.lat, item.lng):
            # Defensive: a corrupted found-item row should never crash the
            # whole match request for everyone else.
            continue

        distance, closest_point = _closest_point_on_track((item.lat, item.lng), plain_points)

        if distance <= radius_m:
            matches.append(
                {
                    "item": item,
                    "distance_m": round(distance, 1),
                    "matched_track_point": {"lat": closest_point[0], "lng": closest_point[1]},
                }
            )

    matches.sort(key=lambda m: m["distance_m"])
    return matches


def downsample_track(track_points: List[GpxPoint], max_points: int = MAX_TRACK_POINTS_IN_RESPONSE):
    """Evenly thin out a track for the API response (map preview only)."""
    if len(track_points) <= max_points:
        return track_points

    step = len(track_points) / max_points
    indices = sorted({int(i * step) for i in range(max_points)})
    if indices[-1] != len(track_points) - 1:
        indices.append(len(track_points) - 1)  # always keep the final point
    return [track_points[i] for i in indices]
