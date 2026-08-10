import datetime
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

from database import Base, engine, get_db, run_lightweight_migrations
from models import FoundItem, User, Conversation, Message, AppSettings, STATUS_ACTIVE, STATUS_ARCHIVED
from schemas import (
    FoundItemOut,
    SearchResponse,
    CATEGORIES,
    UserCreate,
    UserOut,
    Token,
    ProfileUpdate,
    MessageCreate,
    MessageOut,
    ConversationOut,
    AppSettingsOut,
    AppSettingsUpdate,
)
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    require_admin,
)
from geo import haversine_distance_m
from gpx_matching import extract_track_points, GpxParseError, DEFAULT_RADIUS_M, MAX_RADIUS_M
from search import build_search_response
from email_utils import send_new_message_notification
from settings_store import get_or_create_settings, get_strava_config, get_smtp_config
import strava

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("trailfound")

MAX_NEARBY_RADIUS_M = 500_000.0  # 500km - generous upper bound, just sanity-checks input
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

Base.metadata.create_all(bind=engine)
run_lightweight_migrations()

app = FastAPI(title="TrailFound API", version="0.4.0")

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
app.include_router(strava.router)


@app.get("/api/health")
def health():
    # Includes the API version so a deploy can be verified with a single
    # `curl .../api/health` - e.g. to confirm a container is actually
    # running the code you just pushed, not a stale cached image.
    return {"status": "ok", "version": app.version}


@app.get("/api/categories")
def get_categories():
    return CATEGORIES


# --- Found items ----------------------------------------------------------


@app.get("/api/found-items", response_model=List[FoundItemOut])
def list_found_items(
    category: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_m: Optional[float] = None,
    db: Session = Depends(get_db),
):
    """List active found-item pins for the map/search.

    Archived (handed-back) items never show up here. When `lat`/`lng` are
    given (the browsing user's own position), every item is annotated with
    `distance_m` and the list is sorted nearest-first; pass `radius_m` too
    to only return items within that radius (e.g. to power a fast
    "X Gegenstände in deiner Nähe" count). Without `lat`/`lng`, all active
    items are returned newest-first.
    """
    if radius_m is not None and (radius_m <= 0 or radius_m > MAX_NEARBY_RADIUS_M):
        raise HTTPException(
            status_code=400,
            detail=f"Radius muss zwischen 1 und {int(MAX_NEARBY_RADIUS_M)} Metern liegen.",
        )

    query = db.query(FoundItem).filter(FoundItem.status == STATUS_ACTIVE)
    if category:
        query = query.filter(FoundItem.category == category)
    items = query.order_by(FoundItem.created_at.desc()).all()

    if lat is None or lng is None:
        return items

    annotated = []
    for item in items:
        distance = haversine_distance_m(lat, lng, item.lat, item.lng)
        if radius_m is not None and distance > radius_m:
            continue
        out = FoundItemOut.model_validate(item)
        out.distance_m = round(distance, 1)
        annotated.append(out)

    annotated.sort(key=lambda i: i.distance_m)
    return annotated


