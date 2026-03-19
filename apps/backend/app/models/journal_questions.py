from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as SQLAlchemyUUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime
from typing import Optional
from uuid import UUID

from app.database.database import Base # Import Base from your database setup

class JournalQuestion(Base):
    __tablename__ = "journal_questions"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(String, nullable=False)
    template_id = Column(SQLAlchemyUUID(as_uuid=True), ForeignKey("journal_templates.id", ondelete="CASCADE"), nullable=True)
    position = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    template = relationship("JournalTemplate", back_populates="questions")
    entries = relationship("JournalEntry", back_populates="question")
