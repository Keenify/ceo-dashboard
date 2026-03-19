from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID
from datetime import date # Make sure date is imported

from app import schemas, models # Adjust imports as needed
from app.crud.todos import CRUDTodo
from app.crud.todo_lists import CRUDTodoList # Needed for list validation
from app.database.database import get_db

# Removed get_current_active_user dependency and placeholder

router = APIRouter()

async def validate_list_ownership(db: AsyncSession, list_id: Optional[UUID], user_id: UUID):
    """Dependency/helper to validate list ownership if list_id is provided."""
    if list_id:
        crud_list = CRUDTodoList(db)
        # Pass the correct user_id for validation
        list_obj = await crud_list.get(id=list_id, user_id=user_id)
        if not list_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail=f"Todo List with id {list_id} not found or not owned by user"
            )

@router.post("/", response_model=schemas.todos.Todo, status_code=status.HTTP_201_CREATED)
async def create_todo(
    *, 
    db: AsyncSession = Depends(get_db),
    # user_id is now in the payload
    todo_in: schemas.todos.TodoCreate
) -> models.Todo:
    """Create a new todo for the specified user, optionally assigning to a list."""
    # Validate list ownership using user_id from payload
    await validate_list_ownership(db, todo_in.list_id, todo_in.user_id)

    crud = CRUDTodo(db)
    # Pass user_id from the input schema
    todo = await crud.create(obj_in=todo_in, user_id=todo_in.user_id)
    return todo

@router.get("/", response_model=List[schemas.todos.Todo])
async def read_todos(
    *, 
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Query(..., description="User ID to filter todos for"), 
    list_id: Optional[UUID] = Query(None, description="Filter todos by List ID. Use null to get unassigned todos."),
    include_completed: Optional[bool] = Query(None, description="Filter by completion status (true/false). If null, returns all."),
    before_date: Optional[date] = Query(None, description="Filter todos with due_date on or before this date (inclusive)."), # Add before_date param
    after_date: Optional[date] = Query(None, description="Filter todos with due_date on or after this date (inclusive)."), # Add after_date param
    skip: int = 0,
    limit: int = 100
) -> List[models.Todo]:
    """Retrieve todos for the specified user with optional filtering, including date ranges."""
    crud = CRUDTodo(db)
    
    # Validate list ownership if filtering by a specific list
    if list_id is not None:
        await validate_list_ownership(db, list_id, user_id)
    
    todos = await crud.get_multi_by_user(
        user_id=user_id, 
        skip=skip, 
        limit=limit,
        include_completed=include_completed,
        list_id=list_id, # Pass list_id directly, CRUD handles None
        before_date=before_date, # Pass date filters
        after_date=after_date
    )
    return todos

@router.get("/{todo_id}", response_model=schemas.todos.Todo)
async def read_todo(
    *, 
    db: AsyncSession = Depends(get_db),
    todo_id: UUID,
    user_id: UUID = Query(..., description="User ID owning the todo") # Add user_id query param
) -> models.Todo:
    """Get a specific todo by ID for the specified user."""
    crud = CRUDTodo(db)
    # Use user_id from query param
    todo = await crud.get(id=todo_id, user_id=user_id)
    if not todo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found for this user")
    return todo

@router.put("/{todo_id}", response_model=schemas.todos.Todo)
async def update_todo(
    *, 
    db: AsyncSession = Depends(get_db),
    todo_id: UUID,
    todo_in: schemas.todos.TodoUpdate,
    user_id: UUID = Query(..., description="User ID owning the todo") # Add user_id query param
) -> models.Todo:
    """Update a specific todo for the specified user.
    Remember: updating list_id will set due_date to null.
    """
    crud = CRUDTodo(db)
    # Use user_id from query param for fetch
    db_todo = await crud.get(id=todo_id, user_id=user_id)
    if not db_todo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found for this user")

    update_data = todo_in.model_dump(exclude_unset=True)
    new_list_id = update_data.get("list_id")
    if "list_id" in update_data:
        # Use user_id from query param for validation
        await validate_list_ownership(db, new_list_id, user_id)

    # Update doesn't need user_id directly
    updated_todo = await crud.update(db_obj=db_todo, obj_in=todo_in)
    return updated_todo

@router.delete("/{todo_id}", response_model=schemas.todos.Todo)
async def delete_todo(
    *, 
    db: AsyncSession = Depends(get_db),
    todo_id: UUID,
    user_id: UUID = Query(..., description="User ID owning the todo") # Add user_id query param
) -> models.Todo:
    """Delete a specific todo for the specified user."""
    crud = CRUDTodo(db)
    # Use user_id from query param for delete check
    deleted_todo = await crud.remove(id=todo_id, user_id=user_id)
    if not deleted_todo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found for this user")
    return deleted_todo
