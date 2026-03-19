from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database.database import get_db
from app.crud.annual_calendar_plans_notepads import CRUDUserNotepad
from app.schemas.annual_calendar_plans_notepads import (
    UserNotepadCreate,
    UserNotepadUpdate,
    UserNotepad
)

router = APIRouter()

# ================================
# BASIC CRUD ENDPOINTS
# ================================

@router.get("/{user_id}", response_model=UserNotepad)
async def get_user_notepad(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID
) -> UserNotepad:
    """Get a user's notepad."""
    crud = CRUDUserNotepad(db)
    notepad = await crud.get_by_user_id(user_id=user_id)
    if not notepad:
        # Create empty notepad if none exists
        from app.schemas.annual_calendar_plans_notepads import UserNotepadCreate
        from datetime import datetime
        create_data = UserNotepadCreate(user_id=user_id, content='')
        notepad = await crud.upsert(obj_in=create_data)
        return UserNotepad.model_validate(notepad)
    return UserNotepad.model_validate(notepad)

@router.post("/", response_model=UserNotepad, status_code=status.HTTP_201_CREATED)
async def create_user_notepad(
    *,
    db: AsyncSession = Depends(get_db),
    notepad_in: UserNotepadCreate
) -> UserNotepad:
    """Create a new user notepad."""
    crud = CRUDUserNotepad(db)
    try:
        notepad = await crud.upsert(obj_in=notepad_in)
        return UserNotepad.model_validate(notepad)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.put("/{user_id}", response_model=UserNotepad)
async def upsert_user_notepad(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID,
    notepad_in: UserNotepadCreate
) -> UserNotepad:
    """Upsert a user's notepad (create or update)."""
    crud = CRUDUserNotepad(db)
    try:
        # Ensure user_id matches the path parameter
        notepad_in.user_id = user_id
        notepad = await crud.upsert(obj_in=notepad_in)
        return UserNotepad.model_validate(notepad)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.patch("/{user_id}", response_model=UserNotepad)
async def update_user_notepad(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID,
    notepad_in: UserNotepadUpdate
) -> UserNotepad:
    """Update a user's notepad."""
    crud = CRUDUserNotepad(db)
    try:
        notepad = await crud.update(user_id=user_id, obj_in=notepad_in)
        return UserNotepad.model_validate(notepad)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/{user_id}/clear", response_model=UserNotepad)
async def clear_user_notepad(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID
) -> UserNotepad:
    """Clear a user's notepad content."""
    crud = CRUDUserNotepad(db)
    try:
        notepad = await crud.clear(user_id=user_id)
        return UserNotepad.model_validate(notepad)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_notepad(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID
) -> None:
    """Delete a user's notepad."""
    crud = CRUDUserNotepad(db)
    try:
        await crud.remove(user_id=user_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

# ================================
# UTILITY ENDPOINTS
# ================================

@router.get("/{user_id}/exists")
async def check_notepad_exists(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID
) -> dict:
    """Check if a notepad exists for a user."""
    crud = CRUDUserNotepad(db)
    exists = await crud.exists(user_id=user_id)
    return {"exists": exists}

@router.get("/{user_id}/count")
async def get_notepad_count(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID
) -> dict:
    """Get the count of notepads for a user (should always be 0 or 1)."""
    crud = CRUDUserNotepad(db)
    count = await crud.count_by_user(user_id=user_id)
    return {"count": count} 