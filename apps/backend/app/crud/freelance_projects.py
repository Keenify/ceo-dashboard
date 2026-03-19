from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import List, Optional, Union, Dict, Any

from app.models.freelance_projects import FreelanceProject
from app.schemas.freelance_projects import (
    FreelanceProjectCreate,
    FreelanceProjectUpdate
)
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError


class CRUDFreelanceProject:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: FreelanceProjectCreate) -> FreelanceProject:
        """Creates a new FreelanceProject."""
        db_obj = FreelanceProject(**obj_in.model_dump())
        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not create FreelanceProject: {e}"
            )

    async def get(self, *, id: UUID, user_id: UUID) -> Optional[FreelanceProject]:
        """Retrieves a single freelance project by ID and user ID."""
        result = await self.db.execute(
            select(FreelanceProject).filter(
                FreelanceProject.id == id,
                FreelanceProject.user_id == user_id
            )
        )
        return result.scalars().first()

    async def get_by_user(self, *, user_id: UUID) -> List[FreelanceProject]:
        """Retrieves all freelance projects for a specific user, ordered by created_at desc."""
        result = await self.db.execute(
            select(FreelanceProject)
            .filter(FreelanceProject.user_id == user_id)
            .order_by(FreelanceProject.created_at.desc())
        )
        return result.scalars().all()

    async def update(
        self, *, db_obj: FreelanceProject, obj_in: Union[FreelanceProjectUpdate, Dict[str, Any]]
    ) -> FreelanceProject:
        """Updates an existing freelance project."""
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
                detail=f"Could not update FreelanceProject: {e}"
            )

    async def remove(self, *, id: UUID, user_id: UUID) -> Optional[FreelanceProject]:
        """Deletes a freelance project by ID and user ID."""
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
                    detail=f"Cannot delete FreelanceProject: {e}"
                )
        return None
