from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict, field_validator


class TodoBase(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[date] = None
    is_completed: bool = False
    priority: Optional[int] = None
    color_code: Optional[str] = None
    list_id: Optional[UUID] = None # Can be None or a UUID
    sort_order: int = 0


class TodoCreate(TodoBase):
    user_id: UUID
    sort_order: int = 0
    pass


class TodoUpdate(TodoBase):
    # Make fields optional for updates
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[date] = None
    is_completed: Optional[bool] = None
    priority: Optional[int] = None
    color_code: Optional[str] = None
    list_id: Optional[UUID | str] = None # Allow string temporarily for validation
    sort_order: Optional[int] = None

    @field_validator('list_id', mode='before')
    @classmethod
    def validate_list_id_empty_string(cls, v):
        """Convert empty string to None for list_id."""
        if v == "":
            return None
        return v


class TodoInDBBase(TodoBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime
    sort_order: int = 0

    model_config = ConfigDict(
        from_attributes=True
    )


# Properties to return to client
class Todo(TodoInDBBase):
    pass


# Properties stored in DB
class TodoInDB(TodoInDBBase):
    pass
