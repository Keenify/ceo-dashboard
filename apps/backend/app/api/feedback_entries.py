from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
import logging

from app.database.database import get_db
from app.crud.feedback_entries import CRUDFeedback
from app.schemas.feedback_entries import (
    FeedbackCreate,
    FeedbackUpdate,
    FeedbackResponse,
    FeedbackListResponse,
    Status,
    FeedbackType
)
from app.service.taiga_sync_service import TaigaSyncService

# Set up logging
logger = logging.getLogger(__name__)

# Import auth dependency (following existing pattern)
# Note: You'll need to adjust this import based on your auth implementation
# from app.auth.dependencies import get_current_user
# from app.models.auth_users import User

router = APIRouter()

# All endpoints now use user_id from frontend (no hardcoded values)
# This ensures consistent user attribution across the entire system

@router.post("/", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
async def create_feedback(
    *,
    db: AsyncSession = Depends(get_db),
    feedback_in: FeedbackCreate
) -> FeedbackResponse:
    """
    Create new feedback entry with immediate Taiga sync.
    
    Submit feedback about bugs, feature requests, improvements, or other issues.
    The feedback will be immediately synced to Taiga project management system.
    If immediate sync fails, the scheduler will retry later.
    """
    try:
        crud_feedback = CRUDFeedback(db=db)
        
        # 1. Save to database (existing logic)
        feedback = await crud_feedback.create(
            obj_in=feedback_in,
            user_id=feedback_in.user_id
        )
        
        # 2. IMMEDIATE sync to Taiga (NEW)
        try:
            sync_service = TaigaSyncService()
            result = await sync_service.sync_single_feedback(feedback, db)
            
            if result:
                logger.info(f"✅ Immediate sync successful for feedback {feedback.id}")
                # Refresh feedback to get updated taiga_story_id
                await db.refresh(feedback)
            else:
                logger.warning(f"⚠️ Immediate sync failed for feedback {feedback.id} - Scheduler will retry")
                
        except Exception as sync_error:
            logger.error(f"❌ Immediate sync error for feedback {feedback.id}: {str(sync_error)} - Scheduler will retry")
        
        return FeedbackResponse.model_validate(feedback)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create feedback: {str(e)}"
        )

@router.get("/", response_model=FeedbackListResponse)
async def get_user_feedback(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: str = Query(..., description="User ID from frontend authentication"),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(10, ge=1, le=100, description="Maximum number of items to return"),
    status_filter: Optional[Status] = Query(None, description="Filter by feedback status"),
    feedback_type_filter: Optional[FeedbackType] = Query(None, description="Filter by feedback type")
) -> FeedbackListResponse:
    """
    Get user's feedback entries with pagination and filtering.
    
    Returns a paginated list of feedback entries submitted by the specified user.
    The user_id must match the authenticated user from the frontend.
    Can be filtered by status and feedback type.
    """
    try:
        crud_feedback = CRUDFeedback(db=db)
        
        # Validate user_id format
        try:
            user_uuid = UUID(user_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user_id format. Must be a valid UUID."
            )
        
        # Get feedback entries
        feedback_entries = await crud_feedback.get_by_user(
            user_id=user_uuid,
            skip=skip,
            limit=limit,
            status_filter=status_filter,
            feedback_type_filter=feedback_type_filter.value if feedback_type_filter else None
        )
        
        # Get total count for pagination
        total_count = await crud_feedback.get_user_feedback_count(
            user_id=user_uuid,
            status_filter=status_filter,
            feedback_type_filter=feedback_type_filter.value if feedback_type_filter else None
        )
        
        # Convert to response models
        feedback_responses = [
            FeedbackResponse.model_validate(feedback) 
            for feedback in feedback_entries
        ]
        
        return FeedbackListResponse(
            items=feedback_responses,
            total=total_count,
            skip=skip,
            limit=limit
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve feedback: {str(e)}"
        )

@router.get("/{feedback_id}", response_model=FeedbackResponse)
async def get_feedback_by_id(
    *,
    db: AsyncSession = Depends(get_db),
    feedback_id: UUID,
    user_id: str = Query(..., description="User ID from frontend authentication")
) -> FeedbackResponse:
    """
    Get specific feedback entry by ID.
    
    Returns detailed information about a specific feedback entry.
    The user_id must match the authenticated user from the frontend.
    Only the owner of the feedback can access it.
    """
    try:
        # Validate user_id format
        try:
            user_uuid = UUID(user_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user_id format. Must be a valid UUID."
            )
        
        crud_feedback = CRUDFeedback(db=db)
        
        # Get feedback by ID
        feedback = await crud_feedback.get_by_id(feedback_id=feedback_id)
        
        if not feedback:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Feedback not found"
            )
        
        # Check if user owns this feedback
        if feedback.user_id != user_uuid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this feedback"
            )
        
        return FeedbackResponse.model_validate(feedback)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve feedback: {str(e)}"
        )

@router.put("/{feedback_id}", response_model=FeedbackResponse)
async def update_feedback(
    *,
    db: AsyncSession = Depends(get_db),
    feedback_id: UUID,
    feedback_update: FeedbackUpdate,
    user_id: str = Query(..., description="User ID from frontend authentication")
) -> FeedbackResponse:
    """
    Update feedback entry.
    
    This endpoint is primarily for internal use (system updates from Taiga sync).
    The user_id must match the authenticated user from the frontend.
    Users typically cannot modify their submitted feedback.
    """
    try:
        # Validate user_id format
        try:
            user_uuid = UUID(user_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user_id format. Must be a valid UUID."
            )
        
        crud_feedback = CRUDFeedback(db=db)
        
        # Get existing feedback
        existing_feedback = await crud_feedback.get_by_id(feedback_id=feedback_id)
        
        if not existing_feedback:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Feedback not found"
            )
        
        # Check if user owns this feedback
        if existing_feedback.user_id != user_uuid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this feedback"
            )
        
        # Update feedback
        updated_feedback = await crud_feedback.update(
            feedback_id=feedback_id,
            obj_in=feedback_update
        )
        
        if not updated_feedback:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update feedback"
            )
        
        return FeedbackResponse.model_validate(updated_feedback)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update feedback: {str(e)}"
        )

@router.delete("/{feedback_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_feedback(
    *,
    db: AsyncSession = Depends(get_db),
    feedback_id: UUID,
    user_id: str = Query(..., description="User ID from frontend authentication")
):
    """
    Delete feedback entry.
    
    Permanently delete a feedback entry. This action cannot be undone.
    The user_id must match the authenticated user from the frontend.
    Only the owner of the feedback can delete it.
    """
    try:
        # Validate user_id format
        try:
            user_uuid = UUID(user_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user_id format. Must be a valid UUID."
            )
        
        crud_feedback = CRUDFeedback(db=db)
        
        # Get existing feedback to check ownership
        existing_feedback = await crud_feedback.get_by_id(feedback_id=feedback_id)
        
        if not existing_feedback:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Feedback not found"
            )
        
        # Check if user owns this feedback
        if existing_feedback.user_id != user_uuid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this feedback"
            )
        
        # Delete feedback
        deleted = await crud_feedback.delete(feedback_id=feedback_id)
        
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete feedback"
            )
        
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete feedback: {str(e)}"
        )