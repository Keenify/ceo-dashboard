import uuid
from sqlalchemy import Column, Date, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.database.database import Base

class WeeklyRhythm(Base):
    """
    SQLAlchemy model for the 'weekly_rhythms' table.
    Represents a user's weekly review and planning data.
    """
    __tablename__ = "weekly_rhythms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="Primary key, generated UUID.")
    user_id = Column(UUID(as_uuid=True), nullable=False, comment="Reference to the user (auth.users).")
    week_start_date = Column(Date, nullable=False, comment="Start date of the week (Monday).")

    # Single value field
    most_significant_moment = Column(Text, nullable=True, comment="Most significant moment of the week.")

    # Arrays of structured data using JSONB
    goals = Column(JSONB, nullable=True, comment="List of goals for the week. Each item: { goal, target_completion_by }.")
    actions = Column(JSONB, nullable=True, comment="List of actions taken. Each item: { action_item, outcome }.")
    challenges = Column(JSONB, nullable=True, comment="List of challenges faced. Each item: { challenge, note }.")
    next_goals = Column(JSONB, nullable=True, comment="Goals for next week. Each item: { goal, help_needed }.")

    created_at = Column(DateTime(timezone=False), server_default=func.now(), nullable=False, comment="Timestamp when the record was created.")
    updated_at = Column(DateTime(timezone=False), server_default=func.now(), onupdate=func.now(), nullable=False, comment="Timestamp when the record was last updated.")

    # Note: If you add relationships to a User model in the future, add them here.
