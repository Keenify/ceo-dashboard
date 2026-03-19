from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update, delete
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime

from app.models.mindmaps import Mindmap
from app.schemas.mindmaps import MindmapCreate, MindmapUpdate


class CRUDMindmap:
    """Mindmap CRUD operations with async support."""
    
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: MindmapCreate) -> Optional[Mindmap]:
        """Create a new mindmap."""
        try:
            db_mindmap = Mindmap(
                user_id=obj_in.user_id,
                title=obj_in.title,
                description=obj_in.description,
                mindmap=obj_in.mindmap
            )
            self.db.add(db_mindmap)
            await self.db.commit()
            await self.db.refresh(db_mindmap)
            return db_mindmap
        except SQLAlchemyError as e:
            await self.db.rollback()
            print(f"Error creating mindmap: {e}")
            return None

    async def get(self, *, id: UUID) -> Optional[Mindmap]:
        """Get a mindmap by ID (only non-deleted)."""
        try:
            query = select(Mindmap).where(
                and_(
                    Mindmap.id == id,
                    Mindmap.deleted_at.is_(None)
                )
            )
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            print(f"Error retrieving mindmap: {e}")
            return None

    async def get_multi_by_user(
        self, 
        *, 
        user_id: UUID, 
        skip: int = 0, 
        limit: int = 100
    ) -> List[Mindmap]:
        """Get all mindmaps for a specific user (only non-deleted)."""
        try:
            query = (
                select(Mindmap)
                .where(
                    and_(
                        Mindmap.user_id == user_id,
                        Mindmap.deleted_at.is_(None)
                    )
                )
                .offset(skip)
                .limit(limit)
                .order_by(Mindmap.updated_at.desc())
            )
            result = await self.db.execute(query)
            return list(result.scalars().all())
        except SQLAlchemyError as e:
            print(f"Error retrieving mindmaps for user {user_id}: {e}")
            return []

    async def get_multi(self, *, skip: int = 0, limit: int = 100) -> List[Mindmap]:
        """Get all mindmaps (only non-deleted)."""
        try:
            query = (
                select(Mindmap)
                .where(Mindmap.deleted_at.is_(None))
                .offset(skip)
                .limit(limit)
                .order_by(Mindmap.updated_at.desc())
            )
            result = await self.db.execute(query)
            return list(result.scalars().all())
        except SQLAlchemyError as e:
            print(f"Error retrieving all mindmaps: {e}")
            return []

    async def update(self, *, db_obj: Mindmap, obj_in: MindmapUpdate) -> Optional[Mindmap]:
        """Update a mindmap."""
        try:
            update_data = obj_in.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                setattr(db_obj, field, value)
            
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except SQLAlchemyError as e:
            await self.db.rollback()
            print(f"Error updating mindmap: {e}")
            return None

    async def soft_delete(self, *, id: UUID) -> Optional[Mindmap]:
        """Soft delete a mindmap."""
        try:
            mindmap = await self.get(id=id)
            if mindmap:
                mindmap.deleted_at = datetime.utcnow()
                await self.db.commit()
                await self.db.refresh(mindmap)
            return mindmap
        except SQLAlchemyError as e:
            await self.db.rollback()
            print(f"Error soft deleting mindmap: {e}")
            return None

    async def remove(self, *, id: UUID) -> Optional[Mindmap]:
        """Permanently delete a mindmap."""
        try:
            query = select(Mindmap).where(Mindmap.id == id)
            result = await self.db.execute(query)
            mindmap = result.scalar_one_or_none()
            if mindmap:
                await self.db.delete(mindmap)
                await self.db.commit()
            return mindmap
        except SQLAlchemyError as e:
            await self.db.rollback()
            print(f"Error hard deleting mindmap: {e}")
            return None

    async def restore(self, *, id: UUID) -> Optional[Mindmap]:
        """Restore a soft-deleted mindmap."""
        try:
            query = select(Mindmap).where(Mindmap.id == id)
            result = await self.db.execute(query)
            mindmap = result.scalar_one_or_none()
            if mindmap and mindmap.deleted_at is not None:
                mindmap.deleted_at = None
                await self.db.commit()
                await self.db.refresh(mindmap)
            return mindmap
        except SQLAlchemyError as e:
            await self.db.rollback()
            print(f"Error restoring mindmap: {e}")
            return None 