from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List, Optional
from ..models.voice_recordings import VoiceRecording
from ..schemas.voice_recordings import VoiceRecordingCreate, VoiceRecordingUpdate
import uuid

class VoiceRecordingCRUD:
    """CRUD operations for voice recordings"""
    
    @staticmethod
    async def create(db: AsyncSession, recording_data: VoiceRecordingCreate) -> VoiceRecording:
        """Create a new voice recording"""
        db_recording = VoiceRecording(
            user_id=uuid.UUID(recording_data.user_id),
            title=recording_data.title,
            file_url=recording_data.file_url,
            duration=recording_data.duration,
            transcript=recording_data.transcript,
            summary=recording_data.summary
        )
        db.add(db_recording)
        await db.commit()
        await db.refresh(db_recording)
        return db_recording
    
    @staticmethod
    async def get_by_id(db: AsyncSession, recording_id: str, user_id: str) -> Optional[VoiceRecording]:
        """Get a voice recording by ID for a specific user"""
        result = await db.execute(
            select(VoiceRecording)
            .where(
                VoiceRecording.id == uuid.UUID(recording_id),
                VoiceRecording.user_id == uuid.UUID(user_id)
            )
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def get_user_recordings(db: AsyncSession, user_id: str, skip: int = 0, limit: int = 100) -> List[VoiceRecording]:
        """Get all voice recordings for a user with pagination"""
        result = await db.execute(
            select(VoiceRecording)
            .where(VoiceRecording.user_id == uuid.UUID(user_id))
            .order_by(VoiceRecording.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()
    
    @staticmethod
    async def update(db: AsyncSession, recording_id: str, user_id: str, recording_data: VoiceRecordingUpdate) -> Optional[VoiceRecording]:
        """Update a voice recording"""
        # First get the recording to ensure it exists and belongs to the user
        recording = await VoiceRecordingCRUD.get_by_id(db, recording_id, user_id)
        if not recording:
            return None
        
        # Update only the fields that were provided
        update_data = recording_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(recording, field, value)
        
        await db.commit()
        await db.refresh(recording)
        return recording
    
    @staticmethod
    async def delete(db: AsyncSession, recording_id: str, user_id: str) -> bool:
        """Delete a voice recording"""
        result = await db.execute(
            delete(VoiceRecording)
            .where(
                VoiceRecording.id == uuid.UUID(recording_id),
                VoiceRecording.user_id == uuid.UUID(user_id)
            )
        )
        await db.commit()
        return result.rowcount > 0
    
    @staticmethod
    async def get_count(db: AsyncSession, user_id: str) -> int:
        """Get total count of recordings for a user"""
        result = await db.execute(
            select(VoiceRecording)
            .where(VoiceRecording.user_id == uuid.UUID(user_id))
        )
        recordings = result.scalars().all()
        return len(recordings)