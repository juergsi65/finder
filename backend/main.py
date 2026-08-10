import os
import shutil
import uuid
from typing import Optional, List

from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import FoundItem
from schemas import FoundItemOut, MatchResponse, CATEGORIES
from gpx_matching import extract_track_points, find_matches, DEFAULT_RADIUS_M

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="TrailFound API", version="0.1.0")

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
def delete_found_item(item_id: int, db: Session = Depends(get_db)):
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
    given category against every track point, using a haversine distance
    calculation. Any pin within `radius_m` meters of the route is
    returned as a match.
    """
    if category not in CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Unbekannte Kategorie: {category}")

    raw = await gpx_file.read()
    try:
        track_points = extract_track_points(raw)
    except Exception as exc:  # noqa: BLE001 - surface parse errors to the user
        raise HTTPException(status_code=400, detail=f"GPX konnte nicht gelesen werden: {exc}")

    if not track_points:
        raise HTTPException(status_code=400, detail="Die GPX-Datei enthält keine Koordinaten.")

    found_items = db.query(FoundItem).filter(FoundItem.category == category).all()
    matches = find_matches(track_points, found_items, radius_m=radius_m)

    return MatchResponse(
        matched=len(matches) > 0,
        track_points_checked=len(track_points),
        radius_m=radius_m,
        matches=matches,
    )
