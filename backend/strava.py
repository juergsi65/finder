"""Strava OAuth connect + 'did you lose something today?' add-on.

Requires a Strava OAuth app's Client ID/Secret to be configured - either
via STRAVA_CLIENT_ID/STRAVA_CLIENT_SECRET env vars, or (since they can also
be set live from Admin -> API-Konfiguration without a redeploy) via
settings_store, which takes precedence. Register a free API application at
https://www.strava.com/settings/api and point its "Authorization Callback
Domain" at this server. Without credentials configured, every route here
returns a clear 501 so the rest of the app keeps working - that's inherent
to any third-party OAuth integration, not something an operator can
shortcut around.
"""
import datetime
import logging
import os
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from database import get_db
from models import User
from auth import get_current_user
from gpx_matching import GpxPoint, DEFAULT_RADIUS_M
from search import build_search_response
from settings_store import get_strava_config

logger = logging.getLogger("trailfound.strava")

# MUST be the app's real public origin in production (e.g.
# https://finder.wsmronline.uk) - this is where Strava sends the user's
# browser back to after they approve/deny the connection. Left at the
# localhost default, every OAuth attempt still *saves the token correctly*
# but then redirects the user's browser to a dead localhost URL, which
# looks exactly like "the app doesn't remember I connected" even though the
# DB write succeeded. Set FRONTEND_URL in the backend container's real
# environment (docker-compose.yml / .env), not just for local dev.
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

router = APIRouter(prefix="/api/strava", tags=["strava"])


def _clear_connection(user: User) -> None:
    """Wipes a user's stored Strava connection - used both for the
    explicit 'Trennen' button and when a refresh_token turns out to be
    permanently dead (revoked/expired), so `strava_connected` correctly
    flips back to False and the UI offers a clean 'Verbinden' again
    instead of getting stuck showing 'connected' with a broken feature."""
    user.strava_access_token = None
    user.strava_refresh_token = None
    user.strava_token_expires_at = None
    user.strava_athlete_id = None


def _require_configured(db: Session):
    config = get_strava_config(db)
    if not config.is_configured:
        raise HTTPException(
            status_code=501,
            detail=(
                "Strava-Integration ist auf diesem Server nicht konfiguriert. "
                "Ein Admin kann Client-ID/-Secret unter Admin -> "
                "API-Konfiguration eintragen."
            ),
        )
    return config


