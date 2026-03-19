from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID

# Base schema for voice recording data
class VoiceRecordingBase(BaseModel):
    title: Optional[str] = Field(None, max_length=255, description="Optional title for the recording")
    file_url: str = Field(..., description="URL to the stored audio file")
    duration: Optional[int] = Field(None, ge=0, description="Duration in seconds")
    language: Optional[str] = Field(None, description="Language of the recording")
    transcript: Optional[str] = Field(None, description="Transcription of the recording")
    summary: Optional[Dict[str, Any]] = Field(None, description="AI-generated summary as JSON")

# Schema for creating a new voice recording
class VoiceRecordingCreate(VoiceRecordingBase):
    user_id: str = Field(..., description="User ID who created the recording")

# Schema for updating a voice recording
class VoiceRecordingUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    language: Optional[str] = Field(None, description="Language of the recording")
    transcript: Optional[str] = Field(None, description="Transcription of the recording")
    summary: Optional[Dict[str, Any]] = Field(None, description="AI-generated summary as JSON")

# Schema for response when retrieving voice recordings
class VoiceRecordingResponse(VoiceRecordingBase):
    id: UUID = Field(..., description="Unique identifier for the recording")
    user_id: UUID = Field(..., description="User ID who created the recording")
    created_at: datetime = Field(..., description="Timestamp when the recording was created")
    
    class Config:
        from_attributes = True

# Schema for listing voice recordings (simplified)
class VoiceRecordingList(BaseModel):
    id: UUID
    title: Optional[str]
    duration: Optional[int]
    language: Optional[str] = None
    created_at: datetime
    transcript: Optional[str] = None
    summary: Optional[Dict[str, Any]] = None
    
    class Config:
        from_attributes = True