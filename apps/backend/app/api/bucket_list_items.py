from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session
import logging

from app.database.database import get_db
from app.crud.bucket_list_items import crud_bucket_list_items
from app.schemas.bucket_list_items import (
    BucketListItems,
    BucketListItemsCreate,
    BucketListItemsUpdate,
    BucketReorderRequest,
)

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/", response_model=BucketListItems, status_code=status.HTTP_201_CREATED)
async def create_bucket_list_item(
    request: Request,
    bucket_list_item_in: BucketListItemsCreate,
    user_id: UUID,
    db: Session = Depends(get_db)
) -> BucketListItems:
    """Create new bucket list item."""
    try:
        # Log the incoming request data
        logger.info(f"Creating bucket list item for user: {user_id}")
        logger.debug(f"Request data: {bucket_list_item_in.model_dump()}")
        
        crud_bucket_list_items.db = db
        
        # Check if bucket list item already exists for this category
        existing_item = await crud_bucket_list_items.get_bucket_list_item_by_category(
            user_id=user_id, 
            category=bucket_list_item_in.category
        )
        
        if existing_item:
            logger.warning(f"Bucket list item already exists for category: {bucket_list_item_in.category}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Bucket list item already exists for category: {bucket_list_item_in.category}"
            )
        
        # Create new item
        result = await crud_bucket_list_items.create_bucket_list_item(
            bucket_list_item=bucket_list_item_in, 
            user_id=user_id
        )
        
        logger.info(f"Successfully created bucket list item with ID: {result.id}")
        return result
        
    except HTTPException as he:
        # Re-raise HTTP exceptions as is
        raise he
    except Exception as e:
        logger.error(f"Error creating bucket list item: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating bucket list item: {str(e)}"
        )

@router.get("/{bucket_list_item_id}", response_model=BucketListItems)
async def read_bucket_list_item(
    bucket_list_item_id: UUID,
    user_id: UUID,
    db: Session = Depends(get_db)
) -> BucketListItems:
    """Get bucket list item by ID."""
    crud_bucket_list_items.db = db
    bucket_list_item = await crud_bucket_list_items.get_bucket_list_item(
        bucket_list_item_id=bucket_list_item_id
    )
    if not bucket_list_item or bucket_list_item.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bucket list item not found"
        )
    return bucket_list_item

@router.get("/by-category/{category}", response_model=BucketListItems)
async def read_bucket_list_item_by_category(
    category: str,
    user_id: UUID,
    db: Session = Depends(get_db)
) -> BucketListItems:
    """Get bucket list item by category."""
    try:
        logger.info(f"Fetching bucket list item for user: {user_id}, category: {category}")
        
        crud_bucket_list_items.db = db
        bucket_list_item = await crud_bucket_list_items.get_bucket_list_item_by_category(
            user_id=user_id, category=category
        )
        
        if not bucket_list_item:
            logger.warning(f"Bucket list item not found for category: {category}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Bucket list item not found for category: {category}"
            )
            
        return bucket_list_item
    except HTTPException as e:
        # Re-raise HTTP exceptions as is without wrapping
        raise e
    except Exception as e:
        logger.error(f"Error fetching bucket list item: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error while fetching bucket list item"
        )

@router.get("/", response_model=List[BucketListItems])
async def list_bucket_list_items(
    user_id: UUID,
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
) -> List[BucketListItems]:
    """Get list of bucket list items."""
    crud_bucket_list_items.db = db
    return await crud_bucket_list_items.get_bucket_list_items(
        user_id=user_id, skip=skip, limit=limit
    )

@router.put("/drag-drop-reorder", response_model=List[BucketListItems])
async def reorder_bucket_list_items(
    reorder_request: BucketReorderRequest,
    user_id: UUID,
    db: Session = Depends(get_db)
) -> List[BucketListItems]:
    """
    Reorder bucket list items by updating their sort_order values.
    This endpoint is used for drag and drop functionality.
    """
    try:
        logger.info(f"Reordering bucket list items for user: {user_id}")
        logger.debug(f"Reorder request: {reorder_request.model_dump()}")
        
        crud_bucket_list_items.db = db
        
        # Convert Pydantic models to dict format expected by CRUD
        bucket_positions = [
            {
                "bucket_id": pos.bucket_id,
                "sort_order": pos.sort_order
            }
            for pos in reorder_request.bucket_positions
        ]
        
        # Perform the reorder operation
        updated_buckets = await crud_bucket_list_items.reorder_bucket_list_items(
            user_id=user_id,
            bucket_positions=bucket_positions
        )
        
        if not updated_buckets:
            logger.warning("No buckets were updated during reorder operation")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid buckets found to reorder or no changes made"
            )
        
        logger.info(f"Successfully reordered {len(updated_buckets)} bucket list items")
        return updated_buckets
        
    except HTTPException as he:
        # Re-raise HTTP exceptions as is
        raise he
    except Exception as e:
        logger.error(f"Error reordering bucket list items: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reordering bucket list items: {str(e)}"
        )

@router.put("/{bucket_list_item_id}", response_model=BucketListItems)
async def update_bucket_list_item(
    bucket_list_item_id: UUID,
    bucket_list_item_in: BucketListItemsUpdate,
    user_id: UUID,
    db: Session = Depends(get_db)
) -> BucketListItems:
    """Update bucket list item."""
    crud_bucket_list_items.db = db
    bucket_list_item = await crud_bucket_list_items.get_bucket_list_item(
        bucket_list_item_id=bucket_list_item_id
    )
    if not bucket_list_item or bucket_list_item.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bucket list item not found"
        )
    return await crud_bucket_list_items.update_bucket_list_item(
        bucket_list_item_id=bucket_list_item_id,
        bucket_list_item_update=bucket_list_item_in
    )

@router.delete("/{bucket_list_item_id}", response_model=BucketListItems)
async def delete_bucket_list_item(
    bucket_list_item_id: UUID,
    user_id: UUID,
    db: Session = Depends(get_db)
) -> BucketListItems:
    """Delete bucket list item."""
    crud_bucket_list_items.db = db
    bucket_list_item = await crud_bucket_list_items.get_bucket_list_item(
        bucket_list_item_id=bucket_list_item_id
    )
    if not bucket_list_item or bucket_list_item.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bucket list item not found"
        )
    return await crud_bucket_list_items.delete_bucket_list_item(
        bucket_list_item_id=bucket_list_item_id
    )