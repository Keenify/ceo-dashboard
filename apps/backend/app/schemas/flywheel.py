from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from uuid import UUID

class FlywheelEdge(BaseModel):
    id: str = Field(..., description="Unique identifier for the edge/node within the flywheel.")
    text: str = Field(..., description="Text label or description of the edge/node.")

class FlywheelBase(BaseModel):
    name: str = Field(..., description="Name of the flywheel.")
    description: Optional[str] = Field(None, description="Description of the flywheel.")
    edges: List[FlywheelEdge] = Field(..., description="List of edges defining the flywheel structure.")
    image_path: Optional[str] = Field(None, description="Optional path or URL for an image representing the flywheel.")

class FlywheelCreate(FlywheelBase):
    user_id: UUID = Field(..., description="ID of the user who owns this flywheel.")

class FlywheelUpdate(BaseModel):
    name: Optional[str] = Field(None, description="Name of the flywheel.")
    description: Optional[str] = Field(None, description="Description of the flywheel.")
    edges: Optional[List[FlywheelEdge]] = Field(None, description="List of edges defining the flywheel structure.")
    image_path: Optional[str] = Field(None, description="Optional path or URL for an image representing the flywheel.")

class FlywheelResponse(FlywheelBase):
    id: UUID = Field(..., description="Unique UUID identifier for the flywheel.")
    user_id: UUID = Field(..., description="ID of the user who owns this flywheel.")
    created_at: datetime = Field(..., description="Timestamp when the record was created.")
    updated_at: datetime = Field(..., description="Timestamp when the record was last updated.")

    model_config = ConfigDict(from_attributes=True) 