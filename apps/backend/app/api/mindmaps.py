from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.database import get_db
from app.crud.mindmaps import CRUDMindmap
from app.schemas.mindmaps import MindmapCreate, MindmapUpdate, MindmapResponse

router = APIRouter()

@router.post("/", response_model=MindmapResponse, status_code=status.HTTP_201_CREATED)
async def create_mindmap(
    *,
    db: AsyncSession = Depends(get_db),
    mindmap_in: MindmapCreate
):
    """Create a new mindmap."""
    crud = CRUDMindmap(db)
    mindmap = await crud.create(obj_in=mindmap_in)
    if not mindmap:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not create mindmap"
        )
    return MindmapResponse.model_validate(mindmap)

@router.get("/{mindmap_id}", response_model=MindmapResponse)
async def get_mindmap(
    *,
    db: AsyncSession = Depends(get_db),
    mindmap_id: UUID
):
    """Get a specific mindmap by ID."""
    crud = CRUDMindmap(db)
    mindmap = await crud.get(id=mindmap_id)
    if not mindmap:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mindmap not found"
        )
    return MindmapResponse.model_validate(mindmap)

@router.get("/user/{user_id}", response_model=List[MindmapResponse])
async def get_user_mindmaps(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID,
    skip: int = 0,
    limit: int = 100
):
    """Get all mindmaps for a specific user."""
    crud = CRUDMindmap(db)
    mindmaps = await crud.get_multi_by_user(
        user_id=user_id,
        skip=skip,
        limit=limit
    )
    return [MindmapResponse.model_validate(m) for m in mindmaps]

@router.get("/", response_model=List[MindmapResponse])
async def get_all_mindmaps(
    *,
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    """Get all mindmaps."""
    crud = CRUDMindmap(db)
    mindmaps = await crud.get_multi(skip=skip, limit=limit)
    return [MindmapResponse.model_validate(m) for m in mindmaps]

@router.put("/{mindmap_id}", response_model=MindmapResponse)
async def update_mindmap(
    *,
    db: AsyncSession = Depends(get_db),
    mindmap_id: UUID,
    mindmap_in: MindmapUpdate
):
    """Update a mindmap."""
    crud = CRUDMindmap(db)
    db_mindmap = await crud.get(id=mindmap_id)
    if not db_mindmap:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mindmap not found"
        )
    
    updated_mindmap = await crud.update(
        db_obj=db_mindmap,
        obj_in=mindmap_in
    )
    if not updated_mindmap:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not update mindmap"
        )
    return MindmapResponse.model_validate(updated_mindmap)

@router.delete("/{mindmap_id}", response_model=MindmapResponse)
async def delete_mindmap(
    *,
    db: AsyncSession = Depends(get_db),
    mindmap_id: UUID
):
    """Soft delete a mindmap."""
    crud = CRUDMindmap(db)
    mindmap = await crud.soft_delete(id=mindmap_id)
    if not mindmap:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mindmap not found"
        )
    return MindmapResponse.model_validate(mindmap)

@router.delete("/{mindmap_id}/permanent", response_model=MindmapResponse)
async def permanently_delete_mindmap(
    *,
    db: AsyncSession = Depends(get_db),
    mindmap_id: UUID
):
    """Permanently delete a mindmap."""
    crud = CRUDMindmap(db)
    mindmap = await crud.remove(id=mindmap_id)
    if not mindmap:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mindmap not found"
        )
    return MindmapResponse.model_validate(mindmap)

@router.post("/{mindmap_id}/restore", response_model=MindmapResponse)
async def restore_mindmap(
    *,
    db: AsyncSession = Depends(get_db),
    mindmap_id: UUID
):
    """Restore a soft-deleted mindmap."""
    crud = CRUDMindmap(db)
    mindmap = await crud.restore(id=mindmap_id)
    if not mindmap:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mindmap not found or not deleted"
        )
    return MindmapResponse.model_validate(mindmap) 