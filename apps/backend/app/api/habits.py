from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from sqlalchemy.exc import IntegrityError
from datetime import date

from app.database.database import get_db
from app.crud.habits import CRUDHabit, CRUDHabitEntry, CRUDHabitStreak, CRUDHabitBuddy
from app.service.habit_buddies_email_manager import HabitBuddiesEmailManager
from app.schemas.habits import (
    HabitCreate,
    HabitUpdate,
    HabitResponse,
    HabitEntryCreate,
    HabitEntryCreatePayload,
    HabitEntryUpdate,
    HabitEntryResponse,
    HabitStreakCreate,
    HabitStreakUpdate,
    HabitStreakResponse,
    HabitBuddyCreate,
    HabitBuddyUpdate,
    HabitBuddyResponse
)

router = APIRouter()

# --- Habit Buddy Endpoints (Must come before generic habit routes) ---
@router.post("/buddies", response_model=HabitBuddyResponse, status_code=status.HTTP_201_CREATED)
async def create_habit_buddy(
    *,
    db: AsyncSession = Depends(get_db),
    buddy_in: HabitBuddyCreate
) -> HabitBuddyResponse:
    """Create a new habit buddy."""
    crud = CRUDHabitBuddy(db)
    try:
        buddy = await crud.create(obj_in=buddy_in)
        return HabitBuddyResponse.model_validate(buddy)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/buddies/{buddy_id}", response_model=HabitBuddyResponse)
async def get_habit_buddy(
    *,
    db: AsyncSession = Depends(get_db),
    buddy_id: UUID
) -> HabitBuddyResponse:
    """Get a habit buddy by ID."""
    crud = CRUDHabitBuddy(db)
    buddy = await crud.get(id=buddy_id)
    if not buddy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habit buddy not found"
        )
    return HabitBuddyResponse.model_validate(buddy)

@router.get("/buddies", response_model=List[HabitBuddyResponse])
async def get_habit_buddies(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID,
    skip: int = 0,
    limit: int = 100
) -> List[HabitBuddyResponse]:
    """Get all habit buddies for a user."""
    crud = CRUDHabitBuddy(db)
    buddies = await crud.get_by_user(user_id=user_id)
    return [HabitBuddyResponse.model_validate(b) for b in buddies]

@router.put("/buddies/{buddy_id}", response_model=HabitBuddyResponse)
async def update_habit_buddy(
    *,
    db: AsyncSession = Depends(get_db),
    buddy_id: UUID,
    buddy_in: HabitBuddyUpdate
) -> HabitBuddyResponse:
    """Update a habit buddy."""
    crud = CRUDHabitBuddy(db)
    buddy = await crud.get(id=buddy_id)
    if not buddy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habit buddy not found"
        )
    try:
        updated_buddy = await crud.update(db_obj=buddy, obj_in=buddy_in)
        return HabitBuddyResponse.model_validate(updated_buddy)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/buddies/{buddy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_habit_buddy(
    *,
    db: AsyncSession = Depends(get_db),
    buddy_id: UUID
) -> None:
    """Delete a habit buddy."""
    crud = CRUDHabitBuddy(db)
    buddy = await crud.get(id=buddy_id)
    if not buddy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habit buddy not found"
        )
    await crud.remove(id=buddy_id)

@router.post("/buddies/{buddy_id}/send-email", status_code=status.HTTP_200_OK)
async def send_accountability_email(
    *,
    db: AsyncSession = Depends(get_db),
    buddy_id: UUID,
    user_id: UUID
) -> dict:
    """Send accountability email to a habit buddy."""
    crud_buddy = CRUDHabitBuddy(db)
    
    # Get the buddy
    buddy = await crud_buddy.get(id=buddy_id)
    if not buddy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habit buddy not found"
        )
    
    # Verify the buddy belongs to the user
    if buddy.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to send email for this buddy"
        )
    
    try:
        # Create email manager and send accountability email
        email_manager = HabitBuddiesEmailManager()
        
        # Check if email service is configured
        if not email_manager.is_configured():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Email service is not properly configured"
            )
        
        # Send the accountability email
        response = await email_manager.send_accountability_email(
            db=db,
            user_id=user_id,
            buddy_email=buddy.buddy_email,
            days_back=7,  # Send last 7 days of data
            censor_habits=buddy.censor_habits  # Use the censor_habits flag from the buddy record
        )
        
        if "error" in response:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to send email: {response['error']}"
            )
        
        return {
            "message": "Accountability email sent successfully",
            "buddy_email": buddy.buddy_email,
            "email_sent": True,
            "censored": buddy.censor_habits,
            "mailgun_response": response
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send accountability email: {str(e)}"
        )

# --- Habit Endpoints ---
@router.post("/", response_model=HabitResponse, status_code=status.HTTP_201_CREATED)
async def create_habit(
    *,
    db: AsyncSession = Depends(get_db),
    habit_in: HabitCreate
) -> HabitResponse:
    """Create a new habit."""
    crud = CRUDHabit(db)
    try:
        habit = await crud.create(obj_in=habit_in)
        return HabitResponse.model_validate(habit)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/{habit_id}", response_model=HabitResponse)
async def get_habit(
    *,
    db: AsyncSession = Depends(get_db),
    habit_id: UUID,
    user_id: UUID
) -> HabitResponse:
    """Get a habit by ID."""
    crud = CRUDHabit(db)
    habit = await crud.get(id=habit_id, user_id=user_id)
    if not habit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habit not found"
        )
    return HabitResponse.model_validate(habit)

