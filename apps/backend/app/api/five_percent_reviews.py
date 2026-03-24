from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from pydantic import ValidationError

from app.database.database import get_db
from app.schemas.five_percent_reviews import (
    FivePercentReviewCreate, FivePercentReviewUpdate, FivePercentReviewResponse
)
from app.crud.five_percent_reviews import CRUDFivePercentReview

router = APIRouter()

@router.post("/", response_model=FivePercentReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_five_percent_review(
    *,
    db: AsyncSession = Depends(get_db),
    five_percent_review_in: FivePercentReviewCreate
) -> FivePercentReviewResponse:
    """Create a new five percent review."""
    crud = CRUDFivePercentReview(db)
    try:
        five_percent_review = await crud.create(obj_in=five_percent_review_in)
        return FivePercentReviewResponse.model_validate(five_percent_review)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"validation_error": e.errors()}
        )
    except IntegrityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Database integrity error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        )

@router.get("/{five_percent_review_id}", response_model=FivePercentReviewResponse)
async def get_five_percent_review(
    *,
    db: AsyncSession = Depends(get_db),
    five_percent_review_id: UUID,
    user_id: UUID
) -> FivePercentReviewResponse:
    """Get a five percent review by ID."""
    crud = CRUDFivePercentReview(db)
    five_percent_review = await crud.get(id=five_percent_review_id, user_id=user_id)
    if not five_percent_review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="FivePercentReview not found"
        )
    return FivePercentReviewResponse.model_validate(five_percent_review)

@router.get("/", response_model=List[FivePercentReviewResponse])
async def get_five_percent_reviews(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID,
    skip: int = 0,
    limit: int = 100
) -> List[FivePercentReviewResponse]:
    """Get all five percent reviews for a user."""
    crud = CRUDFivePercentReview(db)
    reviews = await crud.get_multi_by_user(user_id=user_id, skip=skip, limit=limit)
    return [FivePercentReviewResponse.model_validate(r) for r in reviews]

@router.put("/{five_percent_review_id}", response_model=FivePercentReviewResponse)
async def update_five_percent_review(
    *,
    db: AsyncSession = Depends(get_db),
    five_percent_review_id: UUID,
    user_id: UUID,
    five_percent_review_in: FivePercentReviewUpdate
) -> FivePercentReviewResponse:
    """Update a five percent review."""
    crud = CRUDFivePercentReview(db)
    five_percent_review = await crud.get(id=five_percent_review_id, user_id=user_id)
    if not five_percent_review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="FivePercentReview not found"
        )
    try:
        updated = await crud.update(db_obj=five_percent_review, obj_in=five_percent_review_in)
        return FivePercentReviewResponse.model_validate(updated)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/{five_percent_review_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_five_percent_review(
    *,
    db: AsyncSession = Depends(get_db),
    five_percent_review_id: UUID,
    user_id: UUID
) -> None:
    """Delete a five percent review."""
    crud = CRUDFivePercentReview(db)
    five_percent_review = await crud.get(id=five_percent_review_id, user_id=user_id)
    if not five_percent_review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="FivePercentReview not found"
        )
    await crud.remove(id=five_percent_review_id, user_id=user_id) 