from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from uuid import UUID
from typing import List, Optional, Union, Dict, Any
from datetime import datetime

from app.models.social_posts import SocialPost
from app.schemas.social_posts import SocialPostCreate, SocialPostUpdate
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

class CRUDSocialPost:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: SocialPostCreate) -> SocialPost:
        """Creates a new SocialPost."""
        db_obj = SocialPost(**obj_in.model_dump())
        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not create SocialPost: {e}"
            )

    async def get(self, *, id: UUID, user_id: UUID) -> Optional[SocialPost]:
        """Retrieves a single SocialPost by its ID and User ID."""
        result = await self.db.execute(
            select(SocialPost).filter(SocialPost.id == id, SocialPost.user_id == user_id)
        )
        return result.scalars().first()

    async def get_multi_by_user(
        self, *, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[SocialPost]:
        """Retrieves SocialPosts for a specific user, ordered by created_at descending."""
        query = select(SocialPost).filter(SocialPost.user_id == user_id)
        query = query.order_by(desc(SocialPost.created_at))
        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def update(
        self, *, db_obj: SocialPost, obj_in: Union[SocialPostUpdate, Dict[str, Any]]
    ) -> SocialPost:
        """Updates an existing SocialPost."""
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
                detail=f"Could not update SocialPost: {e}"
            )

    async def remove(self, *, id: UUID, user_id: UUID) -> Optional[SocialPost]:
        """Deletes a SocialPost by its ID and User ID."""
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
                    detail=f"Cannot delete SocialPost due to constraints: {e}"
                )
        return None

    async def update_status(self, *, id: UUID, user_id: UUID, status: str, completed_at: Optional[datetime] = None) -> Optional[SocialPost]:
        """Updates the status of a SocialPost."""
        db_obj = await self.get(id=id, user_id=user_id)
        if db_obj:
            db_obj.status = status
            if completed_at:
                db_obj.completed_at = completed_at
            elif status == 'complete':
                db_obj.completed_at = datetime.utcnow()
            
            self.db.add(db_obj)
            try:
                await self.db.commit()
                await self.db.refresh(db_obj)
                return db_obj
            except IntegrityError as e:
                await self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Could not update SocialPost status: {e}"
                )
        return None