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
