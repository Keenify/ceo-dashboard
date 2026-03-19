from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict

class FivePercentReviewBase(BaseModel):
    """Base schema for FivePercentReview."""
    review_date: date
    work_feelings: str | None = None
    work_headline: str | None = None
    work_significance: str | None = None
    family_feelings: str | None = None
    family_headline: str | None = None
    family_significance: str | None = None
    personal_feelings: str | None = None
    personal_headline: str | None = None
    personal_significance: str | None = None
    next_30_60: str | None = None
    challenge_or_opportunity: str | None = None

class FivePercentReviewCreate(FivePercentReviewBase):
    """Schema for creating a new FivePercentReview."""
    user_id: UUID

class FivePercentReviewUpdate(BaseModel):
    """Schema for updating an existing FivePercentReview."""
    review_date: date | None = None
    work_feelings: str | None = None
    work_headline: str | None = None
    work_significance: str | None = None
    family_feelings: str | None = None
    family_headline: str | None = None
    family_significance: str | None = None
    personal_feelings: str | None = None
    personal_headline: str | None = None
    personal_significance: str | None = None
    next_30_60: str | None = None
    challenge_or_opportunity: str | None = None

class FivePercentReviewResponse(FivePercentReviewBase):
    """Schema for FivePercentReview response."""
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True) 