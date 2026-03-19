from sqlalchemy import Column, String, UUID, DateTime, Text, Numeric
from app.models import Base
import uuid
from datetime import datetime


class NotableEvent(Base):
    """Model for notable events entries (events, food, movies, games, purchases)."""
    __tablename__ = 'notable_events'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    events = Column(Text, nullable=True)
    food = Column(Text, nullable=True)
    movies_tv = Column(Text, nullable=True)
    games = Column(Text, nullable=True)
    major_purchases = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
