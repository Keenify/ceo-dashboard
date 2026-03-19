from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_, desc, asc
from sqlalchemy.orm import selectinload
from uuid import UUID
from datetime import date, datetime, timedelta
from typing import List, Optional, Union, Dict, Any

from app.models.annual_calendar_plans_notepads import UserNotepad
from app.schemas.annual_calendar_plans_notepads import (
    UserNotepadCreate,
    UserNotepadUpdate
)
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

class CRUDUserNotepad:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_user_id(self, *, user_id: UUID) -> Optional[UserNotepad]:
        """Retrieves a user's notepad by user ID."""
        result = await self.db.execute(
            select(UserNotepad).filter(UserNotepad.user_id == user_id)
        )
        return result.scalars().first()

    async def upsert(self, *, obj_in: UserNotepadCreate) -> UserNotepad:
        """Creates or updates a User Notepad (upsert operation)."""
        try:
            # Check if notepad exists for this user
            existing_notepad = await self.get_by_user_id(user_id=obj_in.user_id)
            
            if existing_notepad:
                # Update existing notepad
                update_data = obj_in.model_dump(exclude_unset=True)
                for field, value in update_data.items():
                    setattr(existing_notepad, field, value)
                
                await self.db.commit()
                await self.db.refresh(existing_notepad)
                return existing_notepad
            else:
                # Create new notepad
                db_obj = UserNotepad(**obj_in.model_dump())
                self.db.add(db_obj)
                await self.db.commit()
                await self.db.refresh(db_obj)
                return db_obj
                
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not upsert User Notepad: {e}"
            )

    async def update(self, *, user_id: UUID, obj_in: UserNotepadUpdate) -> Optional[UserNotepad]:
        """Updates a User Notepad."""
        try:
            db_obj = await self.get_by_user_id(user_id=user_id)
            if not db_obj:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User Notepad not found"
                )
            
            update_data = obj_in.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                setattr(db_obj, field, value)
            
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
            
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not update User Notepad: {e}"
            )

    async def clear(self, *, user_id: UUID) -> Optional[UserNotepad]:
        """Clears a User Notepad content."""
        try:
            db_obj = await self.get_by_user_id(user_id=user_id)
            if not db_obj:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User Notepad not found"
                )
            
            db_obj.content = None
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
            
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not clear User Notepad: {e}"
            )

    async def remove(self, *, user_id: UUID) -> Optional[UserNotepad]:
        """Deletes a User Notepad."""
        db_obj = await self.get_by_user_id(user_id=user_id)
        if not db_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User Notepad not found"
            )
        
        await self.db.delete(db_obj)
        await self.db.commit()
        return db_obj

    async def count_by_user(self, *, user_id: UUID) -> int:
        """Count notepads for a specific user."""
        result = await self.db.execute(
            select(UserNotepad).filter(UserNotepad.user_id == user_id)
        )
        return len(result.scalars().all())

    async def exists(self, *, user_id: UUID) -> bool:
        """Check if a notepad exists for a user."""
        result = await self.db.execute(
            select(UserNotepad).filter(UserNotepad.user_id == user_id)
        )
        return result.scalars().first() is not None 