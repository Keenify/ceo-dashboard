from sqlalchemy import Column, String, UUID, DateTime, Text, ForeignKey, Integer, CheckConstraint
from sqlalchemy.orm import relationship
from app.models import Base
import uuid
from datetime import datetime

class AIJournalMessage(Base):
    __tablename__ = 'ai_journal_messages'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey('ai_journal_sessions.id', ondelete='CASCADE'), nullable=False)
    sender = Column(String, nullable=False)
    content = Column(Text, nullable=True)
    seq = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Add constraint for sender values
    __table_args__ = (
        CheckConstraint("sender IN ('user', 'ai')", name='check_sender_values'),
    )

    # Relationships
    session = relationship("AIJournalSession", back_populates="messages") 