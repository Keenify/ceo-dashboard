from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database.database import get_db
from app.schemas.weekly_ryhthms import (
    WeeklyRhythmCreate, WeeklyRhythmUpdate, WeeklyRhythmResponse
)
from app.crud.weekly_ryhthms import CRUDWeeklyRhythm

router = APIRouter()

# --- WeeklyRhythm Endpoints ---
@router.post("/", response_model=WeeklyRhythmResponse, status_code=status.HTTP_201_CREATED)
async def create_weekly_rhythm(
    *,
    db: AsyncSession = Depends(get_db),
    weekly_rhythm_in: WeeklyRhythmCreate
) -> WeeklyRhythmResponse:
    """Create a new weekly rhythm."""
    crud = CRUDWeeklyRhythm(db)
    try:
        weekly_rhythm = await crud.create(obj_in=weekly_rhythm_in)
        return WeeklyRhythmResponse.model_validate(weekly_rhythm)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/{weekly_rhythm_id}", response_model=WeeklyRhythmResponse)
async def get_weekly_rhythm(
    *,
    db: AsyncSession = Depends(get_db),
    weekly_rhythm_id: UUID,
    user_id: UUID
) -> WeeklyRhythmResponse:
    """Get a weekly rhythm by ID."""
    crud = CRUDWeeklyRhythm(db)
    weekly_rhythm = await crud.get(id=weekly_rhythm_id, user_id=user_id)
    if not weekly_rhythm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="WeeklyRhythm not found"
        )
    return WeeklyRhythmResponse.model_validate(weekly_rhythm)

@router.get("/by-week/{week_id}", response_model=WeeklyRhythmResponse)
async def get_weekly_rhythm_by_week(
    *,
    db: AsyncSession = Depends(get_db),
    week_id: str,
    user_id: UUID
) -> WeeklyRhythmResponse:
    """Get a weekly rhythm by week start date."""
    try:
        from datetime import date
        # Convert the week_id string to a date object
        week_start_date = date.fromisoformat(week_id)
        
        crud = CRUDWeeklyRhythm(db)
        weekly_rhythm = await crud.get_by_week(user_id=user_id, week_start_date=week_start_date)
        
        if not weekly_rhythm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"WeeklyRhythm not found for week {week_id}"
            )
            
        return WeeklyRhythmResponse.model_validate(weekly_rhythm)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid date format: {week_id}. Use YYYY-MM-DD format."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error while fetching weekly rhythm"
        )

@router.get("/", response_model=List[WeeklyRhythmResponse])
async def get_weekly_rhythms(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID,
    skip: int = 0,
    limit: int = 100
) -> List[WeeklyRhythmResponse]:
    """Get all weekly rhythms for a user."""
    crud = CRUDWeeklyRhythm(db)
    rhythms = await crud.get_multi_by_user(user_id=user_id, skip=skip, limit=limit)
    return [WeeklyRhythmResponse.model_validate(r) for r in rhythms]

@router.put("/{weekly_rhythm_id}", response_model=WeeklyRhythmResponse)
async def update_weekly_rhythm(
    *,
    db: AsyncSession = Depends(get_db),
    weekly_rhythm_id: UUID,
    user_id: UUID,
    weekly_rhythm_in: WeeklyRhythmUpdate
) -> WeeklyRhythmResponse:
    """Update a weekly rhythm."""
    crud = CRUDWeeklyRhythm(db)
    weekly_rhythm = await crud.get(id=weekly_rhythm_id, user_id=user_id)
    if not weekly_rhythm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="WeeklyRhythm not found"
        )
    try:
        updated = await crud.update(db_obj=weekly_rhythm, obj_in=weekly_rhythm_in)
        return WeeklyRhythmResponse.model_validate(updated)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/{weekly_rhythm_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_weekly_rhythm(
    *,
    db: AsyncSession = Depends(get_db),
    weekly_rhythm_id: UUID,
    user_id: UUID
) -> None:
    """Delete a weekly rhythm."""
    crud = CRUDWeeklyRhythm(db)
    weekly_rhythm = await crud.get(id=weekly_rhythm_id, user_id=user_id)
    if not weekly_rhythm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="WeeklyRhythm not found"
        )
    await crud.remove(id=weekly_rhythm_id, user_id=user_id) 