from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from pydantic import ValidationError

from app.database.database import get_db
from app.schemas.future_letters import (
    FutureLetterCreate, FutureLetterUpdate, FutureLetterResponse
)
from app.crud.future_letters import CRUDFutureLetter

router = APIRouter()

@router.post("/", response_model=FutureLetterResponse, status_code=status.HTTP_201_CREATED)
async def create_future_letter(
    *,
    db: AsyncSession = Depends(get_db),
    future_letter_in: FutureLetterCreate
) -> FutureLetterResponse:
    """Create a new future letter."""
    crud = CRUDFutureLetter(db)
    try:
        future_letter = await crud.create(obj_in=future_letter_in)
        return FutureLetterResponse.model_validate(future_letter)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"validation_error": e.errors()}
        )
    except IntegrityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Database integrity error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        )

@router.get("/{future_letter_id}", response_model=FutureLetterResponse)
async def get_future_letter(
    *,
    db: AsyncSession = Depends(get_db),
    future_letter_id: UUID,
    user_id: UUID
) -> FutureLetterResponse:
    """Get a future letter by ID."""
    crud = CRUDFutureLetter(db)
    future_letter = await crud.get(id=future_letter_id, user_id=user_id)
    if not future_letter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="FutureLetter not found"
        )
    return FutureLetterResponse.model_validate(future_letter)

@router.get("/", response_model=List[FutureLetterResponse])
async def get_future_letters(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID,
    skip: int = 0,
    limit: int = 100
) -> List[FutureLetterResponse]:
    """Get all future letters for a user."""
    crud = CRUDFutureLetter(db)
    letters = await crud.get_multi_by_user(user_id=user_id, skip=skip, limit=limit)
    return [FutureLetterResponse.model_validate(letter) for letter in letters]

@router.put("/{future_letter_id}", response_model=FutureLetterResponse)
async def update_future_letter(
    *,
    db: AsyncSession = Depends(get_db),
    future_letter_id: UUID,
    user_id: UUID,
    future_letter_in: FutureLetterUpdate
) -> FutureLetterResponse:
    """Update a future letter."""
    crud = CRUDFutureLetter(db)
    future_letter = await crud.get(id=future_letter_id, user_id=user_id)
    if not future_letter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="FutureLetter not found"
        )
    try:
        updated = await crud.update(db_obj=future_letter, obj_in=future_letter_in)
        return FutureLetterResponse.model_validate(updated)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/{future_letter_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_future_letter(
    *,
    db: AsyncSession = Depends(get_db),
    future_letter_id: UUID,
    user_id: UUID
) -> None:
    """Delete a future letter."""
    crud = CRUDFutureLetter(db)
    future_letter = await crud.get(id=future_letter_id, user_id=user_id)
    if not future_letter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="FutureLetter not found"
        )
    await crud.remove(id=future_letter_id, user_id=user_id)
