from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from app import schemas, models # Assuming top-level __init__.py might expose these, or adjust imports
from app.crud.todo_tabs import CRUDTodoTab
from app.database.database import get_db # Assuming a dependency for session
# from app.api.deps import get_current_active_user # Assuming dependency for user auth

# Placeholder for user dependency - replace with your actual dependency
async def get_current_active_user():
    # In a real app, this would verify a token and return the user model
    # For now, returning a mock user ID for demonstration
    from uuid import UUID
    class MockUser:
        user_id: UUID = UUID("0ad8a451-c027-4f68-abe6-73d8eeb73abb") # Use TEST_USER_ID for now
    return MockUser()

router = APIRouter()

@router.post("/", response_model=schemas.todo_tabs.TodoTab, status_code=status.HTTP_201_CREATED)
async def create_todo_tab(
    *, 
    db: AsyncSession = Depends(get_db),
    tab_in: schemas.todo_tabs.TodoTabCreate 
) -> models.TodoTab:
    """Create a new todo tab for the specified user."""
    crud = CRUDTodoTab(db)
    tab = await crud.create(obj_in=tab_in, user_id=tab_in.user_id) 
    return tab

@router.get("/", response_model=List[schemas.todo_tabs.TodoTab])
async def read_todo_tabs(
    *, 
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Query(..., description="User ID to filter tabs for"),
    skip: int = 0,
    limit: int = 100
) -> List[models.TodoTab]:
    """Retrieve todo tabs for the specified user."""
    crud = CRUDTodoTab(db)
    tabs = await crud.get_multi_by_user(user_id=user_id, skip=skip, limit=limit)
    return tabs

@router.get("/{tab_id}", response_model=schemas.todo_tabs.TodoTab)
async def read_todo_tab(
    *, 
    db: AsyncSession = Depends(get_db),
    tab_id: UUID,
    user_id: UUID = Query(..., description="User ID owning the tab")
) -> models.TodoTab:
    """Get a specific todo tab by ID for the specified user."""
    crud = CRUDTodoTab(db)
    tab = await crud.get(id=tab_id, user_id=user_id)
    if not tab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo Tab not found for this user")
    return tab

@router.put("/{tab_id}", response_model=schemas.todo_tabs.TodoTab)
async def update_todo_tab(
    *, 
    db: AsyncSession = Depends(get_db),
    tab_id: UUID,
    tab_in: schemas.todo_tabs.TodoTabUpdate,
    user_id: UUID = Query(..., description="User ID owning the tab")
) -> models.TodoTab:
    """Update a specific todo tab for the specified user."""
    crud = CRUDTodoTab(db)
    db_tab = await crud.get(id=tab_id, user_id=user_id)
    if not db_tab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo Tab not found for this user")
    updated_tab = await crud.update(db_obj=db_tab, obj_in=tab_in)
    return updated_tab

@router.delete("/{tab_id}", response_model=schemas.todo_tabs.TodoTab)
async def delete_todo_tab(
    *, 
    db: AsyncSession = Depends(get_db),
    tab_id: UUID,
    user_id: UUID = Query(..., description="User ID owning the tab")
) -> models.TodoTab:
    """Delete a specific todo tab for the specified user."""
    crud = CRUDTodoTab(db)
    deleted_tab = await crud.remove(id=tab_id, user_id=user_id)
    if not deleted_tab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo Tab not found for this user")
    return deleted_tab
