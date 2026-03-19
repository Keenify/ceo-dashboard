from sqlalchemy import Column, String, Integer, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from ..database.database import Base

class VoiceRecording(Base):
    __tablename__ = "voice_recordings"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    title = Column(String(255), nullable=True)
    file_url = Column(Text, nullable=False)
    duration = Column(Integer, nullable=True, comment="Duration in seconds")
    transcript = Column(Text, nullable=True, comment="Transcription of the recording")
    summary = Column(JSONB, nullable=True, comment="AI-generated summary of the recording")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    def __repr__(self):
        return f"<VoiceRecording(id={self.id}, title={self.title}, duration={self.duration})>"