from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
import datetime
from decimal import Decimal


# --- Legend Schemas ---

class ProductivityLegendBase(BaseModel):
    """Base model for productivity legend data."""
    number: int = Field(..., description="Legend number (0-11 for defaults, higher for custom)")
    name: str = Field(..., max_length=100, description="Name of the activity (e.g., Sleep, Work)")
    color: str = Field(..., max_length=20, description="Hex color code (e.g., #1e1e1e)")


class ProductivityLegendCreate(ProductivityLegendBase):
    """Model for creating a new legend."""
    user_id: UUID = Field(..., description="ID of the user who owns the legend")


class ProductivityLegendUpdate(BaseModel):
    """Model for updating an existing legend."""
    name: Optional[str] = Field(None, max_length=100, description="Name of the activity")
    color: Optional[str] = Field(None, max_length=20, description="Hex color code")


class ProductivityLegendResponse(ProductivityLegendBase):
    """Model for legend response."""
    id: UUID = Field(..., description="Unique identifier for the legend")
    user_id: UUID = Field(..., description="ID of the user who owns the legend")
    created_at: datetime.datetime = Field(..., description="Timestamp when the legend was created")
    updated_at: datetime.datetime = Field(..., description="Timestamp when the legend was last updated")

    model_config = ConfigDict(from_attributes=True)


# --- Tracker Schemas ---

class ProductivityTrackerBase(BaseModel):
    """Base model for productivity tracker data."""
    date: datetime.date = Field(..., description="Date of the tracker entry")
    time_slots: Dict[str, int] = Field(default_factory=dict, description="Hourly slots with legend numbers: {'0': 0, '1': 1, ...}")
    spent: Optional[Decimal] = Field(None, description="Daily spending amount")
    kg: Optional[Decimal] = Field(None, description="Weight in kg")
    comments: Optional[str] = Field(None, description="Daily comments/highlights")


class ProductivityTrackerCreate(ProductivityTrackerBase):
    """Model for creating a new tracker entry."""
    user_id: UUID = Field(..., description="ID of the user who owns the entry")


class ProductivityTrackerUpdate(BaseModel):
    """Model for updating an existing tracker entry."""
    time_slots: Optional[Dict[str, int]] = Field(None, description="Hourly slots with legend numbers")
    spent: Optional[Decimal] = Field(None, description="Daily spending amount")
    kg: Optional[Decimal] = Field(None, description="Weight in kg")
    comments: Optional[str] = Field(None, description="Daily comments/highlights")


class ProductivityTrackerResponse(ProductivityTrackerBase):
    """Model for tracker entry response."""
    id: UUID = Field(..., description="Unique identifier for the tracker entry")
    user_id: UUID = Field(..., description="ID of the user who owns the entry")
    created_at: datetime.datetime = Field(..., description="Timestamp when the entry was created")
    updated_at: datetime.datetime = Field(..., description="Timestamp when the entry was last updated")

    model_config = ConfigDict(from_attributes=True)


# --- Upsert Schema ---

class ProductivityTrackerUpsert(BaseModel):
    """Model for upserting a tracker entry (create or update by date)."""
    date: datetime.date = Field(..., description="Date of the tracker entry")
    time_slots: Optional[Dict[str, int]] = Field(None, description="Hourly slots with legend numbers")
    spent: Optional[Decimal] = Field(None, description="Daily spending amount")
    kg: Optional[Decimal] = Field(None, description="Weight in kg")
    comments: Optional[str] = Field(None, description="Daily comments/highlights")


# --- Hours Distribution Schema ---

class HoursDistributionItem(BaseModel):
    """Model for a single legend's hours distribution."""
    legend_number: int = Field(..., description="Legend number")
    legend_name: str = Field(..., description="Name of the legend")
    legend_color: str = Field(..., description="Hex color of the legend")
    hours_count: int = Field(..., description="Number of hours for this legend")
