"""Database setup for TrailFound.

Uses SQLite for the prototype. Coordinates are stored as plain float
columns (lat/lng) and matching is done with a haversine distance
calculation in Python (see geo.py) instead of a PostGIS radius query -
this keeps the prototype dependency-free while still being correct for
the 30m matching use case. Swapping to PostgreSQL + PostGIS later only
requires changing this module and the queries in main.py.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# DATA_DIR is overridable via env var so a Docker volume can be mounted at
# a single path (e.g. /app/data) to persist the SQLite file across restarts.
DATA_DIR = os.environ.get("DATA_DIR", os.path.join(BASE_DIR, "data"))
os.makedirs(DATA_DIR, exist_ok=True)

DATABASE_URL = f"sqlite:///{os.path.join(DATA_DIR, 'trailfound.db')}"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
