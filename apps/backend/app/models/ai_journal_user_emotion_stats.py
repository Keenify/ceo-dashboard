from sqlalchemy import Column, String, UUID, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database.database import Base
from datetime import datetime

class AIJournalUserEmotionStat(Base):
    __tablename__ = 'ai_journal_user_emotion_stats'

    user_id = Column(UUID(as_uuid=True), ForeignKey('auth.users.id', ondelete='CASCADE'), primary_key=True)
    emotion = Column(String(100), primary_key=True)
    session_count = Column(Integer, nullable=False, default=0)
    summary_all = Column(Text, nullable=True)  # Summary of one emotion across sessions by user
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Optionally, add user relationship if needed
    # user = relationship("User", back_populates="user_emotion_stats") 