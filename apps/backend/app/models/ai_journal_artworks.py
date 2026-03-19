from sqlalchemy import Column, String, UUID, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.models import Base
import uuid
from datetime import datetime

class AIJournalArtwork(Base):
    __tablename__ = 'ai_journal_artworks'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey('ai_journal_sessions.id', ondelete='CASCADE'), nullable=False)
    image_path = Column(Text, nullable=True)
    style = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    session = relationship("AIJournalSession", back_populates="artworks") 