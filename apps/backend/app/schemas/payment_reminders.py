from typing import Optional
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime, date

class PaymentReminderBase(BaseModel):
    scheduled_date: date = Field(..., description="Date when the reminder should be sent.")
    email: str = Field(..., description="Email address where the reminder will be sent.")
    days_before_due: int = Field(3, description="Number of days before due date this reminder was scheduled.")

class PaymentReminderCreate(PaymentReminderBase):
    user_id: UUID = Field(..., description="ID of the user who owns this payment reminder.")
    card_id: UUID = Field(..., description="ID of the credit card instruction this reminder is for.")

class PaymentReminderUpdate(BaseModel):
    scheduled_date: Optional[date] = Field(None, description="Date when the reminder should be sent.")
    status: Optional[str] = Field(None, description="Status: pending, sent, failed, cancelled")
    email: Optional[str] = Field(None, description="Email address where the reminder will be sent.")
    days_before_due: Optional[int] = Field(None, description="Number of days before due date this reminder was scheduled.")
    sent_at: Optional[datetime] = Field(None, description="Timestamp when the reminder was actually sent.")

class PaymentReminderResponse(PaymentReminderBase):
    id: UUID = Field(..., description="Unique identifier for the payment reminder (UUID).")
    user_id: UUID = Field(..., description="ID of the user who owns this payment reminder.")
    card_id: UUID = Field(..., description="ID of the credit card instruction this reminder is for.")
    sent_at: Optional[datetime] = Field(None, description="Timestamp when the reminder was actually sent.")
    status: str = Field(..., description="Status: pending, sent, failed, cancelled")
    created_at: datetime = Field(..., description="Timestamp when the record was created.")
    updated_at: datetime = Field(..., description="Timestamp when the record was last updated.")

class TestEmailRequest(BaseModel):
    user_id: str = Field(..., description="ID of the user to send test email for.")
    email: str = Field(..., description="Email address to send test email to.")
    reminder_days_before: Optional[int] = Field(3, description="Days before due date for test email context.")

class ConsolidatedReminderRequest(BaseModel):
    user_id: str = Field(..., description="ID of the user to create consolidated reminders for.")
    email: str = Field(..., description="Email address for the reminders.")
    reminder_days_before: int = Field(3, description="Number of days before earliest due date to send consolidated reminder.")

class ConsolidatedReminderResponse(BaseModel):
    success: bool = Field(..., description="Whether the consolidated reminders were created successfully.")
    reminders_created: int = Field(..., description="Number of individual reminders created.")
    scheduled_date: date = Field(..., description="Date when the consolidated reminder will be sent.")
    cards_included: int = Field(..., description="Number of unpaid cards included in the consolidated reminder.")
    message: str = Field(..., description="Human-readable result message.")