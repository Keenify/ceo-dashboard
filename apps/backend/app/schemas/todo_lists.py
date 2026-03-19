from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TodoListBase(BaseModel):
    name: str
    tab_id: Optional[UUID] = None


class TodoListCreate(TodoListBase):
    user_id: UUID
    pass


class TodoListUpdate(TodoListBase):
    # Make fields optional for updates
    name: Optional[str] = None
    # tab_id is already optional in Base
    pass


class TodoListInDBBase(TodoListBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )


# Properties to return to client
class TodoList(TodoListInDBBase):
    pass


# Properties properties stored in DB
class TodoListInDB(TodoListInDBBase):
    pass
