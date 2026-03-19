from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload
from uuid import UUID
from datetime import date, datetime
from typing import List, Optional, Union, Dict, Any

from app.models.todos import Todo as TodoModel
from app.schemas.todos import TodoCreate, TodoUpdate
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

# Need these for validation and testing
from app.models.todo_lists import TodoList as TodoListModel


class CRUDTodo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def move_incomplete_task_to_today(self, today: date, user_id: Optional[UUID] = None) -> int:
        """
        Move all incomplete todos (regardless of due date) to the given 'today' date. If user_id is provided, only for that user.
        Returns the number of tasks updated.
        """
        stmt = update(TodoModel).where(
            TodoModel.is_completed == False
        )
        if user_id is not None:
            stmt = stmt.where(TodoModel.user_id == user_id)
        stmt = stmt.values(due_date=today).execution_options(synchronize_session="fetch")

        result = await self.db.execute(stmt)
        await self.db.commit()
        return result.rowcount

    def __init__(self, db: AsyncSession):
        self.db = db

    async def _validate_list_id(self, list_id: UUID, user_id: UUID):
        """Helper to validate that a list_id exists and belongs to the user."""
        if list_id:
            list_obj = await self.db.get(TodoListModel, list_id)
            if not list_obj:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"TodoList with id {list_id} not found."
                )
            if list_obj.user_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User does not own the specified TodoList."
                )

    async def create(self, *, obj_in: TodoCreate, user_id: UUID) -> TodoModel:
        """Creates a new Todo for a user and updates sort_order for the relevant group."""
        # Validate list_id if provided (using the user_id from the schema)
        await self._validate_list_id(obj_in.list_id, obj_in.user_id)

        db_obj = TodoModel(**obj_in.model_dump())
        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            # After creation, update sort_order for the relevant group
            if db_obj.list_id is not None:
                # List-based: update sort_order for all todos in this list for this user
                await self._assign_sort_order_list(user_id=db_obj.user_id, list_id=db_obj.list_id)
            else:
                # Date-based (no list): update sort_order for all todos with list_id=None for this user
                await self._assign_sort_order_date(user_id=db_obj.user_id)
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not create Todo. Possible constraint violation: {e}"
            )
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An unexpected error occurred during creation: {e}"
            )

    async def _assign_sort_order_list(self, user_id: UUID, list_id: UUID) -> int:
        """Assigns sort_order for all todos in a specific list for a user."""
        result = await self.db.execute(
            select(TodoModel)
            .where(TodoModel.user_id == user_id, TodoModel.list_id == list_id)
            .order_by(TodoModel.created_at)
        )
        todos = result.scalars().all()
        updated_count = 0
        for idx, todo in enumerate(todos):
            if todo.sort_order != idx:
                todo.sort_order = idx
                self.db.add(todo)
                updated_count += 1
        if updated_count > 0:
            await self.db.commit()
        return updated_count

    async def _assign_sort_order_date(self, user_id: UUID) -> int:
        """Assigns sort_order for all todos with list_id=None for a user (date-based todos)."""
        result = await self.db.execute(
            select(TodoModel)
            .where(TodoModel.user_id == user_id, TodoModel.list_id == None)
            .order_by(TodoModel.created_at)
        )
        todos = result.scalars().all()
        updated_count = 0
        for idx, todo in enumerate(todos):
            if todo.sort_order != idx:
                todo.sort_order = idx
                self.db.add(todo)
                updated_count += 1
        if updated_count > 0:
            await self.db.commit()
        return updated_count

    async def get(self, *, id: UUID, user_id: UUID) -> Optional[TodoModel]:
        """Retrieves a single Todo by its ID and User ID."""
        result = await self.db.execute(
            select(TodoModel).filter(TodoModel.id == id, TodoModel.user_id == user_id)
        )
        return result.scalars().first()

    async def get_multi_by_user(
        self, *, user_id: UUID, skip: int = 0, limit: int = 100,
        include_completed: Optional[bool] = None, list_id: Optional[UUID] = None,
        before_date: Optional[date] = None,
        after_date: Optional[date] = None
    ) -> List[TodoModel]:
        """Retrieves Todos for a specific user with optional filtering (including dates)."""
        query = select(TodoModel).filter(TodoModel.user_id == user_id)

        if include_completed is not None:
            query = query.filter(TodoModel.is_completed == include_completed)
        
        # Filter by list_id (handles None correctly if list_id is None)
        query = query.filter(TodoModel.list_id == list_id)

        # Add inclusive date filtering
        if before_date is not None:
            query = query.filter(TodoModel.due_date <= before_date)
        if after_date is not None:
            query = query.filter(TodoModel.due_date >= after_date)

        query = query.order_by(TodoModel.priority, TodoModel.created_at)
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        return result.scalars().all()

    async def _reorder_todos_on_update(self, db_obj: TodoModel, new_sort_order: int) -> None:
        """
        Reorders todos in the same group (list or date group) when a todo's sort_order is updated.
        Ensures all todos have contiguous sort_order values.
        """
        # Determine the group: list-based or date-based
        user_id = db_obj.user_id
        list_id = db_obj.list_id
        if list_id is not None:
            result = await self.db.execute(
                select(TodoModel)
                .where(TodoModel.user_id == user_id, TodoModel.list_id == list_id)
                .order_by(TodoModel.sort_order, TodoModel.created_at)
            )
        else:
            result = await self.db.execute(
                select(TodoModel)
                .where(TodoModel.user_id == user_id, TodoModel.list_id == None)
                .order_by(TodoModel.sort_order, TodoModel.created_at)
            )
        todos = result.scalars().all()

        # Remove the todo being moved from the list (in memory, not DB)
        todos = [todo for todo in todos if todo.id != db_obj.id]
        # Clamp new_sort_order to valid range
        new_sort_order = max(0, min(new_sort_order, len(todos)))
        # Insert the todo at the new position
        todos.insert(new_sort_order, db_obj)
        # Reassign sort_order for all todos
        for idx, todo in enumerate(todos):
            if todo.sort_order != idx:
                todo.sort_order = idx
                self.db.add(todo)
        await self.db.commit()

    async def update(
        self, *, db_obj: TodoModel, obj_in: Union[TodoUpdate, Dict[str, Any]]
    ) -> TodoModel:
        """Updates an existing Todo.
        If list_id is updated (even to None), due_date is set to None.
        If sort_order is updated, reorders todos in the group accordingly.
        """
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)

        # Check if list_id is being updated
        updating_list_id = "list_id" in update_data
        new_list_id = update_data.get("list_id")

        # Validate the new list_id if it's being set (not None)
        if updating_list_id and new_list_id is not None:
            await self._validate_list_id(new_list_id, db_obj.user_id)

        # Update model fields
        for field, value in update_data.items():
            setattr(db_obj, field, value)

        # If list_id was updated (to a new ID or None) AND due_date wasn't also updated,
        # set due_date to None.
        if updating_list_id and "due_date" not in update_data:
            db_obj.due_date = None

        # If sort_order is being updated, reorder todos in the group
        if "sort_order" in update_data and update_data["sort_order"] is not None:
            await self._reorder_todos_on_update(db_obj, update_data["sort_order"])
        else:
            self.db.add(db_obj)
            try:
                await self.db.commit()
                await self.db.refresh(db_obj)
                return db_obj
            except IntegrityError as e:
                await self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Could not update Todo. Possible constraint violation: {e}"
                )
            except Exception as e:
                await self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"An unexpected error occurred during update: {e}"
                )
        # Refresh and return the updated object
        await self.db.refresh(db_obj)
        return db_obj

    async def remove(self, *, id: UUID, user_id: UUID) -> Optional[TodoModel]:
        """Deletes a Todo by its ID and User ID."""
        db_obj = await self.get(id=id, user_id=user_id)
        if db_obj:
            await self.db.delete(db_obj)
            try:
                await self.db.commit()
                return db_obj # Return the deleted object
            except IntegrityError as e: # Should be less common here unless complex constraints
                await self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Cannot delete Todo due to constraints: {e}"
                )
            except Exception as e:
                await self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"An unexpected error occurred during deletion: {e}"
                )
        return None

    async def assign_sort_order(self, user_id: UUID) -> int:
        """
        Assigns sort_order for all todos of a user, ordered by created_at ascending.
        If list_id exists, sort_order is assigned within each list (including None).
        Returns the number of todos updated.
        """
        # Fetch all todos for the user, ordered by list_id (None last), then created_at
        result = await self.db.execute(
            select(TodoModel)
            .where(TodoModel.user_id == user_id)
            .order_by(TodoModel.list_id.nullsfirst(), TodoModel.list_id, TodoModel.created_at)
        )
        todos = result.scalars().all()
        # Group by list_id
        from collections import defaultdict
        grouped = defaultdict(list)
        for todo in todos:
            grouped[todo.list_id].append(todo)
        # Assign sort_order within each group
        updated_count = 0
        for group in grouped.values():
            for idx, todo in enumerate(sorted(group, key=lambda t: t.created_at)):
                if todo.sort_order != idx:
                    todo.sort_order = idx
                    self.db.add(todo)
                    updated_count += 1
        if updated_count > 0:
            await self.db.commit()
        return updated_count

