from sqlalchemy import Column, String, UUID, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database.database import Base
import uuid
from datetime import datetime

class AIJournalEmotion(Base):
    __tablename__ = 'ai_journal_emotions'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('auth.users.id', ondelete='CASCADE'), nullable=False)
    session_id = Column(UUID(as_uuid=True), ForeignKey('ai_journal_sessions.id', ondelete='CASCADE'), nullable=False)
    emotion = Column(String(100), nullable=False)  # e.g., "gratitude"
    summary = Column(Text, nullable=True)          # Per-session explanation
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('session_id', 'emotion', name='uq_session_emotion'),
    )

    # Relationships
    session = relationship("AIJournalSession", back_populates="emotions")
    # Optionally, add user relationship if needed
    # user = relationship("User", back_populates="journal_emotions")