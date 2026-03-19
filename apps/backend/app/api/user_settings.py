from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from app.database.database import get_db
from app.crud.user_settings import CRUDUserSettings
from app.schemas.user_settings import (
    UserSettingsResponse, UserSettingsCreate, UserSettingsUpdate
)

router = APIRouter()

@router.get("/{user_id}", response_model=UserSettingsResponse)
async def get_user_settings(
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get user settings by user ID.
    Creates default settings if none exist.
    """
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    crud = CRUDUserSettings(db)
    settings = await crud.get_or_create(user_id=user_uuid)
    
    return UserSettingsResponse(
        id=str(settings.id),
        user_id=str(settings.user_id),
        email_reminders_enabled=settings.email_reminders_enabled,
        reminder_days_before=settings.reminder_days_before,
        email_address=settings.email_address,
        last_reset_date=settings.last_reset_date,
        created_at=settings.created_at.isoformat(),
        updated_at=settings.updated_at.isoformat()
    )

@router.put("/{user_id}", response_model=UserSettingsResponse)
async def update_user_settings(
    user_id: str,
    settings_update: UserSettingsUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update user settings by user ID.
    Creates new settings if none exist.
    """
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    # Validate email if provided
    if settings_update.email_address is not None:
        email = settings_update.email_address.strip()
        if email and "@" not in email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid email address format"
            )
        # Update with cleaned email
        settings_update.email_address = email
    
    crud = CRUDUserSettings(db)
    settings = await crud.upsert(user_id=user_uuid, obj_in=settings_update)
    
    return UserSettingsResponse(
        id=str(settings.id),
        user_id=str(settings.user_id),
        email_reminders_enabled=settings.email_reminders_enabled,
        reminder_days_before=settings.reminder_days_before,
        email_address=settings.email_address,
        last_reset_date=settings.last_reset_date,
        created_at=settings.created_at.isoformat(),
        updated_at=settings.updated_at.isoformat()
    )

@router.post("/", response_model=UserSettingsResponse)
async def create_user_settings(
    settings_create: UserSettingsCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create new user settings.
    Returns 409 if settings already exist for this user.
    """
    # Validate email if provided
    if settings_create.email_address:
        email = settings_create.email_address.strip()
        if email and "@" not in email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid email address format"
            )
        settings_create.email_address = email
    
    crud = CRUDUserSettings(db)
    settings = await crud.create(obj_in=settings_create)
    
    return UserSettingsResponse(
        id=str(settings.id),
        user_id=str(settings.user_id),
        email_reminders_enabled=settings.email_reminders_enabled,
        reminder_days_before=settings.reminder_days_before,
        email_address=settings.email_address,
        last_reset_date=settings.last_reset_date,
        created_at=settings.created_at.isoformat(),
        updated_at=settings.updated_at.isoformat()
    )

@router.delete("/{user_id}")
async def delete_user_settings(
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete user settings by user ID.
    """
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    crud = CRUDUserSettings(db)
    deleted = await crud.delete(user_id=user_uuid)
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User settings not found"
        )
    
    return {"message": "User settings deleted successfully"}

@router.get("/admin/reminder-users", response_model=List[UserSettingsResponse])
async def get_users_with_reminders_enabled(
    db: AsyncSession = Depends(get_db)
):
    """
    Admin endpoint: Get all users who have email reminders enabled.
    Used by the scheduler to determine who should receive reminder emails.
    """
    crud = CRUDUserSettings(db)
    users = await crud.get_users_with_reminders_enabled()
    
    return [
        UserSettingsResponse(
            id=str(user.id),
            user_id=str(user.user_id),
            email_reminders_enabled=user.email_reminders_enabled,
            reminder_days_before=user.reminder_days_before,
            email_address=user.email_address,
            last_reset_date=user.last_reset_date,
            created_at=user.created_at.isoformat(),
            updated_at=user.updated_at.isoformat()
        )
        for user in users
    ] 