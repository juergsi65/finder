"""Database setup for TrailFound.

Uses SQLite for the prototype. Coordinates are stored as plain float
columns (lat/lng) and matching is done with a haversine distance
calculation in Python (see geo.py) instead of a PostGIS radius query -
this keeps the prototype dependency-free while still being correct for
the 30m matching use case. Swapping to PostgreSQL + PostGIS later only
requires changing this module and the queries in main.py.
"""
import datetime
import logging
import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base

logger = logging.getLogger("trailfound.db")

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


def _column_migrations():
    """Columns that current models declare but that a `trailfound.db`
    created by an older version of this app (before that field existed)
    won't have yet.

    `Base.metadata.create_all()` only creates missing TABLES - it never
    alters an existing table to add a column a newer model introduced, so
    without this, every deploy onto a pre-existing database volume would
    immediately start throwing "no such column" on the first query that
    touches a field added since. This is a minimal stand-in for a real
    migration tool (Alembic) appropriate for this prototype's single-file
    SQLite setup; each entry is idempotent (skipped once the column
    exists) and safe to run on every startup, including brand-new installs
    (where the table itself won't exist yet and the whole entry is skipped
    - create_all() already built it correctly with every current column).
    """
    # SQLite's ALTER TABLE ADD COLUMN only accepts a *constant* DEFAULT -
    # CURRENT_DATE/CURRENT_TIMESTAMP work fine in CREATE TABLE but are
    # rejected here ("Cannot add a column with non-constant default"), so
    # found_date's backfill value has to be a literal computed in Python at
    # migration time (today, for whatever it's worth on legacy rows) rather
    # than a SQL-side "now" expression.
    today_literal = datetime.date.today().isoformat()
    return [
        # (table, column, SQLite column-definition DDL fragment)
        ("found_items", "title", "VARCHAR NOT NULL DEFAULT 'Ohne Titel'"),
        ("found_items", "found_date", f"DATE NOT NULL DEFAULT '{today_literal}'"),
        ("found_items", "status", "VARCHAR NOT NULL DEFAULT 'active'"),
        # No DEFAULT possible (no user id is universally correct for old
        # rows, and SQLite can't add a NOT NULL column without one) - old
        # rows simply end up with no reporter, which FoundItemOut.reporter
        # already models as Optional for exactly this reason.
        ("found_items", "reporter_id", "INTEGER"),
        ("users", "display_name", "VARCHAR"),
        ("users", "komoot_id", "VARCHAR"),
        ("users", "garmin_id", "VARCHAR"),
        ("users", "strava_athlete_id", "VARCHAR"),
        ("users", "strava_access_token", "VARCHAR"),
        ("users", "strava_refresh_token", "VARCHAR"),
        ("users", "strava_token_expires_at", "DATETIME"),
        ("users", "alert_opt_in", "BOOLEAN NOT NULL DEFAULT 0"),
        ("users", "home_lat", "FLOAT"),
        ("users", "home_lng", "FLOAT"),
        ("app_settings", "resend_api_key", "VARCHAR"),
        ("app_settings", "resend_from", "VARCHAR"),
    ]


def run_lightweight_migrations():
    """Add any columns current models expect that an existing SQLite file
    predates. Call once at startup, after Base.metadata.create_all()."""
    migrations = _column_migrations()
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    # Snapshot each affected table's columns once, up front - not
    # re-inspected between ALTERs, since none of these additions depend on
    # each other and re-querying schema state mid-transaction on SQLite can
    # be unreliable across connections.
    columns_by_table = {
        table: {c["name"] for c in inspector.get_columns(table)}
        for table in {t for t, _, _ in migrations}
        if table in existing_tables
    }

    with engine.begin() as conn:
        for table, column, ddl in migrations:
            if table not in existing_tables or column in columns_by_table.get(table, set()):
                continue
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
            logger.info("Migration: added column %s.%s", table, column)
