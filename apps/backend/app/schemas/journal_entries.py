from pydantic import BaseModel, Field, ConfigDict
from datetime import date, datetime
from typing import Optional
from uuid import UUID

# Shared properties
class JournalEntryBase(BaseModel):
    question_id: int = Field(..., ge=1, description="Question ID from journal_questions table")
    entry_date: date
    answer: str
    user_id: UUID # Add user_id here as it's key for upsert
    template_id: Optional[UUID] = Field(None, description="Template ID this entry belongs to")

# Properties to receive via API for Upsert operation
class JournalEntryUpsert(JournalEntryBase):
    # Inherits all fields from JournalEntryBase, all are required for upsert
    pass

# Properties to receive via API for updates
class JournalEntryUpdate(BaseModel):
    answer: Optional[str] = Field(None, description="Updated answer")

# Properties shared by models stored in DB
class JournalEntryInDBBase(JournalEntryBase):
    id: int
    # user_id is already in JournalEntryBase
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True # Replaces orm_mode=True
    )

# Properties to return to client
class JournalEntry(JournalEntryInDBBase):
    pass

# Properties stored in DB
class JournalEntryInDB(JournalEntryInDBBase):
    pass

# For bulk entry submission (all questions for a template on a date)
class JournalEntryBulkUpsert(BaseModel):
    template_id: UUID
    entry_date: date
    answers: dict[int, str] = Field(..., description="Dictionary mapping question_id to answer")
    user_id: UUID
