import uuid
from sqlalchemy import Column, Integer, Boolean, Date, String, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database.database import Base

class UserSettings(Base):
    """
    SQLAlchemy model for the 'user_settings' table.
    Stores user preferences for payment reminders and other settings.
    """
    __tablename__ = "user_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="Primary key, UUID.")
    user_id = Column(UUID(as_uuid=True), nullable=False, unique=True, comment="Reference to the user (auth.users).")
    email_reminders_enabled = Column(Boolean, nullable=False, default=True, comment="Whether email reminders are enabled for this user.")
    reminder_days_before = Column(Integer, nullable=False, default=3, comment="Default number of days before due date to send reminders.")
    email_address = Column(String(255), nullable=False, default='', comment="Email address for sending reminders.")
    phone_number = Column(String(32), nullable=True, default=None, comment="User's phone number for WhatsApp or SMS reminders.")
    last_reset_date = Column(Date, nullable=True, comment="Date when cards were last reset (for tracking reset cycles).")
    created_at = Column(DateTime(timezone=False), server_default=func.now(), nullable=False, comment="Timestamp when the record was created.")
    updated_at = Column(DateTime(timezone=False), server_default=func.now(), onupdate=func.now(), nullable=False, comment="Timestamp when the record was last updated.")

    # Note: The actual foreign key constraint is defined in Supabase:
    # - user_id references auth.users(id) ON DELETE CASCADE
    # - unique constraint on user_id ensures one settings record per user