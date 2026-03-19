from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as SQLAlchemyUUID
from sqlalchemy.orm import relationship
from app.models import Base
from datetime import datetime

class UserNotepad(Base):
    __tablename__ = 'annual_calendar_plans_notepads'

    user_id = Column(SQLAlchemyUUID(as_uuid=True), ForeignKey('auth.users.id', ondelete='CASCADE'), primary_key=True)
    content = Column(Text, nullable=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships can be added here if needed in the future
    # For example, if you add related tables like notepad versions, sharing, etc. 