@app.get("/api/found-items/{item_id}", response_model=FoundItemOut)
def get_found_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(FoundItem).filter(FoundItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Fund-Pin nicht gefunden.")
    return item


@app.post("/api/found-items", response_model=FoundItemOut, status_code=201)
def create_found_item(
    title: str = Form(...),
    category: str = Form(...),
    description: Optional[str] = Form(None),
    lat: float = Form(...),
    lng: float = Form(...),
    found_date: Optional[str] = Form(None),
    photo: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if category not in CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Unbekannte Kategorie: {category}")

    title = title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Bitte einen Titel angeben.")

    if not photo.filename:
        raise HTTPException(status_code=400, detail="Bitte ein Foto hochladen - das ist Pflicht.")

    parsed_date = datetime.date.today()
    if found_date:
        try:
            parsed_date = datetime.date.fromisoformat(found_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Ungültiges Funddatum (Format: JJJJ-MM-TT).")
        if parsed_date > datetime.date.today():
            raise HTTPException(status_code=400, detail="Das Funddatum darf nicht in der Zukunft liegen.")

    ext = os.path.splitext(photo.filename)[1]
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = os.path.join(UPLOAD_DIR, filename)
    with open(dest, "wb") as f:
        shutil.copyfileobj(photo.file, f)
    photo_path = f"/uploads/{filename}"

    item = FoundItem(
        title=title,
        category=category,
        description=description,
        photo_path=photo_path,
        lat=lat,
        lng=lng,
        found_date=parsed_date,
        reporter_id=current_user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.patch("/api/found-items/{item_id}", response_model=FoundItemOut)
def update_found_item_status(
    item_id: int,
    status_value: str = Form(..., alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Archive ("übergeben/erledigt") or restore a found item.

    Allowed for the item's own reporter (they know best when it's been
    handed back) or an admin (moderation).
    """
    if status_value not in (STATUS_ACTIVE, STATUS_ARCHIVED):
        raise HTTPException(status_code=400, detail=f"Ungültiger Status: {status_value}")

    item = db.query(FoundItem).filter(FoundItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Fund-Pin nicht gefunden.")

    if current_user.role != "admin" and current_user.id != item.reporter_id:
        raise HTTPException(status_code=403, detail="Nur der Melder oder ein Admin kann den Status ändern.")

    item.status = status_value
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


# --- Search (GPX upload) ---------------------------------------------------


@app.post("/api/search/gpx", response_model=SearchResponse)
async def search_gpx(
    query: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    radius_m: float = Form(DEFAULT_RADIUS_M),
    gpx_file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a GPX track + optional search term/category; returns only the
    active found items that lie within radius_m of the route.

    Every failure mode (bad radius, wrong file type, empty file,
    unparseable/corrupt GPX, GPX with no usable coordinates) maps to a
    clean 400 with a specific German message - never a raw traceback or an
    unhandled 500.
    """
    if category and category not in CATEGORIES:
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
        return build_search_response(track_points, db, category=category, query=query, radius_m=radius_m)
    except Exception as exc:  # noqa: BLE001 - matching itself must not 500 either
        logger.exception("Unerwarteter Fehler beim Such-Abgleich")
        raise HTTPException(status_code=400, detail=f"Abgleich fehlgeschlagen: {exc}")


# --- Auth ---------------------------------------------------------------


@app.post("/api/auth/register", response_model=UserOut, status_code=201)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Diese E-Mail-Adresse ist bereits registriert.")

    # The very first account in a fresh install becomes admin automatically,
    # so the system is usable without a manual DB edit. Nobody can
    # self-select "admin" via the API - only "user" or "verein".
    is_first_user = db.query(User).count() == 0
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role="admin" if is_first_user else payload.role,
        display_name=payload.display_name,
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


# --- Messaging ("Finder kontaktieren") -------------------------------------


def _conversation_to_out(conv: Conversation, viewer_id: int) -> ConversationOut:
    other_id = conv.starter_id if viewer_id != conv.starter_id else conv.found_item.reporter_id
    return ConversationOut(
        id=conv.id,
        found_item=FoundItemOut.model_validate(conv.found_item),
        starter_id=conv.starter_id,
        other_participant_id=other_id,
        created_at=conv.created_at,
        messages=[MessageOut.model_validate(m) for m in conv.messages],
    )


@app.post("/api/found-items/{item_id}/contact", response_model=ConversationOut, status_code=201)
def contact_finder(
    item_id: int,
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Starts (or continues) a private conversation with the item's finder.
    Neither party's email address is ever exposed in the API response -
    only a relay email is sent server-side."""
    item = db.query(FoundItem).filter(FoundItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Fund-Pin nicht gefunden.")
    if item.reporter_id == current_user.id:
        raise HTTPException(status_code=400, detail="Das ist dein eigener Fund-Pin.")

    conv = (
        db.query(Conversation)
        .filter(Conversation.found_item_id == item_id, Conversation.starter_id == current_user.id)
        .first()
    )
    if not conv:
        conv = Conversation(found_item_id=item_id, starter_id=current_user.id)
        db.add(conv)
        db.flush()

    message = Message(conversation_id=conv.id, sender_id=current_user.id, body=payload.body)
    db.add(message)
    db.commit()
    db.refresh(conv)

    send_new_message_notification(
        get_smtp_config(db),
        item.reporter.email,
        item.title,
        payload.body,
        app_url=f"{FRONTEND_URL}/nachrichten/{conv.id}",
    )

    return _conversation_to_out(conv, current_user.id)


@app.get("/api/conversations", response_model=List[ConversationOut])
def list_conversations(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    convs = (
        db.query(Conversation)
        .join(FoundItem, Conversation.found_item_id == FoundItem.id)
        .filter((Conversation.starter_id == current_user.id) | (FoundItem.reporter_id == current_user.id))
        .order_by(Conversation.created_at.desc())
        .all()
    )
    return [_conversation_to_out(c, current_user.id) for c in convs]


def _require_participant(conv: Conversation, user: User) -> None:
    # Admins can open any conversation read/write for moderation purposes
    # (e.g. following up on a report) - everyone else must be a participant.
    if user.role == "admin":
        return
    if user.id != conv.starter_id and user.id != conv.found_item.reporter_id:
        raise HTTPException(status_code=403, detail="Du bist kein Teil dieser Unterhaltung.")


@app.get("/api/conversations/{conversation_id}", response_model=ConversationOut)
def get_conversation(
    conversation_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Unterhaltung nicht gefunden.")
    _require_participant(conv, current_user)
    return _conversation_to_out(conv, current_user.id)


@app.post("/api/conversations/{conversation_id}/messages", response_model=ConversationOut, status_code=201)
def add_message(
    conversation_id: int,
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Unterhaltung nicht gefunden.")
    _require_participant(conv, current_user)

    message = Message(conversation_id=conv.id, sender_id=current_user.id, body=payload.body)
    db.add(message)
    db.commit()
    db.refresh(conv)

    other_id = conv.starter_id if current_user.id != conv.starter_id else conv.found_item.reporter_id
    other = db.query(User).filter(User.id == other_id).first()
    if other:
        send_new_message_notification(
            get_smtp_config(db),
            other.email,
            conv.found_item.title,
            payload.body,
            app_url=f"{FRONTEND_URL}/nachrichten/{conv.id}",
        )

    return _conversation_to_out(conv, current_user.id)


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


@app.get("/api/admin/found-items", response_model=List[FoundItemOut])
def admin_list_found_items(
    status_filter: Optional[str] = None,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """All found items regardless of status, for moderation - unlike the
    public GET /api/found-items, this can also show archived ones."""
    query = db.query(FoundItem)
    if status_filter:
        query = query.filter(FoundItem.status == status_filter)
    return query.order_by(FoundItem.created_at.desc()).all()


@app.get("/api/admin/stats")
def admin_stats(_admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return {
        "users": db.query(User).count(),
        "found_items_active": db.query(FoundItem).filter(FoundItem.status == STATUS_ACTIVE).count(),
        "found_items_archived": db.query(FoundItem).filter(FoundItem.status == STATUS_ARCHIVED).count(),
        "conversations": db.query(Conversation).count(),
    }


@app.get("/api/admin/conversations", response_model=List[ConversationOut])
def admin_list_conversations(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """All conversations across all users, for moderation - an admin isn't a
    participant in these, so this bypasses the normal starter/reporter
    check that GET /api/conversations relies on."""
    convs = db.query(Conversation).order_by(Conversation.created_at.desc()).all()
    return [_conversation_to_out(c, admin.id) for c in convs]


@app.get("/api/admin/settings", response_model=AppSettingsOut)
def admin_get_settings(_admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Current API configuration (Strava OAuth app, SMTP relay), so an
    admin can manage it from the web UI instead of editing .env files on
    the server. Secrets are never echoed back in plaintext - only whether
    one is currently set."""
    settings = get_or_create_settings(db)
    strava_cfg = get_strava_config(db)
    smtp_cfg = get_smtp_config(db)
    return AppSettingsOut(
        strava_client_id=strava_cfg.client_id,
        strava_client_secret_set=bool(strava_cfg.client_secret),
        strava_redirect_uri=strava_cfg.redirect_uri,
        strava_configured=strava_cfg.is_configured,
        smtp_host=smtp_cfg.host,
        smtp_port=smtp_cfg.port,
        smtp_user=smtp_cfg.user,
        smtp_password_set=bool(smtp_cfg.password),
        smtp_from=smtp_cfg.from_address,
        smtp_configured=smtp_cfg.is_configured,
        updated_at=settings.updated_at,
    )


@app.put("/api/admin/settings", response_model=AppSettingsOut)
def admin_update_settings(
    payload: AppSettingsUpdate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Only fields actually present in the request body are changed
    (exclude_unset) - an admin editing just the SMTP section doesn't wipe
    out a previously-saved Strava secret they didn't touch. Send an
    explicit empty string for a field to clear it back to the environment
    default."""
    settings = get_or_create_settings(db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings, field, value if value != "" else None)
    db.commit()

    return admin_get_settings(_admin, db)
