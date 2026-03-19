import uuid
from sqlalchemy import Column, DateTime, Date, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.database.database import Base

class WeeklyDesignSystem(Base):
    """
    SQLAlchemy model for the 'weekly_design_system' table.
    Represents a user's weekly planning data, including time blocks and checklists.
    """
    __tablename__ = "weekly_design_system"
    __table_args__ = (
        {'schema': 'public'}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), nullable=False)
    week_start_date = Column(Date, nullable=False)
    time_blocks = Column(JSONB, nullable=False)
    daily_checklists = Column(JSONB, nullable=False)
    next_goals = Column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    personal_goals = Column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=True)
