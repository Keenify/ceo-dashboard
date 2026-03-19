from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime

class AIJournalEmotionBase(BaseModel):
    emotion: str = Field(..., description="The emotion label (e.g., 'gratitude')")
    summary: Optional[str] = Field(None, description="Per-session explanation for this emotion")

class AIJournalEmotionCreate(AIJournalEmotionBase):
    user_id: UUID = Field(..., description="User ID")
    session_id: UUID = Field(..., description="Session ID")

class AIJournalEmotionUpdate(BaseModel):
    summary: Optional[str] = None

class AIJournalEmotionResponse(AIJournalEmotionBase):
    id: UUID
    user_id: UUID
    session_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True) 