@router.get("/", response_model=List[HabitResponse])
async def get_habits(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID,
    skip: int = 0,
    limit: int = 100
) -> List[HabitResponse]:
    """Get all habits for a user."""
    crud = CRUDHabit(db)
    habits = await crud.get_multi_by_user(user_id=user_id, skip=skip, limit=limit)
    return [HabitResponse.model_validate(h) for h in habits]

@router.put("/{habit_id}", response_model=HabitResponse)
async def update_habit(
    *,
    db: AsyncSession = Depends(get_db),
    habit_id: UUID,
    user_id: UUID,
    habit_in: HabitUpdate
) -> HabitResponse:
    """Update a habit."""
    crud = CRUDHabit(db)
    habit = await crud.get(id=habit_id, user_id=user_id)
    if not habit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habit not found"
        )
    try:
        updated_habit = await crud.update(db_obj=habit, obj_in=habit_in)
        return HabitResponse.model_validate(updated_habit)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_habit(
    *,
    db: AsyncSession = Depends(get_db),
    habit_id: UUID,
    user_id: UUID
) -> None:
    """Delete a habit."""
    crud = CRUDHabit(db)
    habit = await crud.get(id=habit_id, user_id=user_id)
    if not habit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habit not found"
        )
    await crud.remove(id=habit_id, user_id=user_id)

# --- Habit Entry Endpoints ---
@router.post("/{habit_id}/entries", response_model=HabitEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_habit_entry(
    *,
    db: AsyncSession = Depends(get_db),
    habit_id: UUID,
    entry_payload: HabitEntryCreatePayload
) -> HabitEntryResponse:
    """Create a new habit entry."""
    entry_in = HabitEntryCreate(
        habit_id=habit_id, 
        **entry_payload.model_dump()
    )
    
    crud = CRUDHabitEntry(db)
    try:
        entry = await crud.create(obj_in=entry_in)
        return HabitEntryResponse.model_validate(entry)
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An entry for this habit on this date already exists. Original error: {e}"
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {e}"
        )

@router.get("/{habit_id}/entries", response_model=List[HabitEntryResponse])
async def get_habit_entries(
    *,
    db: AsyncSession = Depends(get_db),
    habit_id: UUID,
    skip: int = 0,
    limit: int = 100,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> List[HabitEntryResponse]:
    """Get all entries for a habit."""
    crud = CRUDHabitEntry(db)
    entries = await crud.get_multi_by_habit(
        habit_id=habit_id,
        skip=skip,
        limit=limit,
        start_date=start_date,
        end_date=end_date
    )
    return [HabitEntryResponse.model_validate(e) for e in entries]

@router.put("/{habit_id}/entries/{entry_id}", response_model=HabitEntryResponse)
async def update_habit_entry(
    *,
    db: AsyncSession = Depends(get_db),
    habit_id: UUID,
    entry_id: UUID,
    entry_in: HabitEntryUpdate
) -> HabitEntryResponse:
    """Update a habit entry."""
    crud = CRUDHabitEntry(db)
    entry = await crud.get(id=entry_id, habit_id=habit_id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habit entry not found"
        )
    try:
        updated_entry = await crud.update(db_obj=entry, obj_in=entry_in)
        return HabitEntryResponse.model_validate(updated_entry)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/{habit_id}/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_habit_entry(
    *,
    db: AsyncSession = Depends(get_db),
    habit_id: UUID,
    entry_id: UUID
) -> None:
    """Delete a habit entry."""
    crud = CRUDHabitEntry(db)
    entry = await crud.get(id=entry_id, habit_id=habit_id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habit entry not found"
        )
    await crud.remove(id=entry_id, habit_id=habit_id)

# --- Habit Streak Endpoints ---
@router.post("/{habit_id}/streak", response_model=HabitStreakResponse, status_code=status.HTTP_201_CREATED)
async def create_habit_streak(
    *,
    db: AsyncSession = Depends(get_db),
    habit_id: UUID,
    streak_in: HabitStreakCreate
) -> HabitStreakResponse:
    """Create a new habit streak."""
    crud = CRUDHabitStreak(db)
    try:
        streak = await crud.create(obj_in=streak_in)
        return HabitStreakResponse.model_validate(streak)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/{habit_id}/streak", response_model=HabitStreakResponse)
async def get_habit_streak(
    *,
    db: AsyncSession = Depends(get_db),
    habit_id: UUID
) -> HabitStreakResponse:
    """Get a habit's streak."""
    crud = CRUDHabitStreak(db)
    streak = await crud.get(habit_id=habit_id)
    if not streak:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habit streak not found"
        )
    return HabitStreakResponse.model_validate(streak)

@router.put("/{habit_id}/streak", response_model=HabitStreakResponse)
async def update_habit_streak(
    *,
    db: AsyncSession = Depends(get_db),
    habit_id: UUID,
    streak_in: HabitStreakUpdate
) -> HabitStreakResponse:
    """Update a habit's streak."""
    crud = CRUDHabitStreak(db)
    streak = await crud.get(habit_id=habit_id)
    if not streak:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habit streak not found"
        )
    try:
        updated_streak = await crud.update(db_obj=streak, obj_in=streak_in)
        return HabitStreakResponse.model_validate(updated_streak)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/{habit_id}/streak", status_code=status.HTTP_204_NO_CONTENT)
async def delete_habit_streak(
    *,
    db: AsyncSession = Depends(get_db),
    habit_id: UUID
) -> None:
    """Delete a habit's streak."""
    crud = CRUDHabitStreak(db)
    streak = await crud.get(habit_id=habit_id)
    if not streak:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habit streak not found"
        )
    await crud.remove(habit_id=habit_id) 