"""Strava OAuth connect + 'did you lose something today?' add-on.

Requires STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET to be configured (register
a free API application at https://www.strava.com/settings/api and point its
"Authorization Callback Domain" at this server). Without them, every route
here returns a clear 501 so the rest of the app keeps working - that's
inherent to any third-party OAuth integration, not something an operator can
shortcut around.
"""
import datetime
import os
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from database import get_db
from models import User
from auth import get_current_user
from gpx_matching import GpxPoint, DEFAULT_RADIUS_M
from search import build_search_response

STRAVA_CLIENT_ID = os.environ.get("STRAVA_CLIENT_ID")
STRAVA_CLIENT_SECRET = os.environ.get("STRAVA_CLIENT_SECRET")
STRAVA_REDIRECT_URI = os.environ.get("STRAVA_REDIRECT_URI", "http://localhost:8000/api/strava/callback")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

is_configured = bool(STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET)

router = APIRouter(prefix="/api/strava", tags=["strava"])


def _require_configured():
    if not is_configured:
        raise HTTPException(
            status_code=501,
            detail=(
                "Strava-Integration ist auf diesem Server nicht konfiguriert. "
                "Ein Admin muss STRAVA_CLIENT_ID/STRAVA_CLIENT_SECRET setzen "
                "(siehe README)."
            ),
        )


@router.get("/status")
def strava_status(current_user: User = Depends(get_current_user)):
    return {"configured": is_configured, "connected": current_user.strava_connected}


@router.get("/connect")
def strava_connect(current_user: User = Depends(get_current_user)):
    """Returns the Strava authorize URL for the frontend to navigate to.

    This endpoint itself is JWT-authenticated (so we know who's connecting),
    but the browser's follow-up redirect to Strava - and Strava's redirect
    back to /callback - can't carry an Authorization header. We thread the
    user id through as `state`, which is opaque to Strava and only
    meaningful to us; the callback below trusts it to know which account to
    attach the connection to.
    """
    _require_configured()
    authorize_url = (
        "https://www.strava.com/oauth/authorize"
        f"?client_id={STRAVA_CLIENT_ID}"
        f"&redirect_uri={STRAVA_REDIRECT_URI}"
        "&response_type=code"
        "&scope=activity:read_all"
        f"&state={current_user.id}"
    )
    return {"authorize_url": authorize_url}


@router.get("/callback")
async def strava_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Strava redirects the user's browser here after they approve/deny."""
    if not is_configured or error or not code or not state:
        return RedirectResponse(f"{FRONTEND_URL}/profil?strava=error")

    try:
        user_id = int(state)
    except ValueError:
        return RedirectResponse(f"{FRONTEND_URL}/profil?strava=error")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return RedirectResponse(f"{FRONTEND_URL}/profil?strava=error")

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://www.strava.com/oauth/token",
            data={
                "client_id": STRAVA_CLIENT_ID,
                "client_secret": STRAVA_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
            },
        )
    if resp.status_code != 200:
        return RedirectResponse(f"{FRONTEND_URL}/profil?strava=error")

    payload = resp.json()
    user.strava_access_token = payload.get("access_token")
    user.strava_refresh_token = payload.get("refresh_token")
    expires_at = payload.get("expires_at")
    user.strava_token_expires_at = (
        datetime.datetime.utcfromtimestamp(expires_at) if expires_at else None
    )
    athlete = payload.get("athlete") or {}
    if athlete.get("id"):
        user.strava_athlete_id = str(athlete["id"])
    db.commit()

    return RedirectResponse(f"{FRONTEND_URL}/profil?strava=connected")


@router.post("/disconnect")
def strava_disconnect(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.strava_access_token = None
    current_user.strava_refresh_token = None
    current_user.strava_token_expires_at = None
    current_user.strava_athlete_id = None
    db.commit()
    return {"ok": True}


async def _ensure_fresh_token(user: User, db: Session) -> str:
    now = datetime.datetime.utcnow()
    if user.strava_token_expires_at and user.strava_token_expires_at > now + datetime.timedelta(minutes=2):
        return user.strava_access_token

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://www.strava.com/oauth/token",
            data={
                "client_id": STRAVA_CLIENT_ID,
                "client_secret": STRAVA_CLIENT_SECRET,
                "grant_type": "refresh_token",
                "refresh_token": user.strava_refresh_token,
            },
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=502, detail="Strava-Zugang konnte nicht erneuert werden. Bitte im Profil neu verbinden."
        )

    payload = resp.json()
    user.strava_access_token = payload.get("access_token")
    user.strava_refresh_token = payload.get("refresh_token", user.strava_refresh_token)
    expires_at = payload.get("expires_at")
    user.strava_token_expires_at = (
        datetime.datetime.utcfromtimestamp(expires_at) if expires_at else None
    )
    db.commit()
    return user.strava_access_token


@router.get("/today-track")
async def strava_today_track(
    query: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    radius_m: float = Query(DEFAULT_RADIUS_M),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """'Hast du bei deiner heutigen Aktivität etwas verloren?' - fetches the
    latest Strava activity started today and runs it through the same
    matching logic as a GPX upload, returning the same SearchResponse
    shape."""
    _require_configured()
    if not current_user.strava_connected:
        raise HTTPException(status_code=400, detail="Bitte verbinde zuerst dein Strava-Konto im Profil.")

    access_token = await _ensure_fresh_token(current_user, db)
    headers = {"Authorization": f"Bearer {access_token}"}

    start_of_today = datetime.datetime.combine(datetime.date.today(), datetime.time.min)
    after_epoch = int(start_of_today.timestamp())

    async with httpx.AsyncClient(timeout=15) as client:
        activities_resp = await client.get(
            "https://www.strava.com/api/v3/athlete/activities",
            headers=headers,
            params={"after": after_epoch, "per_page": 5},
        )
        if activities_resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Aktivitäten konnten nicht von Strava geladen werden.")

        activities = activities_resp.json()
        if not activities:
            raise HTTPException(status_code=404, detail="Keine heutige Strava-Aktivität gefunden.")

        activity = activities[0]

        streams_resp = await client.get(
            f"https://www.strava.com/api/v3/activities/{activity['id']}/streams",
            headers=headers,
            params={"keys": "latlng", "key_by_type": "true"},
        )
        if streams_resp.status_code != 200:
            raise HTTPException(status_code=502, detail="GPS-Daten der Aktivität konnten nicht geladen werden.")

    latlng = (streams_resp.json().get("latlng") or {}).get("data") or []
    if not latlng:
        raise HTTPException(status_code=400, detail="Diese Aktivität enthält keine GPS-Daten.")

    track_points = [GpxPoint(lat=lat, lng=lng) for lat, lng in latlng]

    return build_search_response(
        track_points,
        db,
        category=category,
        query=query,
        radius_m=radius_m,
        source="strava",
        source_label=activity.get("name", "Heutige Aktivität"),
    )
