"""GPX parsing + radius matching logic - the core of the TrailFound matching prototype."""
import re
from typing import List, Tuple, Optional

import gpxpy

from geo import haversine_distance_m, point_to_segment_distance_m
from models import FoundItem

DEFAULT_RADIUS_M = 30.0
MAX_RADIUS_M = 1000.0
# Points returned to the frontend for drawing the route are downsampled to
# keep the response small - this is purely for the map preview, matching
# always runs against the full-resolution track.
MAX_TRACK_POINTS_IN_RESPONSE = 1000


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


def extract_track_points(gpx_bytes: bytes) -> List[Tuple[float, float]]:
    """Parse a GPX file and return a flat list of (lat, lng) points.

    Covers tracks, routes and waypoints so most GPX exports (Garmin,
    Strava, Komoot, ...) work out of the box. Consecutive duplicate points
    are dropped since they add nothing to the matching and would otherwise
    create zero-length segments.
    """
    gpx = gpxpy.parse(_decode_gpx_bytes(gpx_bytes))
    points: List[Tuple[float, float]] = []

    for track in gpx.tracks:
        for segment in track.segments:
            for point in segment.points:
                points.append((point.latitude, point.longitude))

    for route in gpx.routes:
        for point in route.points:
            points.append((point.latitude, point.longitude))

    # Only fall back to waypoints if the file has no actual track/route -
    # a GPX can carry unrelated points-of-interest as waypoints alongside a
    # track, and lumping those in would distort segment-based matching.
    if not points:
        for waypoint in gpx.waypoints:
            points.append((waypoint.latitude, waypoint.longitude))

    deduped: List[Tuple[float, float]] = []
    for p in points:
        if not deduped or deduped[-1] != p:
            deduped.append(p)
    return deduped


def _closest_point_on_track(
    item_pos: Tuple[float, float], track_points: List[Tuple[float, float]]
) -> Tuple[float, Tuple[float, float]]:
    """Closest distance (meters) from item_pos to the polyline through track_points.

    Walks every segment of the track and keeps the best perpendicular
    distance, not just the distance to the recorded vertices - this is what
    correctly matches items that sit *between* two GPS fixes.
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
    track_points: List[Tuple[float, float]],
    found_items: List[FoundItem],
    radius_m: float = DEFAULT_RADIUS_M,
):
    """For every found item, find the closest point on the route (not just
    the closest recorded GPS vertex - see `_closest_point_on_track`).

    Returns a list of dicts: {item, distance_m, matched_track_point} for
    every item within radius_m of the route. Each item appears at most
    once (its best/closest match), sorted nearest-first.
    """
    matches = []

    for item in found_items:
        distance, closest_point = _closest_point_on_track((item.lat, item.lng), track_points)

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


def downsample_track(track_points: List[Tuple[float, float]], max_points: int = MAX_TRACK_POINTS_IN_RESPONSE):
    """Evenly thin out a track for the API response (map preview only)."""
    if len(track_points) <= max_points:
        return track_points

    step = len(track_points) / max_points
    indices = sorted({int(i * step) for i in range(max_points)})
    if indices[-1] != len(track_points) - 1:
        indices.append(len(track_points) - 1)  # always keep the final point
    return [track_points[i] for i in indices]
