import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base

# Roles: "user" (default), "verein" (clubs/associations, e.g. local hiking
# clubs - same permissions as "user" today, modeled separately so the UI can
# badge them and so future club-specific features have somewhere to hang),
# "admin" (full moderation + user management). The very first account ever
# registered is promoted to admin automatically (see main.py) so the system
# is usable without a manual DB edit.
ROLES = ["user", "verein", "admin"]

STATUS_ACTIVE = "active"
STATUS_ARCHIVED = "archived"

REPORT_TYPE_LOST = "lost"
REPORT_TYPE_STOLEN = "stolen"
REPORT_TYPES = [REPORT_TYPE_LOST, REPORT_TYPE_STOLEN]


class User(Base):
    """A registered TrailFound account."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False, default="user")
    # Display name for "verein" accounts (the club's public name); optional
    # for regular users.
    display_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Manually-entered placeholders for future external-service linking
    # (Komoot, Garmin - no OAuth yet). Strava has real OAuth (see below).
    komoot_id = Column(String, nullable=True)
    garmin_id = Column(String, nullable=True)

    # Real Strava OAuth connection (see strava.py). NULL access_token means
    # "not connected". Tokens are opaque to the rest of the app.
    strava_athlete_id = Column(String, nullable=True)
    strava_access_token = Column(String, nullable=True)
    strava_refresh_token = Column(String, nullable=True)
    strava_token_expires_at = Column(DateTime, nullable=True)

    # Opt-in (GDPR-relevant, so explicit and off by default) radius alerts:
    # when someone else files a lost/stolen report near this user's home
    # location, they get emailed - see main.py's `_notify_nearby_users`.
    # home_lat/home_lng are only ever set if the user chose to share them
    # (via the map picker in Profil), never inferred.
    alert_opt_in = Column(Boolean, nullable=False, default=False)
    home_lat = Column(Float, nullable=True)
    home_lng = Column(Float, nullable=True)

    found_items = relationship("FoundItem", back_populates="reporter")

    @property
    def strava_connected(self) -> bool:
        return bool(self.strava_access_token)


class FoundItem(Base):
    """A 'found' pin dropped on the map by someone who found lost gear."""

    __tablename__ = "found_items"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    category = Column(String, nullable=False, index=True)
    description = Column(String, nullable=True)
    photo_path = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    # The date the item was actually found (defaults to "today" client-side
    # as a suggestion, but is stored as whatever the finder confirms/edits).
    found_date = Column(Date, nullable=False, default=datetime.date.today)
    status = Column(String, nullable=False, default=STATUS_ACTIVE, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    reporter = relationship("User", back_populates="found_items")
    conversations = relationship("Conversation", back_populates="found_item")


class LostItemReport(Base):
    """The mirror image of FoundItem: filed by the item's *owner* to report
    their own gear as lost or stolen (not by someone who found it). Filing
    one triggers a background radius alert - every user who opted in and
    saved a home location within ALERT_RADIUS_M of `lat`/`lng` gets emailed
    the details (see main.py's `_notify_nearby_users`)."""

    __tablename__ = "lost_item_reports"

    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    report_type = Column(String, nullable=False)  # "lost" | "stolen" - see REPORT_TYPES
    title = Column(String, nullable=False)
    category = Column(String, nullable=False, index=True)
    description = Column(String, nullable=True)
    # Serial/frame number - especially valuable for stolen bikes/equipment
    # so a finder (or the police) can positively identify the item later.
    # Always optional: not everyone has it on hand when filing the report.
    serial_number = Column(String, nullable=True)
    photo_path = Column(String, nullable=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    occurred_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    reporter = relationship("User", foreign_keys=[reporter_id])


class Conversation(Base):
    """A private two-party thread about one found item: the searcher who
    clicked 'Finder kontaktieren' and the item's original reporter. Contact
    details are never exposed to either party in the UI - new messages are
    relayed by the server via system email (see email_utils.py)."""

    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    found_item_id = Column(Integer, ForeignKey("found_items.id"), nullable=False)
    starter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    found_item = relationship("FoundItem", back_populates="conversations")
    starter = relationship("User", foreign_keys=[starter_id])
    messages = relationship("Message", back_populates="conversation", order_by="Message.created_at")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])


class AppSettings(Base):
    """Admin-editable runtime configuration (Strava OAuth app credentials,
    SMTP relay settings), stored in the database so an admin can set them
    from the web UI instead of editing .env files on the server.

    Always exactly one row (id=1) - a simple singleton settings table
    rather than a generic key/value store, since the set of settings is
    small and fixed. Any field left NULL here falls back to the matching
    environment variable (see settings_store.py) - operators can still
    bootstrap via .env/docker-compose and the DB only needs to hold
    overrides that were actually changed through the UI.

    Security note: secrets (strava_client_secret, smtp_password) are
    stored in plaintext in this table, protected only by the SQLite file's
    filesystem permissions and the admin-only API around it - there's no
    separate encryption-at-rest here. That's an accepted trade-off for a
    small self-hosted prototype; a production deployment with stricter
    requirements should pull these from a real secrets manager instead.
    """

    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, default=1)

    strava_client_id = Column(String, nullable=True)
    strava_client_secret = Column(String, nullable=True)
    strava_redirect_uri = Column(String, nullable=True)

    smtp_host = Column(String, nullable=True)
    smtp_port = Column(Integer, nullable=True)
    smtp_user = Column(String, nullable=True)
    smtp_password = Column(String, nullable=True)
    smtp_from = Column(String, nullable=True)

    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
