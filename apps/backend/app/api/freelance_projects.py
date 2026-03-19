from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database.database import get_db
from app.crud.freelance_projects import CRUDFreelanceProject
from app.schemas.freelance_projects import (
    FreelanceProjectCreate,
    FreelanceProjectUpdate,
    FreelanceProjectResponse
)

router = APIRouter()


@router.post("", response_model=FreelanceProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_freelance_project(
    *,
    db: AsyncSession = Depends(get_db),
    project_in: FreelanceProjectCreate
) -> FreelanceProjectResponse:
    """Create a new freelance project."""
    crud = CRUDFreelanceProject(db)
    try:
        project = await crud.create(obj_in=project_in)
        return FreelanceProjectResponse.model_validate(project)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("", response_model=List[FreelanceProjectResponse])
async def get_freelance_projects(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID
) -> List[FreelanceProjectResponse]:
    """Get all freelance projects for a user."""
    crud = CRUDFreelanceProject(db)
    projects = await crud.get_by_user(user_id=user_id)
    return [FreelanceProjectResponse.model_validate(p) for p in projects]


@router.get("/{project_id}", response_model=FreelanceProjectResponse)
async def get_freelance_project(
    *,
    db: AsyncSession = Depends(get_db),
    project_id: UUID,
    user_id: UUID
) -> FreelanceProjectResponse:
    """Get a freelance project by ID."""
    crud = CRUDFreelanceProject(db)
    project = await crud.get(id=project_id, user_id=user_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Freelance project not found"
        )
    return FreelanceProjectResponse.model_validate(project)


@router.put("/{project_id}", response_model=FreelanceProjectResponse)
async def update_freelance_project(
    *,
    db: AsyncSession = Depends(get_db),
    project_id: UUID,
    user_id: UUID,
    project_in: FreelanceProjectUpdate
) -> FreelanceProjectResponse:
    """Update a freelance project."""
    crud = CRUDFreelanceProject(db)
    project = await crud.get(id=project_id, user_id=user_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Freelance project not found"
        )
    try:
        updated_project = await crud.update(db_obj=project, obj_in=project_in)
        return FreelanceProjectResponse.model_validate(updated_project)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_freelance_project(
    *,
    db: AsyncSession = Depends(get_db),
    project_id: UUID,
    user_id: UUID
) -> None:
    """Delete a freelance project."""
    crud = CRUDFreelanceProject(db)
    project = await crud.get(id=project_id, user_id=user_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Freelance project not found"
        )
    await crud.remove(id=project_id, user_id=user_id)
