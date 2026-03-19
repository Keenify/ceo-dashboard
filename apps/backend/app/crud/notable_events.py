from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import List, Optional, Union, Dict, Any

from app.models.notable_events import NotableEvent
from app.schemas.notable_events import (
    NotableEventCreate,
    NotableEventUpdate
)
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError


class CRUDNotableEvent:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: NotableEventCreate) -> NotableEvent:
        """Creates a new NotableEvent."""
        db_obj = NotableEvent(**obj_in.model_dump())
        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not create NotableEvent: {e}"
            )

    async def get(self, *, id: UUID, user_id: UUID) -> Optional[NotableEvent]:
        """Retrieves a single notable event by ID and user ID."""
        result = await self.db.execute(
            select(NotableEvent).filter(
                NotableEvent.id == id,
                NotableEvent.user_id == user_id
            )
        )
        return result.scalars().first()

    async def get_by_user(self, *, user_id: UUID) -> List[NotableEvent]:
        """Retrieves all notable events for a specific user, ordered by created_at desc."""
        result = await self.db.execute(
            select(NotableEvent)
            .filter(NotableEvent.user_id == user_id)
            .order_by(NotableEvent.created_at.desc())
        )
        return result.scalars().all()

    async def update(
        self, *, db_obj: NotableEvent, obj_in: Union[NotableEventUpdate, Dict[str, Any]]
    ) -> NotableEvent:
        """Updates an existing notable event."""
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(db_obj, field, value)

        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not update NotableEvent: {e}"
            )

    async def remove(self, *, id: UUID, user_id: UUID) -> Optional[NotableEvent]:
        """Deletes a notable event by ID and user ID."""
        db_obj = await self.get(id=id, user_id=user_id)
        if db_obj:
            await self.db.delete(db_obj)
            try:
                await self.db.commit()
                return db_obj
            except IntegrityError as e:
                await self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Cannot delete NotableEvent: {e}"
                )
        return None
