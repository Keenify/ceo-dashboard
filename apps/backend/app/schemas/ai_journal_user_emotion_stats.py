from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime

# Base schema: shared fields for all operations
class AIJournalUserEmotionStatBase(BaseModel):
    emotion: str = Field(..., description="The emotion label (e.g., 'gratitude')")
    session_count: int = Field(..., description="Number of sessions where this emotion appeared for the user")
    summary_all: Optional[str] = Field(None, description="Aggregate summary for this emotion across all sessions for the user")

# Schema for creating a new stat record (POST)
class AIJournalUserEmotionStatCreate(AIJournalUserEmotionStatBase):
    user_id: UUID = Field(..., description="User ID")

# Schema for updating a stat record (PATCH/PUT)
class AIJournalUserEmotionStatUpdate(BaseModel):
    session_count: Optional[int] = None
    summary_all: Optional[str] = None

# Schema for returning a stat record (GET/response)
class AIJournalUserEmotionStatResponse(AIJournalUserEmotionStatBase):
    user_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True) 