from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy import and_
from fastapi import HTTPException
from typing import Optional, Dict, Any, Union, List
from uuid import UUID
import uuid

from app.models.user_settings import UserSettings
from app.schemas.user_settings import (
    UserSettingsCreate, UserSettingsUpdate
)

class CRUDUserSettings:
    """CRUD operations for user settings."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: UserSettingsCreate) -> UserSettings:
        """Creates a new UserSettings record."""
        try:
            # Convert user_id from string to UUID
            user_uuid = UUID(obj_in.user_id)
            
            # Create the database object
            data = obj_in.model_dump()
            data['user_id'] = user_uuid
            db_obj = UserSettings(**data)
            
            # Add and commit
            self.db.add(db_obj)
            await self.db.commit()
            await self.db.refresh(db_obj)
            
            return db_obj
            
        except IntegrityError as e:
            await self.db.rollback()
            if "user_settings_user_id_key" in str(e.orig):
                raise HTTPException(
                    status_code=409,
                    detail=f"User settings already exist for user {obj_in.user_id}"
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Could not create UserSettings record: {e.orig}"
                )
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Unexpected error creating UserSettings: {str(e)}"
            )

    async def get_by_user_id(self, *, user_id: UUID) -> Optional[UserSettings]:
        """Retrieves a UserSettings record by user ID."""
        try:
            result = await self.db.execute(
                select(UserSettings).filter(UserSettings.user_id == user_id)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error fetching user settings: {str(e)}"
            )

    async def get_or_create(self, *, user_id: UUID) -> UserSettings:
        """Gets existing user settings or creates default ones."""
        # Try to get existing settings
        settings = await self.get_by_user_id(user_id=user_id)
        
        if settings:
            return settings
        
        # Create default settings if none exist
        try:
            create_data = UserSettingsCreate(
                user_id=str(user_id),
                email_reminders_enabled=True,
                reminder_days_before=3,
                email_address="",
                phone_number=None,
                last_reset_date=None
            )
            return await self.create(obj_in=create_data)
        except HTTPException as e:
            # If creation failed due to race condition (another request created it), 
            # try to fetch again
            if e.status_code == 409:
                settings = await self.get_by_user_id(user_id=user_id)
                if settings:
                    return settings
            raise e

    async def update(
        self, *, db_obj: UserSettings, obj_in: Union[UserSettingsUpdate, Dict[str, Any]]
    ) -> UserSettings:
        """Updates an existing UserSettings record."""
        try:
            if isinstance(obj_in, dict):
                update_data = obj_in
            else:
                update_data = obj_in.model_dump(exclude_unset=True)
            
            # Update fields
            for field, value in update_data.items():
                if hasattr(db_obj, field):
                    setattr(db_obj, field, value)
            
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
            
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail=f"Could not update UserSettings record: {e.orig}"
            )
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Unexpected error updating UserSettings: {str(e)}"
            )

    async def upsert(self, *, user_id: UUID, obj_in: UserSettingsUpdate) -> UserSettings:
        """Updates existing settings or creates new ones with the provided data."""
        # Try to get existing settings
        settings = await self.get_by_user_id(user_id=user_id)
        
        if settings:
            # Update existing
            return await self.update(db_obj=settings, obj_in=obj_in)
        else:
            # Create new with provided data
            create_data = UserSettingsCreate(
                user_id=str(user_id),
                email_reminders_enabled=obj_in.email_reminders_enabled or True,
                reminder_days_before=obj_in.reminder_days_before or 3,
                email_address=obj_in.email_address or "",
                phone_number=obj_in.phone_number,
                last_reset_date=obj_in.last_reset_date
            )
            return await self.create(obj_in=create_data)

    async def delete(self, *, user_id: UUID) -> bool:
        """Deletes a UserSettings record by user ID."""
        try:
            settings = await self.get_by_user_id(user_id=user_id)
            if settings:
                await self.db.delete(settings)
                await self.db.commit()
                return True
            return False
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Error deleting user settings: {str(e)}"
            )

    async def get_users_with_reminders_enabled(self) -> List[UserSettings]:
        """Gets all users who have email reminders enabled."""
        try:
            result = await self.db.execute(
                select(UserSettings).filter(
                    and_(
                        UserSettings.email_reminders_enabled == True,
                        UserSettings.email_address != ""
                    )
                )
            )
            return list(result.scalars().all())
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error fetching users with reminders enabled: {str(e)}"
            )

    async def get_users_with_phone_numbers(self) -> List[UserSettings]:
        """Gets all users who have phone numbers set for WhatsApp reminders."""
        try:
            result = await self.db.execute(
                select(UserSettings).filter(
                    and_(
                        UserSettings.phone_number.is_not(None),
                        UserSettings.phone_number != ""
                    )
                )
            )
            return list(result.scalars().all())
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error fetching users with phone numbers: {str(e)}"
            ) 