from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID as SQLAlchemyUUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime
from typing import Optional
from uuid import UUID

from app.database.database import Base

class JournalTemplate(Base):
    __tablename__ = "journal_templates"

    id = Column(SQLAlchemyUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"), index=True)
    user_id = Column(SQLAlchemyUUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    is_default = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="journal_templates")
    questions = relationship("JournalQuestion", back_populates="template", cascade="all, delete-orphan")
    entries = relationship("JournalEntry", back_populates="template")