from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class MindmapBase(BaseModel):
    """Base schema for Mindmap."""
    title: str
    description: Optional[str] = None
    mindmap: Dict[str, Any]


class MindmapCreate(MindmapBase):
    """Schema for creating a new mindmap."""
    user_id: UUID


class MindmapUpdate(BaseModel):
    """Schema for updating an existing mindmap."""
    title: Optional[str] = None
    description: Optional[str] = None
    mindmap: Optional[Dict[str, Any]] = None
    updated_by: UUID


class MindmapResponse(MindmapBase):
    """Schema for mindmap response."""
    id: UUID
    user_id: UUID
    updated_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True) 