from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload # If relationships needed later
from uuid import UUID
from typing import List, Optional, Union, Dict, Any

from app.models.todo_lists import TodoList as TodoListModel
from app.schemas.todo_lists import TodoListCreate, TodoListUpdate
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

import os
import asyncio
from dotenv import load_dotenv

from app.database.database import AsyncSessionLocal
from app.models.todo_tabs import TodoTab as TodoTabModel
from app.crud.todo_tabs import CRUDTodoTab
from app.schemas.todo_tabs import TodoTabCreate # Needed to create a temp tab

class CRUDTodoList:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: TodoListCreate, user_id: UUID) -> TodoListModel:
        """Creates a new TodoList for a user."""
        # Ensure tab_id exists and belongs to the user if provided
        # Validation was moved to API layer, but if kept here, use obj_in.user_id
        # if obj_in.tab_id:
        #    tab = await self.db.get(TodoTabModel, obj_in.tab_id)
        #    if not tab or tab.user_id != obj_in.user_id:
        #        raise HTTPException(...)

        # user_id is now in obj_in, remove explicit keyword arg
        db_obj = TodoListModel(**obj_in.model_dump())
        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not create Todo List. Possible constraint violation: {e}"
            )
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An unexpected error occurred during creation: {e}"
            )

    async def get(self, *, id: UUID, user_id: UUID) -> Optional[TodoListModel]:
        """Retrieves a single TodoList by its ID and User ID."""
        result = await self.db.execute(
            select(TodoListModel).filter(TodoListModel.id == id, TodoListModel.user_id == user_id)
            # .options(selectinload(TodoListModel.todos)) # Optionally load todos
        )
        return result.scalars().first()

    async def get_multi_by_user(
        self, *, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[TodoListModel]:
        """Retrieves TodoLists for a specific user with pagination."""
        result = await self.db.execute(
            select(TodoListModel)
            .filter(TodoListModel.user_id == user_id)
            .order_by(TodoListModel.created_at)
            .offset(skip)
            .limit(limit)
            # .options(selectinload(TodoListModel.todos)) # Optionally load todos
        )
        return result.scalars().all()

    async def get_multi_by_tab(
        self, *, tab_id: Optional[UUID], user_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[TodoListModel]:
        """Retrieves TodoLists for a specific tab (or unassigned) and user."""
        query = (
            select(TodoListModel)
            .filter(TodoListModel.user_id == user_id, TodoListModel.tab_id == tab_id)
            .order_by(TodoListModel.created_at)
            .offset(skip)
            .limit(limit)
            # .options(selectinload(TodoListModel.todos))
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    async def update(
        self, *, db_obj: TodoListModel, obj_in: Union[TodoListUpdate, Dict[str, Any]]
    ) -> TodoListModel:
        """Updates an existing TodoList, allowing tab_id changes."""
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)

        # Validate new tab_id if it's being changed
        # (Again, this check might be better placed in the API layer)
        # if "tab_id" in update_data and update_data["tab_id"] is not None:
        #     new_tab = await self.db.get(TodoTabModel, update_data["tab_id"])
        #     if not new_tab or new_tab.user_id != db_obj.user_id:
        #         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="New TodoTab not found or not owned by user")

        # Update model fields
        for field, value in update_data.items():
            setattr(db_obj, field, value)

        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not update Todo List. Possible constraint violation: {e}"
            )
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An unexpected error occurred during update: {e}"
            )

    async def remove(self, *, id: UUID, user_id: UUID) -> Optional[TodoListModel]:
        """Deletes a TodoList by its ID and User ID."""
        # Optionally check if the list contains todos and handle deletion logic (e.g., prevent deletion or cascade)
        # db_obj = await self.get(id=id, user_id=user_id) # Use get to ensure user owns it
        # if db_obj and db_obj.todos:
        #     raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot delete list with existing todos. Delete todos first.")

        db_obj = await self.get(id=id, user_id=user_id)
        if db_obj:
            await self.db.delete(db_obj)
            try:
                await self.db.commit()
                return db_obj # Return the deleted object
            except IntegrityError as e:
                await self.db.rollback()
                # This might happen with DB-level constraints if not handled above
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Cannot delete Todo List due to constraints: {e}"
                )
            except Exception as e:
                await self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"An unexpected error occurred during deletion: {e}"
                )
        return None # Return None if object not found or user doesn't own it

# Helper function to format list details
def format_list(list_obj: Optional[TodoListModel]) -> str:
    if not list_obj:
        return "None"
    return (
        f"TodoList(id={list_obj.id}, user_id={list_obj.user_id}, name='{list_obj.name}', "
        f"tab_id={list_obj.tab_id}, created_at={list_obj.created_at}, updated_at={list_obj.updated_at})"
    )

