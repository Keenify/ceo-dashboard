import uuid
from sqlalchemy import Column, Integer, DateTime, Text, Boolean, Date, String, ForeignKey, BigInteger
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database.database import Base

class PaymentReminder(Base):
    """
    SQLAlchemy model for the 'payment_reminders' table.
    Represents a scheduled payment reminder for a credit card.
    """
    __tablename__ = "payment_reminders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="Primary key, UUID.")
    user_id = Column(UUID(as_uuid=True), nullable=False, comment="Reference to the user (auth.users).")
    card_id = Column(UUID(as_uuid=True), nullable=False, comment="Reference to the credit card instruction.")
    scheduled_date = Column(Date, nullable=False, comment="Date when the reminder should be sent.")
    sent_at = Column(DateTime(timezone=False), nullable=True, comment="Timestamp when the reminder was actually sent.")
    status = Column(String(20), nullable=False, default='pending', comment="Status: pending, sent, failed, cancelled")
    email = Column(String(255), nullable=False, comment="Email address where the reminder will be sent.")
    days_before_due = Column(Integer, nullable=False, default=3, comment="Number of days before due date this reminder was scheduled.")
    created_at = Column(DateTime(timezone=False), server_default=func.now(), nullable=False, comment="Timestamp when the record was created.")
    updated_at = Column(DateTime(timezone=False), server_default=func.now(), onupdate=func.now(), nullable=False, comment="Timestamp when the record was last updated.")

    # Note: The actual foreign key constraints are defined in Supabase:
    # - card_id references credit_card_instructions(id) ON DELETE CASCADE
    # - user_id references auth.users(id) ON DELETE CASCADE
    # - unique constraint on (card_id, scheduled_date) 