from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List

from app.database.database import get_db
from app.crud.user_modules import CRUDUserModules
from app.schemas.user_modules import UserModulesCreate, UserModulesUpdate, UserModulesResponse

router = APIRouter()


@router.post("/", response_model=UserModulesResponse, status_code=status.HTTP_201_CREATED)
async def create_user_module(
    user_module: UserModulesCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new user module subscription.
    """
    crud = CRUDUserModules(db)
    return await crud.create(obj_in=user_module)


@router.get("/{user_module_id}", response_model=UserModulesResponse)
async def get_user_module(
    user_module_id: UUID,
    user_id: UUID = Query(..., description="User ID for authorization"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific user module subscription by ID.
    """
    crud = CRUDUserModules(db)
    user_module = await crud.get(id=user_module_id, user_id=user_id)
    if user_module is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User module not found"
        )
    return user_module


@router.get("/user/{user_id}", response_model=List[UserModulesResponse])
async def get_user_modules_by_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all module subscriptions for a specific user.
    """
    crud = CRUDUserModules(db)
    user_modules = await crud.get_by_user(user_id=user_id)
    return user_modules


@router.get("/user/{user_id}/active", response_model=List[UserModulesResponse])
async def get_active_user_modules(
    user_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all active module subscriptions for a specific user.
    """
    crud = CRUDUserModules(db)
    user_modules = await crud.get_active_subscriptions(user_id=user_id)
    return user_modules


@router.get("/stripe/{stripe_customer_id}", response_model=List[UserModulesResponse])
async def get_user_modules_by_stripe_customer(
    stripe_customer_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all module subscriptions for a specific Stripe customer.
    """
    crud = CRUDUserModules(db)
    user_modules = await crud.get_by_stripe_customer(stripe_customer_id=stripe_customer_id)
    return user_modules


@router.put("/{user_module_id}", response_model=UserModulesResponse)
async def update_user_module(
    user_module_id: UUID,
    user_module: UserModulesUpdate,
    user_id: UUID = Query(..., description="User ID for authorization"),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a user module subscription.
    """
    crud = CRUDUserModules(db)
    db_user_module = await crud.get(id=user_module_id, user_id=user_id)
    if db_user_module is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User module not found"
        )
    return await crud.update(db_obj=db_user_module, obj_in=user_module)


@router.patch("/{user_module_id}/status", response_model=UserModulesResponse)
async def update_user_module_status(
    user_module_id: UUID,
    subscription_status: str = Query(..., description="New subscription status: 'active', 'cancelled', or 'paused'"),
    user_id: UUID = Query(..., description="User ID for authorization"),
    db: AsyncSession = Depends(get_db)
):
    """
    Update the subscription status of a user module.
    """
    if subscription_status not in ['active', 'cancelled', 'paused']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be one of: 'active', 'cancelled', 'paused'"
        )
    
    crud = CRUDUserModules(db)
    updated_user_module = await crud.update_subscription_status(
        id=user_module_id,
        user_id=user_id,
        status=subscription_status
    )
    if updated_user_module is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User module not found"
        )
    return updated_user_module


@router.delete("/{user_module_id}", response_model=UserModulesResponse)
async def delete_user_module(
    user_module_id: UUID,
    user_id: UUID = Query(..., description="User ID for authorization"),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a user module subscription.
    """
    crud = CRUDUserModules(db)
    deleted_user_module = await crud.delete(id=user_module_id, user_id=user_id)
    if deleted_user_module is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User module not found"
        )
    return deleted_user_module
