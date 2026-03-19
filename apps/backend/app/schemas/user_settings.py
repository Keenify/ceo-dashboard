from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from datetime import date

class UserSettingsBase(BaseModel):
    """Base schema for user settings with common fields."""
    email_reminders_enabled: bool = Field(default=True, description="Whether email reminders are enabled")
    reminder_days_before: int = Field(default=3, ge=1, le=14, description="Days before due date to send reminders (1-14)")
    email_address: str = Field(default="", max_length=255, description="Email address for reminders")
    phone_number: Optional[str] = Field(default=None, max_length=32, description="Phone number for WhatsApp or SMS reminders")
    last_reset_date: Optional[date] = Field(default=None, description="Last date when cards were reset")

class UserSettingsCreate(UserSettingsBase):
    """Schema for creating new user settings."""
    user_id: str = Field(..., description="User ID (UUID)")

class UserSettingsUpdate(BaseModel):
    """Schema for updating existing user settings (all fields optional)."""
    email_reminders_enabled: Optional[bool] = Field(default=None, description="Whether email reminders are enabled")
    reminder_days_before: Optional[int] = Field(default=None, ge=1, le=14, description="Days before due date to send reminders (1-14)")
    email_address: Optional[str] = Field(default=None, max_length=255, description="Email address for reminders")
    phone_number: Optional[str] = Field(default=None, max_length=32, description="Phone number for WhatsApp or SMS reminders")
    last_reset_date: Optional[date] = Field(default=None, description="Last date when cards were reset")

class UserSettingsResponse(UserSettingsBase):
    """Schema for user settings API responses."""
    id: str = Field(..., description="Settings ID (UUID)")
    user_id: str = Field(..., description="User ID (UUID)")
    created_at: str = Field(..., description="Creation timestamp")
    updated_at: str = Field(..., description="Last update timestamp")

    model_config = ConfigDict(from_attributes=True) 