async def main():
    """Tests the CRUD operations for TodoList."""
    load_dotenv() # Load environment variables from .env
    print("🧪 Starting CRUDTodoList test...")

    test_user_id_str = os.getenv("TEST_USER_ID")
    if not test_user_id_str:
        print("❌ Error: TEST_USER_ID environment variable not set.")
        return
    try:
        test_user_id = UUID(test_user_id_str.strip())
    except ValueError:
        print(f"❌ Error: Invalid UUID format for TEST_USER_ID: {test_user_id_str}")
        return

    created_list_id: Optional[UUID] = None
    temp_tab_id: Optional[UUID] = None

    async with AsyncSessionLocal() as session:
        crud_list = CRUDTodoList(db=session)
        crud_tab = CRUDTodoTab(db=session) # Need this to create/delete a temp tab

        # --- Setup: Create a temporary Tab for testing assignment ---
        print(f"\n➡️ Setting up: Creating temporary Tab for user {test_user_id}...")
        temp_tab_obj = None
        try:
            tab_to_create = TodoTabCreate(name="_Temp Test Tab for Lists_")
            temp_tab_obj = await crud_tab.create(obj_in=tab_to_create, user_id=test_user_id)
            temp_tab_id = temp_tab_obj.id
            print(f"✅ Temporary Tab created with ID: {temp_tab_id}")
        except Exception as e:
            print(f"❌ Failed to create temporary Tab: {e}. Aborting list tests that require a tab.")
            # Allow tests not requiring a tab to continue

        # --- Test Create (No Tab initially) --- 
        print(f"\n➡️ Testing CREATE List for user {test_user_id} (no tab assigned initially)...")
        list_to_create = TodoListCreate(name="Test List 1", tab_id=None)
        created_list = None
        try:
            created_list = await crud_list.create(obj_in=list_to_create, user_id=test_user_id)
            print(f"✅ CREATE List successful: {format_list(created_list)}")
            assert created_list is not None
            assert created_list.name == "Test List 1"
            assert created_list.user_id == test_user_id
            assert created_list.tab_id is None
            created_list_id = created_list.id # Store the ID
        except HTTPException as e:
            print(f"❌ CREATE List failed: HTTP {e.status_code} - {e.detail}")
        except Exception as e:
            print(f"❌ CREATE List failed with unexpected error: {e}")

        # --- Tests requiring the created list ---
        if created_list_id:
            # --- Test Get ---
            print(f"\n➡️ Testing GET List by ID ({created_list_id})...")
            try:
                fetched_list = await crud_list.get(id=created_list_id, user_id=test_user_id)
                print(f"✅ GET List successful: {format_list(fetched_list)}")
                assert fetched_list is not None
                assert fetched_list.id == created_list_id
                assert fetched_list.name == "Test List 1"
                assert fetched_list.tab_id is None # Verify it has no tab yet
            except Exception as e:
                print(f"❌ GET List failed: {e}")

            # --- Test Update (Assign to Tab) --- 
            if temp_tab_id: # Only run if temp tab exists
                print(f"\n➡️ Testing UPDATE List ({created_list_id}) to assign to Tab ({temp_tab_id})...")
                list_update_assign_tab = TodoListUpdate(tab_id=temp_tab_id)
                try:
                    db_obj_to_update = await crud_list.get(id=created_list_id, user_id=test_user_id)
                    if db_obj_to_update:
                        updated_list = await crud_list.update(db_obj=db_obj_to_update, obj_in=list_update_assign_tab)
                        print(f"✅ UPDATE List (Assign Tab) successful: {format_list(updated_list)}")
                        assert updated_list.tab_id == temp_tab_id
                        # Verify update persisted
                        refetched_list = await crud_list.get(id=created_list_id, user_id=test_user_id)
                        print(f"   Verification GET after UPDATE: {format_list(refetched_list)}")
                        assert refetched_list.tab_id == temp_tab_id
                    else:
                        print(f"❌ UPDATE List (Assign Tab) failed: Could not retrieve list {created_list_id}.")
                except Exception as e:
                    print(f"❌ UPDATE List (Assign Tab) failed: {e}")
            else:
                print("\n⚠️ Skipping UPDATE (Assign Tab) test as temporary tab creation failed.")

            # --- Test Get Multi By Tab (Assigned Tab) ---
            if temp_tab_id: # Only run if temp tab exists and list *should* be assigned
                print(f"\n➡️ Testing GET MULTI BY TAB ({temp_tab_id})...")
                try:
                    lists_in_tab = await crud_list.get_multi_by_tab(tab_id=temp_tab_id, user_id=test_user_id)
                    print(f"✅ GET MULTI BY TAB successful: Found {len(lists_in_tab)} lists.")
                    found_list = False
                    for list_obj in lists_in_tab:
                        print(f"   List: {format_list(list_obj)}")
                        if list_obj.id == created_list_id:
                            found_list = True
                    assert found_list, f"List {created_list_id} not found in tab {temp_tab_id}"
                except Exception as e:
                    print(f"❌ GET MULTI BY TAB failed: {e}")
            else:
                 print("\n⚠️ Skipping GET MULTI BY TAB test as temporary tab creation failed.")

            # --- Test Update (Unassign from Tab) ---
            print(f"\n➡️ Testing UPDATE List ({created_list_id}) to unassign from Tab...")
            list_update_unassign_tab = TodoListUpdate(tab_id=None)
            try:
                db_obj_to_update = await crud_list.get(id=created_list_id, user_id=test_user_id)
                if db_obj_to_update:
                    updated_list = await crud_list.update(db_obj=db_obj_to_update, obj_in=list_update_unassign_tab)
                    print(f"✅ UPDATE List (Unassign Tab) successful: {format_list(updated_list)}")
                    assert updated_list.tab_id is None
                    # Verify update persisted
                    refetched_list = await crud_list.get(id=created_list_id, user_id=test_user_id)
                    print(f"   Verification GET after UPDATE: {format_list(refetched_list)}")
                    assert refetched_list.tab_id is None
                else:
                    print(f"❌ UPDATE List (Unassign Tab) failed: Could not retrieve list {created_list_id}.")
            except Exception as e:
                print(f"❌ UPDATE List (Unassign Tab) failed: {e}")

            # --- Test Get Multi By Tab (Unassigned - tab_id=None) ---
            print(f"\n➡️ Testing GET MULTI BY TAB (tab_id=None) for unassigned lists...")
            try:
                unassigned_lists = await crud_list.get_multi_by_tab(tab_id=None, user_id=test_user_id)
                print(f"✅ GET MULTI BY TAB (None) successful: Found {len(unassigned_lists)} unassigned lists.")
                found_list = False
                for list_obj in unassigned_lists:
                    print(f"   List: {format_list(list_obj)}")
                    if list_obj.id == created_list_id:
                        found_list = True
                assert found_list, f"List {created_list_id} not found among unassigned lists (tab_id=None)"
            except Exception as e:
                print(f"❌ GET MULTI BY TAB (None) failed: {e}")

            # --- Test Get Multi By User ---
            print(f"\n➡️ Testing GET MULTI BY USER ({test_user_id})...")
            try:
                user_lists = await crud_list.get_multi_by_user(user_id=test_user_id, limit=10)
                print(f"✅ GET MULTI BY USER successful: Found {len(user_lists)} lists for user.")
                found_list = False
                for i, list_obj in enumerate(user_lists):
                    print(f"   List {i+1}: {format_list(list_obj)}")
                    if list_obj.id == created_list_id:
                        assert list_obj.tab_id is None # Should be unassigned now
                        found_list = True
                assert found_list, f"Did not find list {created_list_id} in get_multi_by_user result."
            except Exception as e:
                print(f"❌ GET MULTI BY USER failed: {e}")

            # --- Test Remove --- 
            print(f"\n➡️ Testing REMOVE List ({created_list_id})...")
            try:
                deleted_list_obj = await crud_list.remove(id=created_list_id, user_id=test_user_id)
                print(f"✅ REMOVE List successful (object before deletion): {format_list(deleted_list_obj)}")
                assert deleted_list_obj is not None
                assert deleted_list_obj.id == created_list_id
                # Verify deletion
                verify_deleted = await crud_list.get(id=created_list_id, user_id=test_user_id)
                print(f"   Verification GET after REMOVE: {format_list(verify_deleted)}")
                assert verify_deleted is None
            except HTTPException as e:
                print(f"❌ REMOVE List failed: HTTP {e.status_code} - {e.detail}")
            except Exception as e:
                print(f"❌ REMOVE List failed with unexpected error: {e}")
        else:
            print("\n⚠️ Skipping GET, UPDATE, and REMOVE tests as CREATE failed.")

        # --- Cleanup: Remove the temporary Tab ---
        if temp_tab_id:
            print(f"\n➡️ Cleaning up: Removing temporary Tab ({temp_tab_id})...")
            try:
                deleted_tab = await crud_tab.remove(id=temp_tab_id, user_id=test_user_id)
                if deleted_tab:
                    print(f"✅ Temporary Tab removed successfully.")
                else:
                     print(f"❓ Temporary Tab ({temp_tab_id}) could not be removed (might have been deleted already or error occurred).")
            except Exception as e:
                print(f"❌ Failed to remove temporary Tab ({temp_tab_id}): {e}")

    print("\n🏁 CRUDTodoList test finished.")

if __name__ == "__main__":
    # Ensure the database URL is set (e.g., via .env loaded by load_dotenv)
    asyncio.run(main())
