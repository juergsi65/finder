"""Small geo helpers for the matching prototype."""
from math import radians, degrees, sin, cos, sqrt, atan2
from typing import Tuple

EARTH_RADIUS_M = 6371000.0


def haversine_distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two lat/lng points, in meters."""
    phi1, phi2 = radians(lat1), radians(lat2)
    d_phi = radians(lat2 - lat1)
    d_lambda = radians(lng2 - lng1)

    a = sin(d_phi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(d_lambda / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return EARTH_RADIUS_M * c


def to_local_xy(lat: float, lng: float, ref_lat: float, ref_lng: float) -> Tuple[float, float]:
    """Project a lat/lng point onto a local flat x/y plane (meters).

    Uses an equirectangular approximation around (ref_lat, ref_lng). This is
    only accurate over short distances (a few hundred meters, which is all
    that matters for 30m-radius matching) but is much cheaper than a proper
    geodesic projection and avoids pulling in a GIS dependency.
    """
    x = radians(lng - ref_lng) * cos(radians(ref_lat)) * EARTH_RADIUS_M
    y = radians(lat - ref_lat) * EARTH_RADIUS_M
    return x, y


def from_local_xy(x: float, y: float, ref_lat: float, ref_lng: float) -> Tuple[float, float]:
    """Inverse of to_local_xy: local meters -> (lat, lng)."""
    lat = ref_lat + degrees(y / EARTH_RADIUS_M)
    lng = ref_lng + degrees(x / (EARTH_RADIUS_M * cos(radians(ref_lat))))
    return lat, lng


def point_to_segment_distance_m(
    point: Tuple[float, float],
    seg_start: Tuple[float, float],
    seg_end: Tuple[float, float],
) -> Tuple[float, Tuple[float, float]]:
    """Shortest distance from `point` to the line segment seg_start->seg_end.

    All arguments are (lat, lng) tuples. Returns (distance_m, (lat, lng) of
    the closest point on the segment) - i.e. the perpendicular foot of the
    point on the segment, clamped to the segment's endpoints.

    This is what makes matching precise for real-world GPX tracks: GPS
    points are recorded every few seconds, so a lost item can easily sit
    *between* two recorded points, tens of meters from either one, while
    still being right next to the path itself.
    """
    ref_lat, ref_lng = point
    px, py = 0.0, 0.0  # point is the local origin by construction
    ax, ay = to_local_xy(seg_start[0], seg_start[1], ref_lat, ref_lng)
    bx, by = to_local_xy(seg_end[0], seg_end[1], ref_lat, ref_lng)

    dx, dy = bx - ax, by - ay
    seg_len_sq = dx * dx + dy * dy

    if seg_len_sq == 0:
        # Degenerate segment (duplicate consecutive points) - just the point itself.
        closest_x, closest_y = ax, ay
    else:
        t = ((px - ax) * dx + (py - ay) * dy) / seg_len_sq
        t = max(0.0, min(1.0, t))
        closest_x, closest_y = ax + t * dx, ay + t * dy

    distance = sqrt((px - closest_x) ** 2 + (py - closest_y) ** 2)
    closest_lat, closest_lng = from_local_xy(closest_x, closest_y, ref_lat, ref_lng)
    return distance, (closest_lat, closest_lng)