# --- Main Guard for Testing --- 
import os
import asyncio
from dotenv import load_dotenv

from app.database.database import AsyncSessionLocal
from app.crud.todo_lists import CRUDTodoList # Need list crud for testing
from app.schemas.todo_lists import TodoListCreate # Need list schema

# Helper function to format todo details
def format_todo(todo: Optional[TodoModel]) -> str:
    if not todo:
        return "None"
    return (
        f"Todo(id={todo.id}, user_id={todo.user_id}, title='{todo.title}', "
        f"list_id={todo.list_id}, due_date={todo.due_date}, is_completed={todo.is_completed}, "
        f"sort_order={getattr(todo, 'sort_order', None)}, "
        f"created_at={todo.created_at}, updated_at={todo.updated_at})"
    )

async def main():
    """Tests the CRUD operations for Todo."""
    load_dotenv()
    print("🧪 Starting CRUDTodo test...")

    test_user_id_str = os.getenv("TEST_USER_ID")
    if not test_user_id_str:
        print("❌ Error: TEST_USER_ID environment variable not set.")
        return
    try:
        test_user_id = UUID(test_user_id_str.strip())
    except ValueError:
        print(f"❌ Error: Invalid UUID format for TEST_USER_ID: {test_user_id_str}")
        return

    created_todo_id: Optional[UUID] = None
    temp_list_id: Optional[UUID] = None
    initial_due_date = date.today() # Example due date

    async with AsyncSessionLocal() as session:
        crud_todo = CRUDTodo(db=session)
        crud_list = CRUDTodoList(db=session) # For creating/deleting test list

        # --- Setup: Create a temporary List for testing assignment ---
        print(f"\n➡️ Setting up: Creating temporary List for user {test_user_id}...")
        try:
            list_to_create = TodoListCreate(name="_Temp Test List for Todos_")
            temp_list_obj = await crud_list.create(obj_in=list_to_create, user_id=test_user_id)
            temp_list_id = temp_list_obj.id
            print(f"✅ Temporary List created with ID: {temp_list_id}")
        except Exception as e:
            print(f"❌ Failed to create temporary List: {e}. Aborting tests that require a list.")
            # Allow tests not requiring a list to proceed cautiously

        # --- Test Create (No List initially, with due date) --- 
        print(f"\n➡️ Testing CREATE Todo for user {test_user_id} (no list, with due date)...")
        todo_to_create = TodoCreate(title="Test Todo 1", description="Initial Desc", due_date=initial_due_date)
        created_todo = None
        try:
            created_todo = await crud_todo.create(obj_in=todo_to_create, user_id=test_user_id)
            print(f"✅ CREATE Todo successful: {format_todo(created_todo)}")
            assert created_todo is not None
            assert created_todo.title == "Test Todo 1"
            assert created_todo.user_id == test_user_id
            assert created_todo.list_id is None
            assert created_todo.due_date == initial_due_date
            created_todo_id = created_todo.id # Store the ID
        except Exception as e:
            print(f"❌ CREATE Todo failed: {e}")

        # --- Tests requiring the created todo ---
        if created_todo_id:
            # --- Test Get ---
            print(f"\n➡️ Testing GET Todo by ID ({created_todo_id})...")
            try:
                fetched_todo = await crud_todo.get(id=created_todo_id, user_id=test_user_id)
                print(f"✅ GET Todo successful: {format_todo(fetched_todo)}")
                assert fetched_todo is not None
                assert fetched_todo.id == created_todo_id
                assert fetched_todo.due_date == initial_due_date
            except Exception as e:
                print(f"❌ GET Todo failed: {e}")

            # --- Test Update (Assign to List - should clear due_date) --- 
            if temp_list_id: # Only run if temp list exists
                print(f"\n➡️ Testing UPDATE Todo ({created_todo_id}) to assign to List ({temp_list_id})...")
                todo_update_assign_list = TodoUpdate(list_id=temp_list_id)
                try:
                    db_obj_to_update = await crud_todo.get(id=created_todo_id, user_id=test_user_id)
                    if db_obj_to_update:
                        updated_todo = await crud_todo.update(db_obj=db_obj_to_update, obj_in=todo_update_assign_list)
                        print(f"✅ UPDATE Todo (Assign List) successful: {format_todo(updated_todo)}")
                        assert updated_todo.list_id == temp_list_id
                        assert updated_todo.due_date is None # Verify due date was cleared
                        # Verify update persisted
                        refetched_todo = await crud_todo.get(id=created_todo_id, user_id=test_user_id)
                        print(f"   Verification GET after UPDATE: {format_todo(refetched_todo)}")
                        assert refetched_todo.list_id == temp_list_id
                        assert refetched_todo.due_date is None
                    else:
                        print(f"❌ UPDATE Todo (Assign List) failed: Could not retrieve todo {created_todo_id}.")
                except Exception as e:
                    print(f"❌ UPDATE Todo (Assign List) failed: {e}")
            else:
                print("\n⚠️ Skipping UPDATE (Assign List) test as temporary list creation failed.")

            # --- Test Update (Change title, mark complete - list assigned) --- 
            print(f"\n➡️ Testing UPDATE Todo ({created_todo_id}) change title/completion (list still assigned)...")
            todo_update_details = TodoUpdate(title="Test Todo 1 Updated", is_completed=True)
            try:
                db_obj_to_update = await crud_todo.get(id=created_todo_id, user_id=test_user_id)
                if db_obj_to_update:
                    updated_todo = await crud_todo.update(db_obj=db_obj_to_update, obj_in=todo_update_details)
                    print(f"✅ UPDATE Todo (Details) successful: {format_todo(updated_todo)}")
                    assert updated_todo.title == "Test Todo 1 Updated"
                    assert updated_todo.is_completed is True
                    assert updated_todo.list_id == temp_list_id # Should still be assigned
                    assert updated_todo.due_date is None # Should remain None
                    # Verify update persisted
                    refetched_todo = await crud_todo.get(id=created_todo_id, user_id=test_user_id)
                    print(f"   Verification GET after UPDATE: {format_todo(refetched_todo)}")
                    assert refetched_todo.title == "Test Todo 1 Updated"
                    assert refetched_todo.is_completed is True
                else:
                     print(f"❌ UPDATE Todo (Details) failed: Could not retrieve todo {created_todo_id}.")
            except Exception as e:
                 print(f"❌ UPDATE Todo (Details) failed: {e}")

            # --- Test Get Multi By User (Filtering by List ID) ---
            if temp_list_id:
                print(f"\n➡️ Testing GET MULTI BY USER filtering by list_id={temp_list_id}...")
                try:
                    list_todos = await crud_todo.get_multi_by_user(user_id=test_user_id, list_id=temp_list_id)
                    print(f"✅ GET MULTI BY USER (list_id={temp_list_id}) successful: Found {len(list_todos)} todos.")
                    found_todo = False
                    for todo in list_todos:
                        print(f"   Todo: {format_todo(todo)}")
                        if todo.id == created_todo_id:
                            found_todo = True
                            assert todo.title == "Test Todo 1 Updated"
                            assert todo.is_completed is True
                    assert found_todo, f"Did not find todo {created_todo_id} in list {temp_list_id}"
                except Exception as e:
                    print(f"❌ GET MULTI BY USER (list_id={temp_list_id}) failed: {e}")
            else:
                 print("\n⚠️ Skipping GET MULTI BY USER (List Filter) test as temporary list creation failed.")


            # --- Test Remove --- 
            print(f"\n➡️ Testing REMOVE Todo ({created_todo_id})...")
            try:
                deleted_todo_obj = await crud_todo.remove(id=created_todo_id, user_id=test_user_id)
                print(f"✅ REMOVE Todo successful (object before deletion): {format_todo(deleted_todo_obj)}")
                assert deleted_todo_obj is not None
                assert deleted_todo_obj.id == created_todo_id
                # Verify deletion
                verify_deleted = await crud_todo.get(id=created_todo_id, user_id=test_user_id)
                print(f"   Verification GET after REMOVE: {format_todo(verify_deleted)}")
                assert verify_deleted is None
            except Exception as e:
                print(f"❌ REMOVE Todo failed: {e}")
        else:
            print("\n⚠️ Skipping GET, UPDATE, and REMOVE tests as CREATE failed.")

        # --- Cleanup: Remove the temporary List ---
        if temp_list_id:
            print(f"\n➡️ Cleaning up: Removing temporary List ({temp_list_id})...")
            try:
                deleted_list = await crud_list.remove(id=temp_list_id, user_id=test_user_id)
                if deleted_list:
                    print(f"✅ Temporary List removed successfully.")
                else:
                     print(f"❓ Temporary List ({temp_list_id}) could not be removed.")
            except Exception as e:
                print(f"❌ Failed to remove temporary List ({temp_list_id}): {e}")

    print("\n🏁 CRUDTodo test finished.")

if __name__ == "__main__":

    user_id = "0ad8a451-c027-4f68-abe6-73d8eeb73abb" # tanengkeen@gmail.com

    # assign sort order for all todos for a user
    # crud_todo = CRUDTodo(db=AsyncSessionLocal())
    # result = asyncio.run(crud_todo.assign_sort_order(user_id=UUID(user_id)))
    # print(f"Assigned sort order for {result} todos.")

    # move incomplete task to today for 1 user id
    # result = asyncio.run(crud_todo.move_incomplete_task_to_today(today=date.today(), user_id=UUID(user_id)))

    # move all incomplete tasks to today for all users
    # result = asyncio.run(crud_todo.move_incomplete_task_to_today(today=date.today()))
    # print(f"Moved {result} incomplete tasks to today.")
