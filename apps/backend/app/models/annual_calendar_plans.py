from sqlalchemy import Column, String, DateTime, Text, Date, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID as SQLAlchemyUUID
from sqlalchemy.orm import relationship
from app.models import Base
import uuid
from datetime import datetime

class AnnualCalendarPlan(Base):
    __tablename__ = 'annual_calendar_plans'

    id = Column(SQLAlchemyUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(SQLAlchemyUUID(as_uuid=True), ForeignKey('auth.users.id', ondelete='CASCADE'), nullable=False)
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False) 
    color = Column(Text, nullable=False, default='blue')
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Add constraints
    __table_args__ = (
        CheckConstraint('start_date <= end_date', name='annual_calendar_plans_dates_check'),
        CheckConstraint(
            "color IN ('red', 'yellow', 'orange', 'blue', 'green', 'black', 'white', 'purple', 'pink')",
            name='annual_calendar_plans_color_check'
        ),
    )

    # Relationships can be added here if needed in the future
    # For example, if you add related tables like calendar events, milestones, etc.
