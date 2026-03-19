import uuid
from sqlalchemy import Column, Date, DateTime, Text, ARRAY, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database.database import Base

class FutureLetter(Base):
    """
    SQLAlchemy model for the 'future_letters' table.
    Represents a letter that a user schedules to be sent to their future self.
    """
    __tablename__ = "future_letters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="Primary key, generated UUID.")
    user_id = Column(UUID(as_uuid=True), nullable=False, comment="Reference to the user (auth.users).")
    recipient_email = Column(Text, nullable=False, comment="Email address to send the letter to.")
    email_subject = Column(Text, nullable=True, comment="Subject line of the email.")
    email_content = Column(Text, nullable=False, comment="Content of the email to be sent.")
    attachment_urls = Column(ARRAY(Text), nullable=True, comment="Array of file URLs to be attached to the email.")
    send_date = Column(Date, nullable=False, comment="Date when the letter should be sent (at 6 AM).")
    send_status = Column(String, default="scheduled", nullable=False, comment="Status of the letter: scheduled, sent, or failed.")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, comment="Timestamp when the record was created.")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False, comment="Timestamp when the record was last updated.")