@router.get("/status")
def strava_status(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    config = get_strava_config(db)
    return {"configured": config.is_configured, "connected": current_user.strava_connected}


@router.get("/connect")
def strava_connect(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Returns the Strava authorize URL for the frontend to navigate to.

    This endpoint itself is JWT-authenticated (so we know who's connecting),
    but the browser's follow-up redirect to Strava - and Strava's redirect
    back to /callback - can't carry an Authorization header. We thread the
    user id through as `state`, which is opaque to Strava and only
    meaningful to us; the callback below trusts it to know which account to
    attach the connection to.
    """
    config = _require_configured(db)
    # urlencode (not an f-string) so redirect_uri/client_id can never
    # corrupt the query string, however they're configured.
    params = urlencode(
        {
            "client_id": config.client_id,
            "redirect_uri": config.redirect_uri,
            "response_type": "code",
            "scope": "activity:read_all",
            "state": current_user.id,
        }
    )
    logger.info(
        "Strava-Connect für user_id %s - redirect_uri=%s (muss exakt so unter strava.com/settings/api registriert sein)",
        current_user.id, config.redirect_uri,
    )
    return {"authorize_url": f"https://www.strava.com/oauth/authorize?{params}"}


@router.get("/callback")
async def strava_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Strava redirects the user's browser here after they approve/deny.

    Every failure path is logged server-side (status/body from Strava,
    never the client secret) before redirecting to a generic
    ?strava=error - the redirect itself can't carry a useful error message
    to the user, so `docker compose logs backend` has to be where the real
    reason shows up.
    """
    config = get_strava_config(db)
    if not config.is_configured:
        logger.warning("Strava-Callback erhalten, aber Strava ist nicht konfiguriert (state=%s)", state)
        return RedirectResponse(f"{FRONTEND_URL}/profil?strava=error")
    if error:
        logger.info("Strava-Autorisierung vom Nutzer abgelehnt oder fehlgeschlagen: %s", error)
        return RedirectResponse(f"{FRONTEND_URL}/profil?strava=error")
    if not code or not state:
        logger.warning("Strava-Callback ohne code/state aufgerufen - unvollständiger Redirect?")
        return RedirectResponse(f"{FRONTEND_URL}/profil?strava=error")

    try:
        user_id = int(state)
    except ValueError:
        logger.warning("Strava-Callback mit ungültigem state erhalten: %r", state)
        return RedirectResponse(f"{FRONTEND_URL}/profil?strava=error")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        logger.warning("Strava-Callback für unbekannte user_id %s", user_id)
        return RedirectResponse(f"{FRONTEND_URL}/profil?strava=error")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://www.strava.com/oauth/token",
                data={
                    "client_id": config.client_id,
                    "client_secret": config.client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                },
            )
    except httpx.HTTPError as exc:
        logger.exception("Strava-Token-Austausch für user_id %s fehlgeschlagen (Netzwerkfehler): %s", user_id, exc)
        return RedirectResponse(f"{FRONTEND_URL}/profil?strava=error")

    if resp.status_code != 200:
        # Strava's error body (e.g. "invalid redirect_uri", "invalid client_id")
        # is the single most useful diagnostic for a broken alpha deploy -
        # log it in full server-side, never surface it to the browser/redirect.
        logger.error(
            "Strava-Token-Austausch für user_id %s fehlgeschlagen: HTTP %s - %s",
            user_id, resp.status_code, resp.text[:500],
        )
        return RedirectResponse(f"{FRONTEND_URL}/profil?strava=error")

    payload = resp.json()
    access_token = payload.get("access_token")
    refresh_token = payload.get("refresh_token")
    if not access_token or not refresh_token:
        # A 200 with a malformed body should never be treated as a
        # successful connection - without this check we'd silently save
        # None/None and still redirect to "connected".
        logger.error("Strava-Token-Antwort für user_id %s ohne access_token/refresh_token: %r", user_id, payload)
        return RedirectResponse(f"{FRONTEND_URL}/profil?strava=error")

    user.strava_access_token = access_token
    user.strava_refresh_token = refresh_token
    expires_at = payload.get("expires_at")
    user.strava_token_expires_at = (
        datetime.datetime.utcfromtimestamp(expires_at) if expires_at else None
    )
    athlete = payload.get("athlete") or {}
    if athlete.get("id"):
        user.strava_athlete_id = str(athlete["id"])
    db.commit()
    logger.info("Strava erfolgreich verbunden für user_id %s (athlete_id=%s)", user_id, user.strava_athlete_id)

    return RedirectResponse(f"{FRONTEND_URL}/profil?strava=connected")


@router.post("/disconnect")
def strava_disconnect(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _clear_connection(current_user)
    db.commit()
    return {"ok": True}


async def _ensure_fresh_token(user: User, config, db: Session) -> str:
    """Returns a valid access token, transparently refreshing it first if
    it's expired (or expiring within 2 minutes) - this is the whole point
    of storing refresh_token/expires_at at all: callers never need to
    re-run the OAuth flow just because an hour passed."""
    now = datetime.datetime.utcnow()
    if user.strava_token_expires_at and user.strava_token_expires_at > now + datetime.timedelta(minutes=2):
        return user.strava_access_token

    if not user.strava_refresh_token:
        # Shouldn't normally happen (strava_connected implies a refresh
        # token was saved), but a partially-migrated/corrupted row must
        # not crash with an unhandled TypeError from httpx.
        _clear_connection(user)
        db.commit()
        raise HTTPException(status_code=400, detail="Strava ist nicht verbunden. Bitte im Profil verbinden.")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://www.strava.com/oauth/token",
                data={
                    "client_id": config.client_id,
                    "client_secret": config.client_secret,
                    "grant_type": "refresh_token",
                    "refresh_token": user.strava_refresh_token,
                },
            )
    except httpx.HTTPError as exc:
        logger.exception("Strava-Token-Refresh für user_id %s fehlgeschlagen (Netzwerkfehler): %s", user.id, exc)
        raise HTTPException(status_code=502, detail="Strava ist gerade nicht erreichbar. Bitte später erneut versuchen.")

    if resp.status_code in (400, 401):
        # invalid_grant: the refresh_token itself is dead (revoked on
        # Strava's side, or a previous refresh already rotated it and this
        # is a stale copy) - no amount of retrying fixes this, so clear the
        # connection now rather than 502'ing forever on every future call.
        logger.warning(
            "Strava-Refresh-Token für user_id %s ungültig (HTTP %s) - Verbindung wird zurückgesetzt: %s",
            user.id, resp.status_code, resp.text[:500],
        )
        _clear_connection(user)
        db.commit()
        raise HTTPException(
            status_code=400, detail="Strava-Verbindung ist abgelaufen. Bitte im Profil neu verbinden."
        )

    if resp.status_code != 200:
        # Transient (5xx, rate limit, ...) - leave the still-possibly-valid
        # tokens in place and let the caller retry, instead of forcing a
        # full reconnect over a temporary Strava outage.
        logger.error(
            "Strava-Token-Refresh für user_id %s fehlgeschlagen: HTTP %s - %s",
            user.id, resp.status_code, resp.text[:500],
        )
        raise HTTPException(
            status_code=502, detail="Strava-Zugang konnte nicht erneuert werden. Bitte später erneut versuchen."
        )

    payload = resp.json()
    access_token = payload.get("access_token")
    if not access_token:
        logger.error("Strava-Refresh für user_id %s: HTTP 200 ohne access_token: %r", user.id, payload)
        raise HTTPException(status_code=502, detail="Strava-Zugang konnte nicht erneuert werden. Bitte später erneut versuchen.")

    user.strava_access_token = access_token
    # Strava rotates the refresh_token on some (not all) refreshes - always
    # persist whatever it returns, falling back to the existing one only if
    # the response omits it entirely, otherwise the next refresh uses a
    # stale token and fails.
    user.strava_refresh_token = payload.get("refresh_token") or user.strava_refresh_token
    expires_at = payload.get("expires_at")
    user.strava_token_expires_at = (
        datetime.datetime.utcfromtimestamp(expires_at) if expires_at else None
    )
    db.commit()
    logger.info("Strava-Token für user_id %s erneuert, gültig bis %s", user.id, user.strava_token_expires_at)
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
    config = _require_configured(db)
    if not current_user.strava_connected:
        raise HTTPException(status_code=400, detail="Bitte verbinde zuerst dein Strava-Konto im Profil.")

    access_token = await _ensure_fresh_token(current_user, config, db)
    headers = {"Authorization": f"Bearer {access_token}"}

    start_of_today = datetime.datetime.combine(datetime.date.today(), datetime.time.min)
    after_epoch = int(start_of_today.timestamp())

    async with httpx.AsyncClient(timeout=15) as client:
        activities_resp = await client.get(
            "https://www.strava.com/api/v3/athlete/activities",
            headers=headers,
            params={"after": after_epoch, "per_page": 5},
        )
        if activities_resp.status_code in (401, 403):
            # The access token is fresh (we just refreshed it above), so a
            # 401/403 here means Strava itself revoked/rejected it - most
            # commonly the user revoked TrailFound's access from their
            # Strava account settings, or the app's scope no longer covers
            # activity:read_all. Clear the stale connection so the UI
            # offers a clean reconnect instead of repeating this error.
            logger.warning(
                "Strava-Aktivitäten für user_id %s: HTTP %s - Verbindung wird zurückgesetzt: %s",
                current_user.id, activities_resp.status_code, activities_resp.text[:500],
            )
            _clear_connection(current_user)
            db.commit()
            raise HTTPException(
                status_code=400, detail="Strava-Verbindung ist nicht mehr gültig. Bitte im Profil neu verbinden."
            )
        if activities_resp.status_code != 200:
            logger.error(
                "Strava-Aktivitäten für user_id %s fehlgeschlagen: HTTP %s - %s",
                current_user.id, activities_resp.status_code, activities_resp.text[:500],
            )
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
            logger.error(
                "Strava-GPS-Streams für Aktivität %s (user_id %s) fehlgeschlagen: HTTP %s - %s",
                activity.get("id"), current_user.id, streams_resp.status_code, streams_resp.text[:500],
            )
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
