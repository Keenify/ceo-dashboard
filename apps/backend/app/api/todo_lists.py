from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

from app import schemas, models # Adjust imports as needed
from app.crud.todo_lists import CRUDTodoList
from app.crud.todo_tabs import CRUDTodoTab # Needed for tab validation
from app.database.database import get_db

router = APIRouter()

async def validate_tab_ownership(db: AsyncSession, tab_id: Optional[UUID], user_id: UUID):
    """Dependency/helper to validate tab ownership if tab_id is provided."""
    if tab_id:
        crud_tab = CRUDTodoTab(db)
        tab = await crud_tab.get(id=tab_id, user_id=user_id)
        if not tab:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail=f"Todo Tab with id {tab_id} not found or not owned by user"
            )

@router.post("/", response_model=schemas.todo_lists.TodoList, status_code=status.HTTP_201_CREATED)
async def create_todo_list(
    *, 
    db: AsyncSession = Depends(get_db),
    list_in: schemas.todo_lists.TodoListCreate
) -> models.TodoList:
    """Create a new todo list for the specified user, optionally assigning to a tab."""
    await validate_tab_ownership(db, list_in.tab_id, list_in.user_id)

    crud = CRUDTodoList(db)
    list_obj = await crud.create(obj_in=list_in, user_id=list_in.user_id)
    return list_obj

@router.get("/", response_model=List[schemas.todo_lists.TodoList])
async def read_todo_lists(
    *, 
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Query(..., description="User ID to filter lists for"),
    tab_id: Optional[UUID] = Query(None, description="Filter lists by Tab ID. If not provided, returns lists across all tabs."),
    include_unassigned: bool = Query(False, description="If true and tab_id is null, returns only lists not assigned to any tab."),
    skip: int = 0,
    limit: int = 100
) -> List[models.TodoList]:
    """Retrieve todo lists for the specified user, optionally filtered by tab."""
    crud = CRUDTodoList(db)
    if tab_id is not None:
        await validate_tab_ownership(db, tab_id, user_id)
        lists = await crud.get_multi_by_tab(tab_id=tab_id, user_id=user_id, skip=skip, limit=limit)
    elif include_unassigned:
         lists = await crud.get_multi_by_tab(tab_id=None, user_id=user_id, skip=skip, limit=limit)
    else:
        lists = await crud.get_multi_by_user(user_id=user_id, skip=skip, limit=limit)
    return lists

@router.get("/{list_id}", response_model=schemas.todo_lists.TodoList)
async def read_todo_list(
    *, 
    db: AsyncSession = Depends(get_db),
    list_id: UUID,
    user_id: UUID = Query(..., description="User ID owning the list")
) -> models.TodoList:
    """Get a specific todo list by ID for the specified user."""
    crud = CRUDTodoList(db)
    list_obj = await crud.get(id=list_id, user_id=user_id)
    if not list_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo List not found for this user")
    return list_obj

@router.put("/{list_id}", response_model=schemas.todo_lists.TodoList)
async def update_todo_list(
    *, 
    db: AsyncSession = Depends(get_db),
    list_id: UUID,
    list_in: schemas.todo_lists.TodoListUpdate,
    user_id: UUID = Query(..., description="User ID owning the list")
) -> models.TodoList:
    """Update a specific todo list for the specified user."""
    crud = CRUDTodoList(db)
    db_list = await crud.get(id=list_id, user_id=user_id)
    if not db_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo List not found for this user")

    update_data = list_in.model_dump(exclude_unset=True)
    new_tab_id = update_data.get("tab_id")
    if "tab_id" in update_data:
         await validate_tab_ownership(db, new_tab_id, user_id)

    updated_list = await crud.update(db_obj=db_list, obj_in=list_in)
    return updated_list

@router.delete("/{list_id}", response_model=schemas.todo_lists.TodoList)
async def delete_todo_list(
    *, 
    db: AsyncSession = Depends(get_db),
    list_id: UUID,
    user_id: UUID = Query(..., description="User ID owning the list")
) -> models.TodoList:
    """Delete a specific todo list for the specified user."""
    crud = CRUDTodoList(db)
    deleted_list = await crud.remove(id=list_id, user_id=user_id)
    if not deleted_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo List not found for this user")
    return deleted_list
