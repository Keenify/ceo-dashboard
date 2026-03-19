from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from ..database.database import get_db
from ..crud.voice_recordings import VoiceRecordingCRUD
from ..schemas.voice_recordings import (
    VoiceRecordingCreate,
    VoiceRecordingUpdate,
    VoiceRecordingResponse,
    VoiceRecordingList
)

router = APIRouter()

@router.post("/", response_model=VoiceRecordingResponse, status_code=status.HTTP_201_CREATED)
async def create_voice_recording(
    recording: VoiceRecordingCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new voice recording"""
    try:
        db_recording = await VoiceRecordingCRUD.create(db, recording)
        return db_recording
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create voice recording: {str(e)}"
        )

@router.get("/", response_model=List[VoiceRecordingList])
async def get_user_voice_recordings(
    user_id: str = Query(..., description="User ID to get recordings for"),
    skip: int = Query(0, ge=0, description="Number of recordings to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of recordings to return"),
    db: AsyncSession = Depends(get_db)
):
    """Get all voice recordings for a user"""
    try:
        recordings = await VoiceRecordingCRUD.get_user_recordings(db, user_id, skip, limit)
        return recordings
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve voice recordings: {str(e)}"
        )

@router.get("/{recording_id}", response_model=VoiceRecordingResponse)
async def get_voice_recording(
    recording_id: str,
    user_id: str = Query(..., description="User ID for authorization"),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific voice recording"""
    recording = await VoiceRecordingCRUD.get_by_id(db, recording_id, user_id)
    if not recording:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Voice recording not found"
        )
    return recording

@router.put("/{recording_id}", response_model=VoiceRecordingResponse)
async def update_voice_recording(
    recording_id: str,
    recording_update: VoiceRecordingUpdate,
    user_id: str = Query(..., description="User ID for authorization"),
    db: AsyncSession = Depends(get_db)
):
    """Update a voice recording"""
    recording = await VoiceRecordingCRUD.update(db, recording_id, user_id, recording_update)
    if not recording:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Voice recording not found"
        )
    return recording

@router.delete("/{recording_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_voice_recording(
    recording_id: str,
    user_id: str = Query(..., description="User ID for authorization"),
    db: AsyncSession = Depends(get_db)
):
    """Delete a voice recording"""
    success = await VoiceRecordingCRUD.delete(db, recording_id, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Voice recording not found"
        )

@router.get("/count/total")
async def get_voice_recordings_count(
    user_id: str = Query(..., description="User ID to get count for"),
    db: AsyncSession = Depends(get_db)
):
    """Get total count of voice recordings for a user"""
    try:
        count = await VoiceRecordingCRUD.get_count(db, user_id)
        return {"count": count}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get voice recordings count: {str(e)}"
        )