from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional
from uuid import UUID

# Shared properties
class JournalQuestionBase(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000, description="Question content")
    position: Optional[int] = Field(None, ge=1, description="Position within template")

# Properties to receive via API for creation
class JournalQuestionCreate(JournalQuestionBase):
    template_id: Optional[UUID] = Field(None, description="Template ID this question belongs to")

# Properties to receive via API for updates
class JournalQuestionUpdate(BaseModel):
    content: Optional[str] = Field(None, min_length=1, max_length=1000, description="Question content")
    position: Optional[int] = Field(None, ge=1, description="Position within template")

# Properties shared by models stored in DB
class JournalQuestionInDBBase(JournalQuestionBase):
    id: int
    template_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )

# Properties to return to client
class JournalQuestion(JournalQuestionInDBBase):
    pass

# Properties stored in DB
class JournalQuestionInDB(JournalQuestionInDBBase):
    pass

# For bulk reordering questions
class JournalQuestionReorder(BaseModel):
    question_id: int
    new_position: int

class JournalQuestionsReorderBulk(BaseModel):
    questions: list[JournalQuestionReorder] = Field(..., description="List of questions with new positions")