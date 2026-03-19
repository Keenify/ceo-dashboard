from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database.database import get_db
from app.crud.ai_journal_emotions import CRUDAIJournalEmotion
from app.schemas.ai_journal_emotions import (
    AIJournalEmotionCreate,
    AIJournalEmotionUpdate,
    AIJournalEmotionResponse
)

router = APIRouter()

@router.post("/", response_model=AIJournalEmotionResponse, status_code=status.HTTP_201_CREATED)
async def create_emotion(
    *,
    db: AsyncSession = Depends(get_db),
    emotion_in: AIJournalEmotionCreate
) -> AIJournalEmotionResponse:
    """
    Create a new emotion record for a session.
    """
    crud = CRUDAIJournalEmotion(db)
    try:
        emotion = await crud.create(obj_in=emotion_in)
        return AIJournalEmotionResponse.model_validate(emotion)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/{emotion_id}", response_model=AIJournalEmotionResponse)
async def get_emotion(
    *,
    db: AsyncSession = Depends(get_db),
    emotion_id: UUID
) -> AIJournalEmotionResponse:
    """
    Get a specific emotion record by its ID.
    """
    crud = CRUDAIJournalEmotion(db)
    emotion = await crud.get(id=emotion_id)
    if not emotion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emotion record not found"
        )
    return AIJournalEmotionResponse.model_validate(emotion)

@router.get("/session/{session_id}", response_model=List[AIJournalEmotionResponse])
async def get_session_emotions(
    *,
    db: AsyncSession = Depends(get_db),
    session_id: UUID
) -> List[AIJournalEmotionResponse]:
    """
    Get all emotions for a specific session.
    """
    crud = CRUDAIJournalEmotion(db)
    emotions = await crud.get_by_session(session_id=session_id)
    return [AIJournalEmotionResponse.model_validate(emotion) for emotion in emotions]

@router.get("/user/{user_id}", response_model=List[AIJournalEmotionResponse])
async def get_user_emotions(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID
) -> List[AIJournalEmotionResponse]:
    """
    Get all emotions for a specific user (across all sessions).
    """
    crud = CRUDAIJournalEmotion(db)
    emotions = await crud.get_by_user(user_id=user_id)
    return [AIJournalEmotionResponse.model_validate(emotion) for emotion in emotions]

@router.put("/{emotion_id}", response_model=AIJournalEmotionResponse)
async def update_emotion(
    *,
    db: AsyncSession = Depends(get_db),
    emotion_id: UUID,
    emotion_in: AIJournalEmotionUpdate
) -> AIJournalEmotionResponse:
    """
    Update an emotion record (e.g., update the summary).
    """
    crud = CRUDAIJournalEmotion(db)
    emotion = await crud.get(id=emotion_id)
    if not emotion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emotion record not found"
        )
    try:
        updated_emotion = await crud.update(db_obj=emotion, obj_in=emotion_in)
        return AIJournalEmotionResponse.model_validate(updated_emotion)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/{emotion_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_emotion(
    *,
    db: AsyncSession = Depends(get_db),
    emotion_id: UUID
) -> None:
    """
    Delete an emotion record by its ID.
    """
    crud = CRUDAIJournalEmotion(db)
    emotion = await crud.get(id=emotion_id)
    if not emotion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emotion record not found"
        )
    await crud.remove(id=emotion_id)

@router.post("/migrate-from-analyses", response_model=dict, status_code=status.HTTP_200_OK)
async def migrate_emotions_from_analyses(
    *,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Migrate emotion data from ai_journal_analyses.emotions JSONB to ai_journal_emotions table.
    This endpoint safely handles existing data and can be run multiple times.
    
    Returns:
        - emotions_created: Number of new emotion records created
        - emotions_skipped: Number of existing records skipped
        - total_processed: Total number of emotion entries processed
    """
    crud = CRUDAIJournalEmotion(db)
    try:
        result = await crud.migrate_from_analyses()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Migration failed: {str(e)}"
        ) 