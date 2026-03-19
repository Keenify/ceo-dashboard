from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from typing import List, Optional
from uuid import UUID

from app.models.ai_journal_user_emotion_stats import AIJournalUserEmotionStat
from app.schemas.ai_journal_user_emotion_stats import (
    AIJournalUserEmotionStatCreate,
    AIJournalUserEmotionStatUpdate
)

class CRUDAIJournalUserEmotionStat:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: AIJournalUserEmotionStatCreate) -> AIJournalUserEmotionStat:
        """
        Create a new user emotion stat record (aggregate).
        """
        try:
            db_obj = AIJournalUserEmotionStat(**obj_in.model_dump())
            self.db.add(db_obj)
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not create user emotion stat: {e}"
            )

    async def get_by_composite_key(self, *, user_id: UUID, emotion: str) -> Optional[AIJournalUserEmotionStat]:
        """
        Get a specific user emotion stat record by composite primary key (user_id, emotion).
        """
        result = await self.db.execute(
            select(AIJournalUserEmotionStat).filter(
                and_(
                    AIJournalUserEmotionStat.user_id == user_id,
                    AIJournalUserEmotionStat.emotion == emotion
                )
            )
        )
        return result.scalars().first()

    async def get_by_user(self, *, user_id: UUID) -> List[AIJournalUserEmotionStat]:
        """
        Get all emotion stats for a specific user (all emotions).
        """
        result = await self.db.execute(
            select(AIJournalUserEmotionStat)
            .filter(AIJournalUserEmotionStat.user_id == user_id)
            .order_by(desc(AIJournalUserEmotionStat.session_count))
        )
        return list(result.scalars().all())

    async def get_by_user_and_emotion(self, *, user_id: UUID, emotion: str) -> Optional[AIJournalUserEmotionStat]:
        """
        Get the stat record for a specific user and emotion.
        """
        result = await self.db.execute(
            select(AIJournalUserEmotionStat)
            .filter(
                and_(
                    AIJournalUserEmotionStat.user_id == user_id,
                    AIJournalUserEmotionStat.emotion == emotion
                )
            )
        )
        return result.scalars().first()

    async def update(self, *, db_obj: AIJournalUserEmotionStat, obj_in: AIJournalUserEmotionStatUpdate) -> AIJournalUserEmotionStat:
        """
        Update a user emotion stat record (e.g., session_count, summary_all).
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
                detail=f"Could not update user emotion stat: {e}"
            )

    async def remove(self, *, user_id: UUID, emotion: str) -> Optional[AIJournalUserEmotionStat]:
        """
        Delete a user emotion stat record by composite key (user_id, emotion).
        """
        db_obj = await self.get_by_composite_key(user_id=user_id, emotion=emotion)
        if db_obj:
            await self.db.delete(db_obj)
            try:
                await self.db.commit()
                return db_obj
            except IntegrityError as e:
                await self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Cannot delete user emotion stat: {e}"
                )
        return None

    async def _generate_emotion_summary(self, emotion: str, emotion_summaries: List[str]) -> str:
        """
        Generate a combined summary for a user's emotion across multiple sessions using OpenAI.
        """
        try:
            from openai import AsyncOpenAI
            import os
            import json
            
            # Initialize OpenAI client
            client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            
            # Create prompt for summary generation
            summaries_text = "\n".join([f"- {summary}" for summary in emotion_summaries])
            
            analysis_prompt = f"""You are analyzing a user's emotion patterns across multiple journaling sessions. 

Emotion: {emotion}
Individual session summaries:
{summaries_text}

Please provide a comprehensive summary that:
1. Identifies common themes and patterns in this emotion
2. Notes any progression or changes over time
3. Highlights key insights about the user's experience with {emotion}
4. Keeps it concise but meaningful (2-3 sentences max)

Respond with just the summary text, no additional formatting."""

            response = await client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": analysis_prompt}],
                temperature=0.3,
                max_tokens=200
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            # Fallback to simple concatenation if AI generation fails
            return f"User experienced {emotion} across {len(emotion_summaries)} sessions. Common themes include patterns of emotional expression and personal reflection."

    async def migrate_from_emotions_table(self) -> dict:
        """
        Populate ai_journal_user_emotion_stats from ai_journal_emotions table.
        Calculates session counts and generates AI summaries for each user-emotion combination.
        """
        from app.models.ai_journal_emotions import AIJournalEmotion
        from sqlalchemy import func, text
        from datetime import datetime
        
        try:
            # Get aggregated data: user_id, emotion, session_count, summaries
            result = await self.db.execute(
                select(
                    AIJournalEmotion.user_id,
                    AIJournalEmotion.emotion,
                    func.count(AIJournalEmotion.session_id).label('session_count'),
                    func.array_agg(AIJournalEmotion.summary).label('summaries')
                )
                .group_by(AIJournalEmotion.user_id, AIJournalEmotion.emotion)
                .order_by(AIJournalEmotion.user_id, AIJournalEmotion.emotion)
            )
            
            user_emotion_data = result.all()
            stats_created = 0
            stats_updated = 0
            stats_skipped = 0
            
            for row in user_emotion_data:
                user_id, emotion, session_count, summaries = row
                
                # Filter out None summaries
                valid_summaries = [s for s in summaries if s and s.strip()]
                
                # Check if stat record already exists
                existing_stat = await self.get_by_composite_key(
                    user_id=user_id, 
                    emotion=emotion
                )
                
                # Generate combined summary using AI
                if valid_summaries:
                    combined_summary = await self._generate_emotion_summary(emotion, valid_summaries)
                else:
                    combined_summary = f"User experienced {emotion} across {session_count} sessions."
                
                if existing_stat:
                    # Update existing record
                    existing_stat.session_count = session_count
                    existing_stat.summary_all = combined_summary
                    self.db.add(existing_stat)
                    stats_updated += 1
                    print(f"  Updated: User {user_id}, {emotion} - {session_count} sessions")
                else:
                    # Create new stat record
                    new_stat = AIJournalUserEmotionStat(
                        user_id=user_id,
                        emotion=emotion,
                        session_count=session_count,
                        summary_all=combined_summary,
                        created_at=datetime.utcnow()
                    )
                    
                    self.db.add(new_stat)
                    stats_created += 1
                    print(f"  Created: User {user_id}, {emotion} - {session_count} sessions")
            
            await self.db.commit()
            
            return {
                "status": "success",
                "stats_created": stats_created,
                "stats_updated": stats_updated,
                "stats_skipped": stats_skipped,
                "total_processed": stats_created + stats_updated + stats_skipped,
                "user_emotion_combinations": len(user_emotion_data)
            }
            
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"User emotion stats migration failed: {str(e)}"
            ) 