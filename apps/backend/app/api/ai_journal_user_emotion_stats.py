from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database.database import get_db
from app.crud.ai_journal_user_emotion_stats import CRUDAIJournalUserEmotionStat
from app.schemas.ai_journal_user_emotion_stats import (
    AIJournalUserEmotionStatCreate,
    AIJournalUserEmotionStatUpdate,
    AIJournalUserEmotionStatResponse
)

router = APIRouter()

@router.post("/migrate", response_model=dict, status_code=status.HTTP_200_OK)
async def migrate_user_emotion_stats_from_emotions(
    *,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Migrate user emotion statistics from ai_journal_emotions table.
    This endpoint calculates session counts per user per emotion and generates 
    AI-powered summaries combining multiple sessions for each emotion.
    
    Features:
    - Counts sessions per user per emotion
    - Generates AI summaries using OpenAI for each user-emotion combination
    - Handles existing records (updates vs creates)
    - Safe to run multiple times
    
    Returns:
        - stats_created: Number of new stat records created
        - stats_updated: Number of existing records updated
        - total_processed: Total number of user-emotion combinations processed
        - user_emotion_combinations: Number of unique user-emotion pairs found
    """
    crud = CRUDAIJournalUserEmotionStat(db)
    try:
        result = await crud.migrate_from_emotions_table()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Migration failed: {str(e)}"
        )

@router.post("/", response_model=AIJournalUserEmotionStatResponse, status_code=status.HTTP_201_CREATED)
async def create_user_emotion_stat(
    *,
    db: AsyncSession = Depends(get_db),
    stat_in: AIJournalUserEmotionStatCreate
) -> AIJournalUserEmotionStatResponse:
    """
    Create a new user emotion stat record (aggregate).
    """
    crud = CRUDAIJournalUserEmotionStat(db)
    try:
        stat = await crud.create(obj_in=stat_in)
        return AIJournalUserEmotionStatResponse.model_validate(stat)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/user/{user_id}", response_model=List[AIJournalUserEmotionStatResponse])
async def get_user_stats(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID
) -> List[AIJournalUserEmotionStatResponse]:
    """
    Get all emotion stats for a specific user.
    """
    crud = CRUDAIJournalUserEmotionStat(db)
    stats = await crud.get_by_user(user_id=user_id)
    return [AIJournalUserEmotionStatResponse.model_validate(stat) for stat in stats]

@router.get("/user/{user_id}/emotion/{emotion}", response_model=AIJournalUserEmotionStatResponse)
async def get_user_stat_by_emotion(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID,
    emotion: str
) -> AIJournalUserEmotionStatResponse:
    """
    Get the stat record for a specific user and emotion.
    """
    crud = CRUDAIJournalUserEmotionStat(db)
    stat = await crud.get_by_composite_key(user_id=user_id, emotion=emotion)
    if not stat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User emotion stat record not found"
        )
    return AIJournalUserEmotionStatResponse.model_validate(stat)

@router.put("/user/{user_id}/emotion/{emotion}", response_model=AIJournalUserEmotionStatResponse)
async def update_user_emotion_stat(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID,
    emotion: str,
    stat_in: AIJournalUserEmotionStatUpdate
) -> AIJournalUserEmotionStatResponse:
    """
    Update a user emotion stat record (e.g., session_count, summary_all).
    """
    crud = CRUDAIJournalUserEmotionStat(db)
    stat = await crud.get_by_composite_key(user_id=user_id, emotion=emotion)
    if not stat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User emotion stat record not found"
        )
    try:
        updated_stat = await crud.update(db_obj=stat, obj_in=stat_in)
        return AIJournalUserEmotionStatResponse.model_validate(updated_stat)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/user/{user_id}/emotion/{emotion}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_emotion_stat(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID,
    emotion: str
) -> None:
    """
    Delete a user emotion stat record by composite key.
    """
    crud = CRUDAIJournalUserEmotionStat(db)
    stat = await crud.get_by_composite_key(user_id=user_id, emotion=emotion)
    if not stat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User emotion stat record not found"
        )
    await crud.remove(user_id=user_id, emotion=emotion) 