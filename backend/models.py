import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime
from database import Base


class FoundItem(Base):
    """A 'found' pin dropped on the map by someone who found lost gear."""

    __tablename__ = "found_items"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, nullable=False, index=True)
    description = Column(String, nullable=True)
    photo_path = Column(String, nullable=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class User(Base):
    """A registered TrailFound account."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    # "user" or "admin". The very first account ever registered is promoted
    # to admin automatically (see main.py) so the system is usable without a
    # manual DB edit; every account after that starts as a normal user.
    role = Column(String, nullable=False, default="user")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Placeholders for future external-service linking (Strava, Komoot,
    # Garmin). NULL means "not connected"; populated once real OAuth
    # connections are implemented. For now the profile page lets a user
    # store the external account id manually.
    strava_id = Column(String, nullable=True)
    komoot_id = Column(String, nullable=True)
    garmin_id = Column(String, nullable=True)
