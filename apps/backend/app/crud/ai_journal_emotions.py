from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from typing import List, Optional
from uuid import UUID

from app.models.ai_journal_emotions import AIJournalEmotion
from app.schemas.ai_journal_emotions import (
    AIJournalEmotionCreate,
    AIJournalEmotionUpdate
)

class CRUDAIJournalEmotion:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: AIJournalEmotionCreate) -> AIJournalEmotion:
        """
        Create a new emotion record for a session.
        """
        try:
            db_obj = AIJournalEmotion(**obj_in.model_dump())
            self.db.add(db_obj)
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not create emotion record: {e}"
            )

    async def get(self, *, id: UUID) -> Optional[AIJournalEmotion]:
        """
        Get a specific emotion record by its primary key (id).
        """
        result = await self.db.execute(
            select(AIJournalEmotion).filter(AIJournalEmotion.id == id)
        )
        return result.scalars().first()

    async def get_by_session(self, *, session_id: UUID) -> List[AIJournalEmotion]:
        """
        Get all emotions for a specific session.
        """
        result = await self.db.execute(
            select(AIJournalEmotion)
            .filter(AIJournalEmotion.session_id == session_id)
            .order_by(AIJournalEmotion.created_at)
        )
        return list(result.scalars().all())

    async def get_by_user(self, *, user_id: UUID) -> List[AIJournalEmotion]:
        """
        Get all emotions for a specific user (across all sessions).
        """
        result = await self.db.execute(
            select(AIJournalEmotion)
            .filter(AIJournalEmotion.user_id == user_id)
            .order_by(desc(AIJournalEmotion.created_at))
        )
        return list(result.scalars().all())

    async def update(self, *, db_obj: AIJournalEmotion, obj_in: AIJournalEmotionUpdate) -> AIJournalEmotion:
        """
        Update an emotion record (e.g., update the summary).
        """
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
                detail=f"Could not update emotion record: {e}"
            )

    async def remove(self, *, id: UUID) -> Optional[AIJournalEmotion]:
        """
        Delete an emotion record by its primary key (id).
        """
        db_obj = await self.get(id=id)
        if db_obj:
            await self.db.delete(db_obj)
            try:
                await self.db.commit()
                return db_obj
            except IntegrityError as e:
                await self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Cannot delete emotion record: {e}"
                )
        return None

    async def migrate_from_analyses(self) -> dict:
        """
        Migrate emotion data from ai_journal_analyses.emotions JSONB to ai_journal_emotions table.
        """
        from app.models.ai_journal_analyses import AIJournalAnalysis
        from app.models.ai_journal_sessions import AIJournalSession
        import uuid
        
        try:
            # Get all analyses with emotion data
            result = await self.db.execute(
                select(AIJournalAnalysis, AIJournalSession)
                .join(AIJournalSession, AIJournalAnalysis.session_id == AIJournalSession.id)
                .where(AIJournalAnalysis.emotions.isnot(None))
            )
            
            analyses_with_sessions = result.all()
            emotions_created = 0
            emotions_skipped = 0
            
            for analysis, session_obj in analyses_with_sessions:
                if not analysis.emotions:
                    continue
                
                # Parse emotions from JSONB
                emotions_data = analysis.emotions
                
                for emotion_name, emotion_value in emotions_data.items():
                    # Check if already exists
                    existing = await self.db.execute(
                        select(AIJournalEmotion)
                        .where(
                            AIJournalEmotion.session_id == analysis.session_id,
                            AIJournalEmotion.emotion == emotion_name
                        )
                    )
                    
                    if existing.scalar_one_or_none():
                        emotions_skipped += 1
                        continue
                    
                    # Handle both new format {"score": float, "explanation": str} and legacy format (just float)
                    if isinstance(emotion_value, dict):
                        explanation = emotion_value.get('explanation', '')
                    else:
                        explanation = f"Detected with confidence: {emotion_value}"
                    
                    # Create new emotion record
                    new_emotion = AIJournalEmotion(
                        id=uuid.uuid4(),
                        user_id=session_obj.user_id,
                        session_id=analysis.session_id,
                        emotion=emotion_name,
                        summary=explanation,
                        created_at=analysis.created_at
                    )
                    
                    self.db.add(new_emotion)
                    emotions_created += 1
            
            await self.db.commit()
            
            return {
                "status": "success",
                "emotions_created": emotions_created,
                "emotions_skipped": emotions_skipped,
                "total_processed": emotions_created + emotions_skipped
            }
            
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Migration failed: {str(e)}"
            ) 