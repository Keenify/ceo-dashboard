from typing import Optional, Any, Dict
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime


class IkigaiBase(BaseModel):
    """
    Base schema for the Ikigai model.
    The ikigai_data field will contain the structured ikigai framework data.
    """
    ikigai_data: Dict[str, Any] = Field(..., description="JSONB data containing the user's ikigai framework")


class IkigaiCreate(IkigaiBase):
    """
    Schema for creating a new Ikigai record.
    """
    user_id: UUID = Field(..., description="ID of the user who owns this ikigai")


class IkigaiUpdate(BaseModel):
    """
    Schema for updating an Ikigai record.
    All fields are optional for partial updates.
    """
    ikigai_data: Optional[Dict[str, Any]] = Field(None, description="Updated ikigai framework data")


class IkigaiResponse(IkigaiBase):
    """
    Schema for Ikigai response data.
    """
    id: UUID = Field(..., description="Unique identifier for the ikigai record")
    user_id: UUID = Field(..., description="ID of the user who owns this ikigai")
    created_at: datetime = Field(..., description="Timestamp when the record was created")
    updated_at: datetime = Field(..., description="Timestamp when the record was last updated")

    model_config = ConfigDict(from_attributes=True) 