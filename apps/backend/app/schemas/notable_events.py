from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
import datetime
from decimal import Decimal


# --- Notable Events Schemas ---

class NotableEventBase(BaseModel):
    """Base model for notable event data."""
    events: Optional[str] = Field(None, description="Notable events description")
    food: Optional[str] = Field(None, description="Food/restaurant notes")
    movies_tv: Optional[str] = Field(None, description="Movies & TV shows watched")
    games: Optional[str] = Field(None, description="Games played")
    major_purchases: Optional[str] = Field(None, description="Major purchase description")
    price: Optional[Decimal] = Field(None, description="Purchase price")


class NotableEventCreate(NotableEventBase):
    """Model for creating a new notable event."""
    user_id: UUID = Field(..., description="ID of the user who owns the entry")


class NotableEventUpdate(BaseModel):
    """Model for updating an existing notable event."""
    events: Optional[str] = Field(None, description="Notable events description")
    food: Optional[str] = Field(None, description="Food/restaurant notes")
    movies_tv: Optional[str] = Field(None, description="Movies & TV shows watched")
    games: Optional[str] = Field(None, description="Games played")
    major_purchases: Optional[str] = Field(None, description="Major purchase description")
    price: Optional[Decimal] = Field(None, description="Purchase price")


class NotableEventResponse(NotableEventBase):
    """Model for notable event response."""
    id: UUID = Field(..., description="Unique identifier for the notable event")
    user_id: UUID = Field(..., description="ID of the user who owns the entry")
    created_at: datetime.datetime = Field(..., description="Timestamp when the entry was created")
    updated_at: datetime.datetime = Field(..., description="Timestamp when the entry was last updated")

    model_config = ConfigDict(from_attributes=True)
