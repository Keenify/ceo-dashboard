from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
import datetime


# --- Freelance Projects Schemas ---

class FreelanceProjectBase(BaseModel):
    """Base model for freelance project data."""
    title: Optional[str] = Field(None, description="Project title")
    date: Optional[str] = Field(None, description="Project date (free text)")
    keep: Optional[str] = Field(None, description="Notes to keep")


class FreelanceProjectCreate(FreelanceProjectBase):
    """Model for creating a new freelance project."""
    user_id: UUID = Field(..., description="ID of the user who owns the entry")


class FreelanceProjectUpdate(BaseModel):
    """Model for updating an existing freelance project."""
    title: Optional[str] = Field(None, description="Project title")
    date: Optional[str] = Field(None, description="Project date (free text)")
    keep: Optional[str] = Field(None, description="Notes to keep")


class FreelanceProjectResponse(FreelanceProjectBase):
    """Model for freelance project response."""
    id: UUID = Field(..., description="Unique identifier for the freelance project")
    user_id: UUID = Field(..., description="ID of the user who owns the entry")
    created_at: datetime.datetime = Field(..., description="Timestamp when the entry was created")
    updated_at: datetime.datetime = Field(..., description="Timestamp when the entry was last updated")

    model_config = ConfigDict(from_attributes=True)
