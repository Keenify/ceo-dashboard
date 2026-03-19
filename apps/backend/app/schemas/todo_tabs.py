from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TodoTabBase(BaseModel):
    name: str


class TodoTabCreate(TodoTabBase):
    user_id: UUID
    pass


class TodoTabUpdate(TodoTabBase):
    pass


class TodoTabInDBBase(TodoTabBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )


# Properties to return to client
class TodoTab(TodoTabInDBBase):
    pass


# Properties properties stored in DB
class TodoTabInDB(TodoTabInDBBase):
    pass
