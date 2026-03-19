from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database.database import get_db
from app.schemas.ikigai import (
    IkigaiCreate, IkigaiUpdate, IkigaiResponse
)
from app.crud.ikigai import CRUDIkigai

router = APIRouter()

# --- Ikigai Endpoints ---

@router.post("/", response_model=IkigaiResponse, status_code=status.HTTP_201_CREATED)
async def create_ikigai(
    *,
    db: AsyncSession = Depends(get_db),
    ikigai_in: IkigaiCreate
) -> IkigaiResponse:
    """Create a new ikigai record for a user."""
    crud = CRUDIkigai(db)
    try:
        ikigai = await crud.create(obj_in=ikigai_in)
        return IkigaiResponse.model_validate(ikigai)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{ikigai_id}", response_model=IkigaiResponse)
async def get_ikigai(
    *,
    db: AsyncSession = Depends(get_db),
    ikigai_id: UUID,
    user_id: UUID
) -> IkigaiResponse:
    """Get an ikigai record by ID."""
    crud = CRUDIkigai(db)
    ikigai = await crud.get(id=ikigai_id, user_id=user_id)
    if not ikigai:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ikigai not found"
        )
    return IkigaiResponse.model_validate(ikigai)


@router.get("/user/{user_id}", response_model=IkigaiResponse)
async def get_ikigai_by_user(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID
) -> IkigaiResponse:
    """Get the ikigai record for a specific user."""
    crud = CRUDIkigai(db)
    ikigai = await crud.get_by_user(user_id=user_id)
    if not ikigai:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ikigai not found for this user"
        )
    return IkigaiResponse.model_validate(ikigai)


@router.put("/{ikigai_id}", response_model=IkigaiResponse)
async def update_ikigai(
    *,
    db: AsyncSession = Depends(get_db),
    ikigai_id: UUID,
    user_id: UUID,
    ikigai_in: IkigaiUpdate
) -> IkigaiResponse:
    """Update an existing ikigai record."""
    crud = CRUDIkigai(db)
    
    # First, get the existing record
    ikigai = await crud.get(id=ikigai_id, user_id=user_id)
    if not ikigai:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ikigai not found"
        )
    
    try:
        updated_ikigai = await crud.update(db_obj=ikigai, obj_in=ikigai_in)
        return IkigaiResponse.model_validate(updated_ikigai)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{ikigai_id}", response_model=IkigaiResponse)
async def delete_ikigai(
    *,
    db: AsyncSession = Depends(get_db),
    ikigai_id: UUID,
    user_id: UUID
) -> IkigaiResponse:
    """Delete an ikigai record."""
    crud = CRUDIkigai(db)
    ikigai = await crud.delete(id=ikigai_id, user_id=user_id)
    if not ikigai:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ikigai not found"
        )
    return IkigaiResponse.model_validate(ikigai)


@router.post("/upsert/{user_id}", response_model=IkigaiResponse)
async def upsert_ikigai(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID,
    ikigai_data: Dict[str, Any]
) -> IkigaiResponse:
    """Create or update an ikigai record for a user. Useful for frontend convenience."""
    crud = CRUDIkigai(db)
    try:
        ikigai = await crud.upsert(user_id=user_id, ikigai_data=ikigai_data)
        return IkigaiResponse.model_validate(ikigai)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        ) 