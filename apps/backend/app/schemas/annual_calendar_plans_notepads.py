from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional
from uuid import UUID

# Shared properties
class UserNotepadBase(BaseModel):
    content: Optional[str] = Field(default='', description="Content of the notepad")

# Properties to receive via API for creation
class UserNotepadCreate(UserNotepadBase):
    user_id: UUID = Field(..., description="User ID who owns this notepad")

# Properties to receive via API for updates
class UserNotepadUpdate(BaseModel): 
    content: Optional[str] = Field(None, description="Updated content of the notepad")

# Properties shared by models stored in DB
class UserNotepadInDBBase(UserNotepadBase):
    user_id: UUID
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True # Replaces orm_mode=True
    )

# Properties to return to client
class UserNotepad(UserNotepadInDBBase):
    pass

# Properties stored in DB
class UserNotepadInDB(UserNotepadInDBBase):
    pass 