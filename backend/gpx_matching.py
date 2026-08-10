"""GPX parsing + radius matching logic - the core of the TrailFound matching prototype."""
from typing import List, Tuple
import gpxpy

from geo import haversine_distance_m
from models import FoundItem

DEFAULT_RADIUS_M = 30.0


def extract_track_points(gpx_bytes: bytes) -> List[Tuple[float, float]]:
    """Parse a GPX file and return a flat list of (lat, lng) points.

    Covers tracks, routes and waypoints so most GPX exports (Garmin,
    Strava, Komoot, ...) work out of the box.
    """
    gpx = gpxpy.parse(gpx_bytes.decode("utf-8"))
    points: List[Tuple[float, float]] = []

    for track in gpx.tracks:
        for segment in track.segments:
            for point in segment.points:
                points.append((point.latitude, point.longitude))

    for route in gpx.routes:
        for point in route.points:
            points.append((point.latitude, point.longitude))

    for waypoint in gpx.waypoints:
        points.append((waypoint.latitude, waypoint.longitude))

    return points


def find_matches(
    track_points: List[Tuple[float, float]],
    found_items: List[FoundItem],
    radius_m: float = DEFAULT_RADIUS_M,
):
    """For every found item, find the closest track point.

    Returns a list of dicts: {item, distance_m, matched_track_point}
    for every item whose closest track point is within radius_m.
    Each item appears at most once (its best/closest match).
    """
    matches = []

    for item in found_items:
        best_distance = None
        best_point = None
        for lat, lng in track_points:
            dist = haversine_distance_m(item.lat, item.lng, lat, lng)
            if best_distance is None or dist < best_distance:
                best_distance = dist
                best_point = (lat, lng)

        if best_distance is not None and best_distance <= radius_m:
            matches.append(
                {
                    "item": item,
                    "distance_m": round(best_distance, 1),
                    "matched_track_point": {"lat": best_point[0], "lng": best_point[1]},
                }
            )

    matches.sort(key=lambda m: m["distance_m"])
    return matches
