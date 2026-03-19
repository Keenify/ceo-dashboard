from typing import Optional, List, Literal
from pydantic import BaseModel, Field, field_validator, ConfigDict
from uuid import UUID
from datetime import datetime
import pytz

# Type alias for social media platforms
Platform = Literal["Facebook", "X", "Instagram", "LinkedIn"]

# Type alias for post status
PostStatus = Literal["pending", "processing", "complete"]

class SocialPostBase(BaseModel):
    """Base model for social post data."""
    instruction: str = Field(..., description="Instructions for the social media post content")
    scheduled_at: datetime = Field(..., description="When the post should be scheduled")
    platforms: List[Platform] = Field(..., description="List of platforms where post should be published")

    @field_validator("platforms")
    @classmethod
    def validate_platforms(cls, v: List[str]) -> List[str]:
        """Validate that all platforms are allowed values."""
        allowed_platforms = ["Facebook", "X", "Instagram", "LinkedIn"]
        for platform in v:
            if platform not in allowed_platforms:
                raise ValueError(f"Platform '{platform}' is not allowed. Must be one of: {', '.join(allowed_platforms)}")
        if not v:
            raise ValueError("At least one platform must be selected")
        return v

    @field_validator("scheduled_at")
    @classmethod
    def validate_scheduled_at(cls, v: datetime) -> datetime:
        """Convert timezone-aware datetime to UTC timezone-naive datetime."""
        if v.tzinfo is not None:
            # Convert to UTC and remove timezone info
            utc_dt = v.astimezone(pytz.UTC)
            return utc_dt.replace(tzinfo=None)
        return v

class SocialPostCreate(SocialPostBase):
    """Model for creating a new social post."""
    user_id: UUID = Field(..., description="ID of the user who owns the post")

class SocialPostUpdate(BaseModel):
    """Model for updating an existing social post."""
    instruction: Optional[str] = Field(None, description="Instructions for the social media post content")
    scheduled_at: Optional[datetime] = Field(None, description="When the post should be scheduled")
    platforms: Optional[List[Platform]] = Field(None, description="List of platforms where post should be published")
    generated_content: Optional[str] = Field(None, description="Generated content for the post")
    generated_post_url: Optional[str] = Field(None, description="URL of the generated post")
    status: Optional[PostStatus] = Field(None, description="Status of the post")
    completed_at: Optional[datetime] = Field(None, description="When the post was completed")

    @field_validator("platforms")
    @classmethod
    def validate_platforms(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        """Validate that all platforms are allowed values."""
        if v is not None:
            allowed_platforms = ["Facebook", "X", "Instagram", "LinkedIn"]
            for platform in v:
                if platform not in allowed_platforms:
                    raise ValueError(f"Platform '{platform}' is not allowed. Must be one of: {', '.join(allowed_platforms)}")
            if not v:
                raise ValueError("At least one platform must be selected")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        """Validate that status is one of the allowed values."""
        if v is not None and v not in ["pending", "processing", "complete"]:
            raise ValueError("status must be one of: pending, processing, complete")
        return v

class SocialPostResponse(SocialPostBase):
    """Model for social post response."""
    id: UUID = Field(..., description="Unique identifier for the social post")
    user_id: Optional[UUID] = Field(None, description="ID of the user who owns the post")
    created_at: datetime = Field(..., description="Timestamp when the post was created")
    generated_content: Optional[str] = Field(None, description="Generated content for the post")
    generated_post_url: Optional[str] = Field(None, description="URL of the generated post")
    status: PostStatus = Field(..., description="Status of the post")
    completed_at: Optional[datetime] = Field(None, description="When the post was completed")

    model_config = ConfigDict(from_attributes=True)

class SocialPostCreatePayload(BaseModel):
    """Model for the payload when creating a new social post via API."""
    user_id: UUID = Field(..., description="ID of the user who owns the post")
    instruction: str = Field(..., description="Instructions for the social media post content")
    scheduled_at: datetime = Field(..., description="When the post should be scheduled")
    platforms: List[Platform] = Field(..., description="List of platforms where post should be published")

    @field_validator("platforms")
    @classmethod
    def validate_platforms(cls, v: List[str]) -> List[str]:
        """Validate that all platforms are allowed values."""
        allowed_platforms = ["Facebook", "X", "Instagram", "LinkedIn"]
        for platform in v:
            if platform not in allowed_platforms:
                raise ValueError(f"Platform '{platform}' is not allowed. Must be one of: {', '.join(allowed_platforms)}")
        if not v:
            raise ValueError("At least one platform must be selected")
        return v