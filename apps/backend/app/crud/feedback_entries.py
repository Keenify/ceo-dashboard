from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from uuid import UUID

from app.models.feedback_entries import FeedbackEntry
from app.schemas.feedback_entries import FeedbackCreate, FeedbackUpdate, Status

class CRUDFeedback:
    def __init__(self, db: AsyncSession):   
        self.db = db

    async def create(self, *, obj_in: FeedbackCreate, user_id: UUID) -> FeedbackEntry:
        """Create a new feedback entry"""
        db_obj = FeedbackEntry(
            user_id=user_id,
            module_name=obj_in.module_name,
            feedback_type=obj_in.feedback_type.value,
            title=obj_in.title,
            description=obj_in.description,
            priority=obj_in.priority.value,
            screenshots=obj_in.screenshots,
            status=Status.SUBMITTED.value  # Always start as submitted
        )
        self.db.add(db_obj)
        await self.db.commit()
        await self.db.refresh(db_obj)
        return db_obj

    async def get_by_id(self, *, feedback_id: UUID) -> Optional[FeedbackEntry]:
        """Get feedback entry by ID"""
        result = await self.db.execute(
            select(FeedbackEntry).where(FeedbackEntry.id == feedback_id)
        )
        return result.scalar_one_or_none()

    async def get_by_taiga_story_id(self, story_id: int) -> Optional[FeedbackEntry]:
        """Get feedback entry by Taiga story ID"""
        result = await self.db.execute(
            select(FeedbackEntry).where(FeedbackEntry.taiga_story_id == story_id)
        )
        return result.scalar_one_or_none()

    async def get_by_user(
        self, 
        *, 
        user_id: UUID, 
        skip: int = 0, 
        limit: int = 10,
        status_filter: Optional[Status] = None,
        feedback_type_filter: Optional[str] = None
    ) -> List[FeedbackEntry]:
        """Get user's feedback entries with optional filtering"""
        query = select(FeedbackEntry).where(FeedbackEntry.user_id == user_id)
        
        # Add filters if provided
        if status_filter:
            query = query.where(FeedbackEntry.status == status_filter.value)
        if feedback_type_filter:
            query = query.where(FeedbackEntry.feedback_type == feedback_type_filter)
        
        # Add pagination and ordering
        query = query.order_by(FeedbackEntry.created_at.desc()).offset(skip).limit(limit)
        
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_user_feedback_count(
        self,
        *,
        user_id: UUID,
        status_filter: Optional[Status] = None,
        feedback_type_filter: Optional[str] = None
    ) -> int:
        """Get total count of user's feedback entries (for pagination)"""
        query = select(func.count(FeedbackEntry.id)).where(FeedbackEntry.user_id == user_id)
        
        # Add filters if provided
        if status_filter:
            query = query.where(FeedbackEntry.status == status_filter.value)
        if feedback_type_filter:
            query = query.where(FeedbackEntry.feedback_type == feedback_type_filter)
        
        result = await self.db.execute(query)
        return result.scalar()

    async def get_pending_feedback(self) -> List[FeedbackEntry]:
        """Get all feedback entries that need to be synced to Taiga"""
        result = await self.db.execute(
            select(FeedbackEntry).where(
                FeedbackEntry.status == Status.SUBMITTED.value
            ).order_by(FeedbackEntry.created_at.asc())
        )
        return result.scalars().all()

    async def get_synced_feedback(self) -> List[FeedbackEntry]:
        """Get all feedback entries that are synced to Taiga (for status updates)"""
        result = await self.db.execute(
            select(FeedbackEntry).where(
                and_(
                    FeedbackEntry.taiga_story_id.isnot(None),
                    FeedbackEntry.status.in_([
                        Status.PENDING.value,
                        Status.IN_PROGRESS.value
                    ])
                )
            ).order_by(FeedbackEntry.updated_at.asc())
        )
        return result.scalars().all()

    async def update_taiga_info(
        self, 
        *, 
        feedback_id: UUID, 
        taiga_story_id: int, 
        taiga_project_id: int,
        status: Status = Status.PENDING
    ) -> Optional[FeedbackEntry]:
        """Update feedback with Taiga story information"""
        result = await self.db.execute(
            select(FeedbackEntry).where(FeedbackEntry.id == feedback_id)
        )
        db_obj = result.scalar_one_or_none()
        
        if db_obj:
            db_obj.taiga_story_id = taiga_story_id
            db_obj.taiga_project_id = taiga_project_id
            db_obj.status = status.value
            await self.db.commit()
            await self.db.refresh(db_obj)
        
        return db_obj

    async def update_status(
        self, 
        *, 
        feedback_id: UUID, 
        status: Status
    ) -> Optional[FeedbackEntry]:
        """Update feedback status"""
        result = await self.db.execute(
            select(FeedbackEntry).where(FeedbackEntry.id == feedback_id)
        )
        db_obj = result.scalar_one_or_none()
        
        if db_obj:
            db_obj.status = status.value
            await self.db.commit()
            await self.db.refresh(db_obj)
        
        return db_obj

    async def update(
        self, 
        *, 
        feedback_id: UUID, 
        obj_in: FeedbackUpdate
    ) -> Optional[FeedbackEntry]:
        """Update feedback entry with provided fields"""
        result = await self.db.execute(
            select(FeedbackEntry).where(FeedbackEntry.id == feedback_id)
        )
        db_obj = result.scalar_one_or_none()
        
        if db_obj:
            update_data = obj_in.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                if hasattr(db_obj, field):
                    if field == "status" and value:
                        setattr(db_obj, field, value.value)
                    else:
                        setattr(db_obj, field, value)
            
            await self.db.commit()
            await self.db.refresh(db_obj)
        
        return db_obj

    async def delete(self, *, feedback_id: UUID) -> bool:
        """Delete feedback entry"""
        result = await self.db.execute(
            select(FeedbackEntry).where(FeedbackEntry.id == feedback_id)
        )
        db_obj = result.scalar_one_or_none()
        
        if db_obj:
            await self.db.delete(db_obj)
            await self.db.commit()
            return True
        
        return False