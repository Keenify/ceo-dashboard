import uuid
from sqlalchemy import Column, Date, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database.database import Base

class FivePercentReview(Base):
    """
    SQLAlchemy model for the 'five_percent_reviews' table.
    Represents a user's five percent review data across work, family, personal, and future aspects.
    """
    __tablename__ = "five_percent_reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="Primary key, generated UUID.")
    user_id = Column(UUID(as_uuid=True), nullable=False, comment="Reference to the user (auth.users).")
    review_date = Column(Date, nullable=False, comment="Date of the review.")

    # Work section
    work_feelings = Column(Text, nullable=True, comment="Feelings about work.")
    work_headline = Column(Text, nullable=True, comment="Headline for work review.")
    work_significance = Column(Text, nullable=True, comment="Significance of work achievements.")

    # Family section
    family_feelings = Column(Text, nullable=True, comment="Feelings about family.")
    family_headline = Column(Text, nullable=True, comment="Headline for family review.")
    family_significance = Column(Text, nullable=True, comment="Significance of family achievements.")

    # Personal section
    personal_feelings = Column(Text, nullable=True, comment="Feelings about personal life.")
    personal_headline = Column(Text, nullable=True, comment="Headline for personal review.")
    personal_significance = Column(Text, nullable=True, comment="Significance of personal achievements.")

    # Next 30-60 days section (simplified to single field)
    next_30_60 = Column(Text, nullable=True, comment="Plans and thoughts for next 30-60 days.")

    # Challenge or opportunity
    challenge_or_opportunity = Column(Text, nullable=True, comment="Main challenge or opportunity identified.")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, comment="Timestamp when the record was created.")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False, comment="Timestamp when the record was last updated.") 