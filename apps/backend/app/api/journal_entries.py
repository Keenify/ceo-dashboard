from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID
from datetime import date

from app.crud.journal_entries import CRUDJournalEntry
from app.schemas.journal_entries import JournalEntry, JournalEntryUpsert, JournalEntryBulkUpsert
from app.database.database import get_db

router = APIRouter()

@router.post("/", response_model=JournalEntry, status_code=status.HTTP_200_OK)
async def upsert_journal_entry(
    *, 
    db: AsyncSession = Depends(get_db),
    entry_in: JournalEntryUpsert
):
    """
    Create a new journal entry if one doesn't exist for the user, template, question, and date, 
    or update the existing entry if it does.
    """
    crud = CRUDJournalEntry(db=db)
    entry = await crud.upsert(entry_in=entry_in)
    return entry

@router.post("/bulk", response_model=List[JournalEntry], status_code=status.HTTP_200_OK)
async def bulk_upsert_journal_entries(
    *, 
    db: AsyncSession = Depends(get_db),
    bulk_entry: JournalEntryBulkUpsert
):
    """
    Bulk upsert journal entries for all questions in a template on a specific date.
    """
    crud = CRUDJournalEntry(db=db)
    entries = await crud.bulk_upsert(bulk_entry=bulk_entry)
    return entries

@router.get("/user/{user_id}", response_model=List[JournalEntry])
async def read_journal_entries_by_user(
    user_id: UUID,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve journal entries for a specific user.
    """
    crud = CRUDJournalEntry(db=db)
    entries = await crud.get_multi_by_user(user_id=user_id, skip=skip, limit=limit)
    return entries

@router.get("/user/{user_id}/template/{template_id}", response_model=List[JournalEntry])
async def read_journal_entries_by_user_and_template(
    user_id: UUID,
    template_id: UUID,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve journal entries for a specific user and template.
    """
    crud = CRUDJournalEntry(db=db)
    entries = await crud.get_multi_by_user_and_template(user_id=user_id, template_id=template_id, skip=skip, limit=limit)
    return entries

@router.get("/user/{user_id}/date/{entry_date}", response_model=List[JournalEntry])
async def read_journal_entries_by_user_and_date(
    user_id: UUID,
    entry_date: date,
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve all journal entries for a specific user on a given date.
    Returns an empty list if no entries are found.
    """
    crud = CRUDJournalEntry(db=db)
    entries = await crud.get_multi_by_user_and_date(user_id=user_id, entry_date=entry_date)
    return entries

@router.get("/user/{user_id}/template/{template_id}/date/{entry_date}", response_model=List[JournalEntry])
async def read_journal_entries_by_user_template_and_date(
    user_id: UUID,
    template_id: UUID,
    entry_date: date,
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve journal entries for a specific user, template, and date.
    """
    crud = CRUDJournalEntry(db=db)
    entries = await crud.get_multi_by_user_template_and_date(user_id=user_id, template_id=template_id, entry_date=entry_date)
    return entries

@router.get("/user/{user_id}/dates", response_model=List[date])
async def get_entry_dates_by_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all unique entry dates for a user.
    """
    crud = CRUDJournalEntry(db=db)
    dates = await crud.get_entry_dates_by_user(user_id=user_id)
    return dates

@router.get("/user/{user_id}/template/{template_id}/dates", response_model=List[date])
async def get_entry_dates_by_user_and_template(
    user_id: UUID,
    template_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all unique entry dates for a user and template.
    """
    crud = CRUDJournalEntry(db=db)
    dates = await crud.get_entry_dates_by_user_and_template(user_id=user_id, template_id=template_id)
    return dates

# Legacy endpoint - keep for backward compatibility
@router.get("/user/{user_id}/date/{entry_date}/question/{question_id}", response_model=JournalEntry)
async def read_journal_entry_by_user_date_and_question(
    user_id: UUID,
    entry_date: date,
    question_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Legacy endpoint: Retrieve the unique journal entry for a specific user, date, and question.
    Returns 404 if no entry is found.
    """
    crud = CRUDJournalEntry(db=db)
    entry = await crud.get_by_user_date_and_question(
        user_id=user_id,
        entry_date=entry_date,
        question_id=question_id
    )
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No journal entry found for user {user_id}, date {entry_date}, and question {question_id}"
        )
    return entry

@router.get("/{entry_id}", response_model=JournalEntry)
async def read_journal_entry(
    entry_id: int, 
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve a specific journal entry by its ID.
    """
    crud = CRUDJournalEntry(db=db)
    entry = await crud.get(id=entry_id)
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found")
    return entry

@router.delete("/{entry_id}", response_model=JournalEntry)
async def delete_journal_entry(
    *, 
    db: AsyncSession = Depends(get_db),
    entry_id: int
):
    """
    Delete a specific journal entry.
    """
    crud = CRUDJournalEntry(db=db)
    db_entry = await crud.get(id=entry_id)
    if not db_entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found")
    deleted_entry = await crud.remove(id=entry_id)
    return deleted_entry
