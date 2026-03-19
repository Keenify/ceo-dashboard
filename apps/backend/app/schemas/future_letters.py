from datetime import date, datetime
from uuid import UUID
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict

class FutureLetterBase(BaseModel):
    """Base schema for FutureLetter."""
    recipient_email: str
    email_subject: Optional[str] = None
    email_content: str
    attachment_urls: Optional[List[str]] = None
    send_date: date
    send_status: str = "scheduled"

class FutureLetterCreate(FutureLetterBase):
    """Schema for creating a new FutureLetter."""
    user_id: UUID

class FutureLetterUpdate(BaseModel):
    """Schema for updating an existing FutureLetter."""
    recipient_email: Optional[str] = None
    email_subject: Optional[str] = None
    email_content: Optional[str] = None
    attachment_urls: Optional[List[str]] = None
    send_date: Optional[date] = None
    send_status: Optional[str] = None

class FutureLetterResponse(FutureLetterBase):
    """Schema for FutureLetter response."""
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
