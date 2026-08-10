import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Date, ForeignKey, Text
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
