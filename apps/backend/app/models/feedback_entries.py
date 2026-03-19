from sqlalchemy import Column, String, UUID, DateTime, Integer, Text, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID as SQLAlchemyUUID, ARRAY
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime
from uuid import UUID

from app.database.database import Base

class FeedbackEntry(Base):
    __tablename__ = 'feedback_entries'

    id = Column(SQLAlchemyUUID(as_uuid=True), primary_key=True, index=True, server_default=func.gen_random_uuid())
    user_id = Column(SQLAlchemyUUID(as_uuid=True), nullable=False, index=True)
    module_name = Column(String(100), nullable=True)  # Optional for navigation submissions
    feedback_type = Column(String(20), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(String(20), nullable=False)
    status = Column(String(30), nullable=False, default='submitted', index=True)
    screenshots = Column(ARRAY(Text), nullable=True)
    taiga_story_id = Column(Integer, nullable=True, index=True)
    taiga_project_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Add constraints for enum-like validation (matching Supabase table)
    __table_args__ = (
        CheckConstraint(
            feedback_type.in_(['bug', 'feature_request', 'improvement', 'other']),
            name='feedback_type_check'
        ),
        CheckConstraint(
            priority.in_(['low', 'medium', 'high', 'critical']),
            name='priority_check'
        ),
        CheckConstraint(
            status.in_(['submitted', 'synced_to_taiga', 'in_progress', 'completed', 'rejected']),
            name='status_check'
        ),
    )

    # Relationship to User model (if needed for joins)
    # Note: Uncomment if you want to enable relationship queries
    # user = relationship("User", back_populates="feedback_entries")