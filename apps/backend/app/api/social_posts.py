from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database.database import get_db
from app.crud.social_posts import CRUDSocialPost
from app.schemas.social_posts import (
    SocialPostCreatePayload,
    SocialPostUpdate,
    SocialPostResponse
)

router = APIRouter()

@router.post("/", response_model=SocialPostResponse, status_code=status.HTTP_201_CREATED)
async def create_social_post(
    *,
    db: AsyncSession = Depends(get_db),
    post_in: SocialPostCreatePayload
) -> SocialPostResponse:
    """Create a new social media post."""
    from app.schemas.social_posts import SocialPostCreate
    
    crud = CRUDSocialPost(db)
    try:
        # Convert payload to create schema
        create_data = SocialPostCreate(
            user_id=post_in.user_id,
            instruction=post_in.instruction,
            scheduled_at=post_in.scheduled_at,
            platforms=post_in.platforms
        )
        post = await crud.create(obj_in=create_data)
        return SocialPostResponse.model_validate(post)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/{post_id}", response_model=SocialPostResponse)
async def get_social_post(
    *,
    db: AsyncSession = Depends(get_db),
    post_id: UUID,
    user_id: UUID = Query(..., description="User ID for authorization")
) -> SocialPostResponse:
    """Get a specific social media post."""
    crud = CRUDSocialPost(db)
    post = await crud.get(id=post_id, user_id=user_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Social media post not found"
        )
    return SocialPostResponse.model_validate(post)

@router.post("/list", response_model=List[SocialPostResponse])
async def get_user_social_posts(
    *,
    db: AsyncSession = Depends(get_db),
    request: dict,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000)
) -> List[SocialPostResponse]:
    """Get all social media posts for a user."""
    user_id = UUID(request.get("user_id"))
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id is required"
        )
    
    crud = CRUDSocialPost(db)
    posts = await crud.get_multi_by_user(user_id=user_id, skip=skip, limit=limit)
    return [SocialPostResponse.model_validate(post) for post in posts]

@router.put("/{post_id}", response_model=SocialPostResponse)
async def update_social_post(
    *,
    db: AsyncSession = Depends(get_db),
    post_id: UUID,
    user_id: UUID = Query(..., description="User ID for authorization"),
    post_in: SocialPostUpdate
) -> SocialPostResponse:
    """Update a social media post."""
    crud = CRUDSocialPost(db)
    post = await crud.get(id=post_id, user_id=user_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Social media post not found"
        )
    try:
        updated_post = await crud.update(db_obj=post, obj_in=post_in)
        return SocialPostResponse.model_validate(updated_post)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_social_post(
    *,
    db: AsyncSession = Depends(get_db),
    post_id: UUID,
    user_id: UUID = Query(..., description="User ID for authorization")
) -> None:
    """Delete a social media post."""
    crud = CRUDSocialPost(db)
    post = await crud.get(id=post_id, user_id=user_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Social media post not found"
        )
    
    try:
        await crud.remove(id=post_id, user_id=user_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete social media post: {str(e)}"
        )

@router.patch("/{post_id}/status", response_model=SocialPostResponse)
async def update_post_status(
    *,
    db: AsyncSession = Depends(get_db),
    post_id: UUID,
    user_id: UUID = Query(..., description="User ID for authorization"),
    status_update: dict
) -> SocialPostResponse:
    """Update the status of a social media post."""
    new_status = status_update.get("status")
    if new_status not in ["pending", "processing", "complete"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be one of: pending, processing, complete"
        )
    
    crud = CRUDSocialPost(db)
    post = await crud.get(id=post_id, user_id=user_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Social media post not found"
        )
    
    try:
        updated_post = await crud.update_status(id=post_id, user_id=user_id, status=new_status)
        if not updated_post:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update post status"
            )
        return SocialPostResponse.model_validate(updated_post)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )