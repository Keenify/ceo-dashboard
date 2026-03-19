from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional, List
from uuid import UUID

# Shared properties
class JournalTemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Template name")
    description: Optional[str] = Field(None, description="Template description")
    is_default: bool = Field(False, description="Whether this is a default template")

# Properties to receive via API for creation
class JournalTemplateCreate(JournalTemplateBase):
    user_id: Optional[UUID] = Field(None, description="User ID - null for default templates")

# Properties to receive via API for updates
class JournalTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Template name")
    description: Optional[str] = Field(None, description="Template description")

# Properties shared by models stored in DB
class JournalTemplateInDBBase(JournalTemplateBase):
    id: UUID
    user_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )

# Properties to return to client
class JournalTemplate(JournalTemplateInDBBase):
    pass

# Properties to return to client with questions included
class JournalTemplateWithQuestions(JournalTemplate):
    questions: List['JournalQuestion'] = []

# Properties stored in DB
class JournalTemplateInDB(JournalTemplateInDBBase):
    pass

# For template duplication
class JournalTemplateDuplicate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="New template name")
    description: Optional[str] = Field(None, description="New template description")

# Forward reference resolution
from app.schemas.journal_questions import JournalQuestion
JournalTemplateWithQuestions.model_rebuild()