from sqlalchemy import Column, String, UUID, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.models import Base
import uuid
from datetime import datetime

class AIJournalSession(Base):
    __tablename__ = 'ai_journal_sessions'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('auth.users.id', ondelete='CASCADE'), nullable=False)
    prompt_text = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    ended_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    messages = relationship(
        "AIJournalMessage",
        back_populates="session",
        cascade="all, delete-orphan"
    )
    analysis = relationship(
        "AIJournalAnalysis",
        back_populates="session",
        uselist=False,
        cascade="all, delete-orphan"
    )
    artworks = relationship(
        "AIJournalArtwork",
        back_populates="session",
        cascade="all, delete-orphan"
    )
    emotions = relationship(
        "AIJournalEmotion",
        back_populates="session",
        cascade="all, delete-orphan"
    ) 