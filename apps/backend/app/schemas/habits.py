from typing import Optional, List, Literal
from pydantic import BaseModel, Field, field_validator, ConfigDict
from uuid import UUID
from datetime import date, datetime

# Type alias for habit types
HabitType = Literal["build", "break", "track"]

# Type alias for habit entry statuses (matching DB constraint)
HabitEntryStatus = Literal["completed", "skipped"]

class HabitBase(BaseModel):
    """Base model for habit data."""
    name: str = Field(..., description="Name of the habit")
    description: Optional[str] = Field(None, description="Description of the habit")
    habit_type: HabitType = Field(..., description="Type of habit: build, break, or track")
    color_code: str = Field(..., description="Color code for the habit in hex format")
    sort_order: Optional[int] = Field(None, description="Order for sorting habits for a user")

    @field_validator("habit_type")
    @classmethod
    def validate_habit_type(cls, v: str) -> str:
        """Validate that habit_type is one of the allowed values."""
        if v not in ["build", "break", "track"]:
            raise ValueError("habit_type must be one of: build, break, track")
        return v

class HabitCreate(HabitBase):
    """Model for creating a new habit."""
    user_id: UUID = Field(..., description="ID of the user who owns the habit")

class HabitUpdate(BaseModel):
    """Model for updating an existing habit."""
    name: Optional[str] = Field(None, description="Name of the habit")
    description: Optional[str] = Field(None, description="Description of the habit")
    habit_type: Optional[HabitType] = Field(None, description="Type of habit: build, break, or track")
    color_code: Optional[str] = Field(None, description="Color code for the habit in hex format")
    sort_order: Optional[int] = Field(None, description="Order for sorting habits for a user")

    @field_validator("habit_type")
    @classmethod
    def validate_habit_type(cls, v: Optional[str]) -> Optional[str]:
        """Validate that habit_type is one of the allowed values."""
        if v is not None and v not in ["build", "break", "track"]:
            raise ValueError("habit_type must be one of: build, break, track")
        return v

class HabitResponse(HabitBase):
    """Model for habit response."""
    id: UUID = Field(..., description="Unique identifier for the habit")
    user_id: UUID = Field(..., description="ID of the user who owns the habit")
    created_at: datetime = Field(..., description="Timestamp when the habit was created")

    model_config = ConfigDict(from_attributes=True)

class HabitEntryBase(BaseModel):
    """Base model for habit entry data."""
    habit_id: UUID = Field(..., description="ID of the habit this entry belongs to")
    entry_date: date = Field(..., description="Date of the habit entry")
    status: HabitEntryStatus = Field(..., description="Status of the habit entry: completed or skipped")
    note: Optional[str] = Field(None, description="Note for the habit entry")
    value: Optional[str] = Field(None, description="Value of the habit entry (any text value)")

class HabitEntryCreatePayload(BaseModel):
    """Model for the payload when creating a new habit entry via API."""
    entry_date: date = Field(..., description="Date of the habit entry")
    status: HabitEntryStatus = Field(..., description="Status of the habit entry: completed or skipped")
    note: Optional[str] = Field(None, description="Note for the habit entry")
    value: Optional[str] = Field(None, description="Value of the habit entry (any text value)")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        """Validate that status is one of the allowed values."""
        if v not in ["completed", "skipped"]:
            raise ValueError("status must be one of: completed, skipped")
        return v

class HabitEntryCreate(HabitEntryBase):
    """Model for creating a new habit entry (used internally by CRUD)."""
    pass

class HabitEntryUpdate(BaseModel):
    """Model for updating an existing habit entry."""
    status: Optional[HabitEntryStatus] = Field(None, description="Status of the habit entry: completed or skipped")
    note: Optional[str] = Field(None, description="Note for the habit entry")
    value: Optional[str] = Field(None, description="Value of the habit entry (any text value)")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        """Validate that status is one of the allowed values."""
        if v is not None and v not in ["completed", "skipped"]:
            raise ValueError("status must be one of: completed, skipped")
        return v

class HabitEntryResponse(HabitEntryBase):
    """Model for habit entry response."""
    id: UUID = Field(..., description="Unique identifier for the habit entry")
    created_at: datetime = Field(..., description="Timestamp when the entry was created")

    model_config = ConfigDict(from_attributes=True)

class HabitStreakBase(BaseModel):
    """Base model for habit streak data."""
    habit_id: UUID = Field(..., description="ID of the habit this streak belongs to")
    current_streak: int = Field(..., description="Current streak count")
    longest_streak: int = Field(..., description="Longest streak count")
    total_streak: int = Field(..., description="Total number of completed entries")
    last_entry_date: Optional[date] = Field(None, description="Date of the last completed entry")
    last_value: Optional[str] = Field(None, description="Value of the last completed entry")

class HabitStreakCreate(HabitStreakBase):
    """Model for creating a new habit streak."""
    pass

class HabitStreakUpdate(BaseModel):
    """Model for updating an existing habit streak."""
    current_streak: Optional[int] = Field(None, description="Current streak count")
    longest_streak: Optional[int] = Field(None, description="Longest streak count")
    total_streak: Optional[int] = Field(None, description="Total number of completed entries")
    last_entry_date: Optional[date] = Field(None, description="Date of the last entry")
    last_value: Optional[str] = Field(None, description="Value of the last entry")

class HabitStreakResponse(HabitStreakBase):
    """Model for habit streak response."""
    # Removed id field as habit_id is the primary key
    # Removed created_at and updated_at as they are not in the DB model
    # created_at: datetime = Field(..., description="Timestamp when the streak was created")
    # updated_at: datetime = Field(..., description="Timestamp when the streak was last updated")

    model_config = ConfigDict(from_attributes=True)

class HabitBuddyBase(BaseModel):
    """Base model for habit buddy data."""
    buddy_email: str = Field(..., description="Email address of the accountability buddy")
    censor_habits: bool = Field(False, description="Whether to censor habit names in accountability emails")

class HabitBuddyCreate(HabitBuddyBase):
    """Model for creating a new habit buddy."""
    user_id: UUID = Field(..., description="ID of the user who owns the buddy relationship")

class HabitBuddyUpdate(BaseModel):
    """Model for updating an existing habit buddy."""
    buddy_email: Optional[str] = Field(None, description="Email address of the accountability buddy")
    censor_habits: Optional[bool] = Field(None, description="Whether to censor habit names in accountability emails")

class HabitBuddyResponse(HabitBuddyBase):
    """Model for habit buddy response."""
    id: UUID = Field(..., description="Unique identifier for the habit buddy")
    user_id: UUID = Field(..., description="ID of the user who owns the buddy relationship")
    created_at: datetime = Field(..., description="Timestamp when the buddy was created")

    model_config = ConfigDict(from_attributes=True) 