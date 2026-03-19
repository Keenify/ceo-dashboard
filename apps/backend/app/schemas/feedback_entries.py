from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
from uuid import UUID

# Enums for validation
class FeedbackType(str, Enum):
    BUG = "bug"
    FEATURE_REQUEST = "feature_request"
    IMPROVEMENT = "improvement"
    OTHER = "other"

class Priority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class Status(str, Enum):
    SUBMITTED = "submitted"
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REJECTED = "rejected"

# Base schema with common fields
class FeedbackBase(BaseModel):
    module_name: Optional[str] = Field(None, max_length=100, description="Dashboard module name (optional)")
    feedback_type: FeedbackType = Field(..., description="Type of feedback")
    title: str = Field(..., max_length=255, min_length=1, description="Feedback title")
    description: str = Field(..., min_length=1, description="Detailed feedback description")
    priority: Priority = Field(..., description="Priority level")
    screenshots: Optional[List[str]] = Field(None, description="Optional list of screenshot URLs")

# Schema for creating feedback (user input)
class FeedbackCreate(FeedbackBase):
    user_id: UUID = Field(..., description="User ID from frontend authentication")
    
    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "456e7890-e89b-12d3-a456-426614174001",
                "module_name": "habits",
                "feedback_type": "bug",
                "title": "Habit streak not updating correctly",
                "description": "When I mark a habit as complete, the streak counter shows the wrong number",
                "priority": "medium",
                "screenshots": ["https://supabase-url/feedback/user-id/screenshot1.png"]
            }
        }

# Schema for updating feedback (internal use)
class FeedbackUpdate(BaseModel):
    status: Optional[Status] = None
    taiga_story_id: Optional[int] = None
    taiga_project_id: Optional[int] = None

# Schema for API responses
class FeedbackResponse(FeedbackBase):
    id: UUID
    user_id: UUID
    status: Status
    taiga_story_id: Optional[int] = None
    taiga_project_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "user_id": "456e7890-e89b-12d3-a456-426614174001",
                "module_name": "habits",
                "feedback_type": "bug",
                "title": "Habit streak not updating correctly",
                "description": "When I mark a habit as complete, the streak counter shows the wrong number",
                "priority": "medium",
                "screenshots": ["https://supabase-url/feedback/user-id/screenshot1.png"],
                "status": "synced_to_taiga",
                "taiga_story_id": 1234,
                "taiga_project_id": 567,
                "created_at": "2025-01-19T10:30:00Z",
                "updated_at": "2025-01-19T10:35:00Z"
            }
        }

# Schema for listing feedback (with pagination metadata)
class FeedbackListResponse(BaseModel):
    items: list[FeedbackResponse]
    total: int
    skip: int
    limit: int

    class Config:
        json_schema_extra = {
            "example": {
                "items": [
                    {
                        "id": "123e4567-e89b-12d3-a456-426614174000",
                        "user_id": "456e7890-e89b-12d3-a456-426614174001",
                        "module_name": "habits",
                        "feedback_type": "bug",
                        "title": "Habit streak not updating correctly",
                        "description": "When I mark a habit as complete, the streak counter shows the wrong number",
                        "priority": "medium",
                        "status": "synced_to_taiga",
                        "taiga_story_id": 1234,
                        "taiga_project_id": 567,
                        "created_at": "2025-01-19T10:30:00Z",
                        "updated_at": "2025-01-19T10:35:00Z"
                    }
                ],
                "total": 1,
                "skip": 0,
                "limit": 10
            }
        }