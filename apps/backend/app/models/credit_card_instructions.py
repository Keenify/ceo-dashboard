import uuid
from sqlalchemy import Column, Integer, DateTime, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database.database import Base

class CreditCardInstructions(Base):
    """
    SQLAlchemy model for the 'credit_card_instructions' table.
    Represents a single credit card instruction.
    """
    __tablename__ = "credit_card_instructions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="Primary key, generated UUID.")
    user_id = Column(UUID(as_uuid=True), nullable=False, comment="Reference to the user (auth.users). No FK constraint in model.")
    card_name = Column(Text, nullable=False, comment="Name of the credit card.")
    payment_day = Column(Integer, nullable=False, comment="Day of the month the payment is due.")
    description = Column(Text, nullable=True, comment="Description of the credit card instruction.")
    instruction = Column(Text, nullable=True, comment="Detailed instruction for the credit card payment.")
    is_paid = Column(Boolean, nullable=True, default=False, comment="Payment status of the instruction.")
    created_at = Column(DateTime(timezone=False), server_default=func.now(), nullable=False, comment="Timestamp when the record was created.")
    updated_at = Column(DateTime(timezone=False), server_default=func.now(), onupdate=func.now(), nullable=False, comment="Timestamp when the record was last updated.")
