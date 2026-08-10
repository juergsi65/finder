import logging
import os
import shutil
import uuid
from typing import Optional, List

from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import FoundItem, User
from schemas import (
    FoundItemOut,
    MatchResponse,
    CATEGORIES,
    UserCreate,
    UserOut,
    Token,
    ProfileUpdate,
)
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    require_admin,
)
from gpx_matching import (
    extract_track_points,
    find_matches,
    downsample_track,
    track_time_range,
    GpxParseError,
    DEFAULT_RADIUS_M,
    MAX_RADIUS_M,
)

logger = logging.getLogger("trailfound")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="TrailFound API", version="0.2.0")

# Prototype: allow any origin so the Vite dev server (and any device on the
# LAN testing the mobile web app) can talk to the API without extra config.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/categories")
def get_categories():
    return CATEGORIES


@app.get("/api/found-items", response_model=List[FoundItemOut])
def list_found_items(category: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(FoundItem)
    if category:
        query = query.filter(FoundItem.category == category)
    return query.order_by(FoundItem.created_at.desc()).all()


@app.post("/api/found-items", response_model=FoundItemOut)
def create_found_item(
    category: str = Form(...),
    description: Optional[str] = Form(None),
    lat: float = Form(...),
    lng: float = Form(...),
    photo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    if category not in CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Unbekannte Kategorie: {category}")

    photo_path = None
    if photo is not None and photo.filename:
        ext = os.path.splitext(photo.filename)[1]
        filename = f"{uuid.uuid4().hex}{ext}"
        dest = os.path.join(UPLOAD_DIR, filename)
        with open(dest, "wb") as f:
            shutil.copyfileobj(photo.file, f)
        photo_path = f"/uploads/{filename}"

    item = FoundItem(
        category=category,
        description=description,
        photo_path=photo_path,
        lat=lat,
        lng=lng,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.delete("/api/found-items/{item_id}")
def delete_found_item(
    item_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    item = db.query(FoundItem).filter(FoundItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Nicht gefunden")
    db.delete(item)
    db.commit()
    return {"ok": True}


@app.post("/api/match", response_model=MatchResponse)
async def match_gpx(
    category: str = Form(...),
    radius_m: float = Form(DEFAULT_RADIUS_M),
    gpx_file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Core matching prototype endpoint.

    Parses the uploaded GPX track and checks every found-item pin of the
    given category against the whole route - not just the recorded GPS
    vertices, but the path *between* them too - using a perpendicular
    point-to-segment distance. Any pin within `radius_m` meters of the
    route is returned as a match.

    Every failure mode (bad category, bad radius, wrong file type, empty
    file, unparseable/corrupt GPX, GPX with no usable coordinates) is
    mapped to a 400 with a clear, German error message - this endpoint
    should never surface a raw traceback or an unhandled 500 for bad
    input.
    """
    if category not in CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Unbekannte Kategorie: {category}")

    if radius_m <= 0 or radius_m > MAX_RADIUS_M:
        raise HTTPException(
            status_code=400,
            detail=f"Radius muss zwischen 1 und {int(MAX_RADIUS_M)} Metern liegen.",
        )

    if gpx_file.filename and not gpx_file.filename.lower().endswith(".gpx"):
        raise HTTPException(status_code=400, detail="Bitte eine .gpx-Datei hochladen.")

    try:
        raw = await gpx_file.read()
    except Exception as exc:  # noqa: BLE001 - upload stream errors -> clean 400, not 500
        logger.warning("Konnte hochgeladene Datei nicht lesen: %s", exc)
        raise HTTPException(status_code=400, detail="Die Datei konnte nicht gelesen werden.")

    if not raw:
        raise HTTPException(status_code=400, detail="Die hochgeladene Datei ist leer.")

    try:
        track_points = extract_track_points(raw)
    except GpxParseError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # noqa: BLE001 - last-resort safety net, never a bare 500
        logger.exception("Unerwarteter Fehler beim GPX-Parsing")
        raise HTTPException(status_code=400, detail=f"GPX konnte nicht verarbeitet werden: {exc}")

    if not track_points:
        raise HTTPException(status_code=400, detail="Die GPX-Datei enthält keine Koordinaten.")

    try:
        found_items = db.query(FoundItem).filter(FoundItem.category == category).all()
        matches = find_matches(track_points, found_items, radius_m=radius_m)
        preview = downsample_track(track_points)
        started_at, finished_at = track_time_range(track_points)
    except Exception as exc:  # noqa: BLE001 - matching itself must not 500 either
        logger.exception("Unerwarteter Fehler beim Routenabgleich")
        raise HTTPException(status_code=400, detail=f"Routenabgleich fehlgeschlagen: {exc}")

    return MatchResponse(
        matched=len(matches) > 0,
        track_points_checked=len(track_points),
        radius_m=radius_m,
        matches=matches,
        track_preview=[{"lat": p.lat, "lng": p.lng} for p in preview],
        track_started_at=started_at,
        track_finished_at=finished_at,
    )


# --- Auth ---------------------------------------------------------------


@app.post("/api/auth/register", response_model=UserOut, status_code=201)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Diese E-Mail-Adresse ist bereits registriert.")

    # The very first account in a fresh install becomes admin automatically,
    # so the system is usable without a manual DB edit.
    is_first_user = db.query(User).count() == 0
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role="admin" if is_first_user else "user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/api/auth/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # OAuth2PasswordRequestForm's field is called "username" but we treat it
    # as the user's email - this keeps the endpoint spec-compliant with
    # FastAPI's/Swagger's standard "password flow" tooling.
    user = db.query(User).filter(User.email == form_data.username.strip().lower()).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="E-Mail oder Passwort ist falsch.")
    token = create_access_token(user.id)
    return Token(access_token=token)


@app.get("/api/auth/me", response_model=UserOut)
def read_me(current_user: User = Depends(get_current_user)):
    return current_user


@app.patch("/api/auth/me", response_model=UserOut)
def update_me(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value or None)
    db.commit()
    db.refresh(current_user)
    return current_user


# --- Admin ----------------------------------------------------------------


@app.get("/api/admin/users", response_model=List[UserOut])
def admin_list_users(_admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(User).order_by(User.created_at.desc()).all()


@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(
    user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Du kannst dich nicht selbst löschen.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Nutzer nicht gefunden.")
    db.delete(user)
    db.commit()
    return {"ok": True}


@app.get("/api/admin/stats")
def admin_stats(_admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return {
        "users": db.query(User).count(),
        "found_items": db.query(FoundItem).count(),
    }
