from sqlalchemy import Column, String, UUID, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.models import Base
from datetime import datetime

class AIJournalAnalysis(Base):
    __tablename__ = 'ai_journal_analyses'

    session_id = Column(UUID(as_uuid=True), ForeignKey('ai_journal_sessions.id', ondelete='CASCADE'), primary_key=True)
    summary_md = Column(Text, nullable=True)
    emotions = Column(JSONB, nullable=True)
    model = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    session = relationship("AIJournalSession", back_populates="analysis") 