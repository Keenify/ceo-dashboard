from sqlalchemy import Column, String, UUID, DateTime, Integer, Numeric, Date, Text
from sqlalchemy.dialects.postgresql import JSONB
from app.models import Base
import uuid
from datetime import datetime


class ProductivityLegend(Base):
    """Model for productivity legend entries (activity types with colors)."""
    __tablename__ = 'productivity_legends'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    number = Column(Integer, nullable=False)
    name = Column(String(100), nullable=False)
    color = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class ProductivityTracker(Base):
    """Model for daily productivity tracker entries."""
    __tablename__ = 'productivity_tracker'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    date = Column(Date, nullable=False)
    time_slots = Column(JSONB, default={})
    spent = Column(Numeric(10, 2), nullable=True)
    kg = Column(Numeric(5, 2), nullable=True)
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
