from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as SQLAlchemyUUID # Use specific type for UUID
from sqlalchemy.sql import func # For default created_at
from sqlalchemy.orm import relationship
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from app.database.database import Base # Import the Base from your database setup

class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(SQLAlchemyUUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("journal_questions.id", ondelete="CASCADE"), nullable=False)
    template_id = Column(SQLAlchemyUUID(as_uuid=True), ForeignKey("journal_templates.id", ondelete="SET NULL"), nullable=True)
    entry_date = Column(Date, nullable=False, index=True)
    answer = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="journal_entries")
    template = relationship("JournalTemplate", back_populates="entries")
    question = relationship("JournalQuestion", back_populates="entries")
