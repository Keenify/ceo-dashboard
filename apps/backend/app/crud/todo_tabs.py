from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload # If relationships needed later
from uuid import UUID
from typing import List, Optional, Union, Dict, Any

from app.models.todo_tabs import TodoTab as TodoTabModel
from app.schemas.todo_tabs import TodoTabCreate, TodoTabUpdate
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

import os
import asyncio
from dotenv import load_dotenv

from app.database.database import AsyncSessionLocal # Assuming this is the correct path

class CRUDTodoTab:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: TodoTabCreate, user_id: UUID) -> TodoTabModel:
        """Creates a new TodoTab for a user."""
        db_obj = TodoTabModel(**obj_in.model_dump())
        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            # Handle potential constraint violations, e.g., if name needed uniqueness per user
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not create Todo Tab. Possible constraint violation: {e}"
            )
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An unexpected error occurred: {e}"
            )


    async def get(self, *, id: UUID, user_id: UUID) -> Optional[TodoTabModel]:
        """Retrieves a single TodoTab by its ID and User ID."""
        result = await self.db.execute(
            select(TodoTabModel).filter(TodoTabModel.id == id, TodoTabModel.user_id == user_id)
        )
        return result.scalars().first()

    async def get_multi_by_user(
        self, *, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[TodoTabModel]:
        """Retrieves TodoTabs for a specific user with pagination."""
        result = await self.db.execute(
            select(TodoTabModel)
            .filter(TodoTabModel.user_id == user_id)
            .order_by(TodoTabModel.created_at) # Or by name, etc.
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    async def update(
        self, *, db_obj: TodoTabModel, obj_in: Union[TodoTabUpdate, Dict[str, Any]]
    ) -> TodoTabModel:
        """Updates an existing TodoTab."""
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)

        # Update model fields
        for field, value in update_data.items():
            setattr(db_obj, field, value)

        # Ensure updated_at is handled automatically if using onupdate=func.now() in model
        # Otherwise, manually set: db_obj.updated_at = datetime.utcnow()

        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not update Todo Tab. Possible constraint violation: {e}"
            )
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An unexpected error occurred during update: {e}"
            )

    async def remove(self, *, id: UUID, user_id: UUID) -> Optional[TodoTabModel]:
        """Deletes a TodoTab by its ID and User ID."""
        db_obj = await self.get(id=id, user_id=user_id) # Ensure user owns the tab
        if db_obj:
            await self.db.delete(db_obj)
            try:
                await self.db.commit()
                return db_obj # Return the deleted object
            except IntegrityError as e:
                # This might happen if related items (like TodoLists) have constraints
                await self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Cannot delete Todo Tab due to related items or constraints: {e}"
                )
            except Exception as e:
                await self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"An unexpected error occurred during deletion: {e}"
                )
        return None # Return None if object not found or user doesn't own it

# Helper function to format tab details
def format_tab(tab: Optional[TodoTabModel]) -> str:
    if not tab:
        return "None"
    return (
        f"TodoTab(id={tab.id}, user_id={tab.user_id}, name='{tab.name}', "
        f"created_at={tab.created_at}, updated_at={tab.updated_at})"
    )

async def main():
    """Tests the CRUD operations for TodoTab."""
    load_dotenv() # Load environment variables from .env
    print("🧪 Starting CRUDTodoTab test...")

    test_user_id_str = os.getenv("TEST_USER_ID")
    if not test_user_id_str:
        print("❌ Error: TEST_USER_ID environment variable not set.")
        return
    try:
        # Strip whitespace which might include trailing comments
        test_user_id = UUID(test_user_id_str.strip())
    except ValueError:
        print(f"❌ Error: Invalid UUID format for TEST_USER_ID: {test_user_id_str}")
        return

    created_tab_id: Optional[UUID] = None

    async with AsyncSessionLocal() as session:
        crud = CRUDTodoTab(db=session)

        # --- Test Create --- 
        print(f"\n➡️ Testing CREATE for user {test_user_id}...")
        tab_to_create = TodoTabCreate(name="Test Tab 1")
        created_tab = None
        try:
            created_tab = await crud.create(obj_in=tab_to_create, user_id=test_user_id)
            print(f"✅ CREATE successful: {format_tab(created_tab)}")
            assert created_tab is not None
            assert created_tab.name == "Test Tab 1"
            assert created_tab.user_id == test_user_id
            created_tab_id = created_tab.id # Store the ID
        except HTTPException as e:
            print(f"❌ CREATE failed: HTTP {e.status_code} - {e.detail}")
        except Exception as e:
            print(f"❌ CREATE failed with unexpected error: {e}")

        # --- Test Get (if create succeeded) ---
        if created_tab_id:
            print(f"\n➡️ Testing GET by ID ({created_tab_id})...")
            fetched_tab = None
            try:
                fetched_tab = await crud.get(id=created_tab_id, user_id=test_user_id)
                print(f"✅ GET successful: {format_tab(fetched_tab)}")
                assert fetched_tab is not None
                assert fetched_tab.id == created_tab_id
                assert fetched_tab.name == "Test Tab 1"
            except HTTPException as e:
                print(f"❌ GET failed: HTTP {e.status_code} - {e.detail}")
            except Exception as e:
                print(f"❌ GET failed with unexpected error: {e}")

            # --- Test Update ---
            print(f"\n➡️ Testing UPDATE for ID ({created_tab_id})...")
            tab_to_update = TodoTabUpdate(name="Test Tab 1 Updated")
            updated_tab = None
            try:
                # Need the db_obj first
                db_obj_to_update = await crud.get(id=created_tab_id, user_id=test_user_id)
                if db_obj_to_update:
                    updated_tab = await crud.update(db_obj=db_obj_to_update, obj_in=tab_to_update)
                    print(f"✅ UPDATE successful: {format_tab(updated_tab)}")
                    assert updated_tab is not None
                    assert updated_tab.name == "Test Tab 1 Updated"
                    assert updated_tab.id == created_tab_id
                    # Verify update persisted by fetching again
                    refetched_tab = await crud.get(id=created_tab_id, user_id=test_user_id)
                    print(f"   Verification GET after UPDATE: {format_tab(refetched_tab)}")
                    assert refetched_tab.name == "Test Tab 1 Updated"
                else:
                     print(f"❌ UPDATE failed: Could not retrieve tab with ID {created_tab_id} to update.")
            except HTTPException as e:
                print(f"❌ UPDATE failed: HTTP {e.status_code} - {e.detail}")
            except Exception as e:
                print(f"❌ UPDATE failed with unexpected error: {e}")

        # --- Test Get Multi By User ---
        print(f"\n➡️ Testing GET MULTI BY USER ({test_user_id})...")
        try:
            user_tabs = await crud.get_multi_by_user(user_id=test_user_id, limit=10)
            print(f"✅ GET MULTI successful: Found {len(user_tabs)} tabs.")
            found_updated = False
            for i, tab in enumerate(user_tabs):
                print(f"   Tab {i+1}: {format_tab(tab)}")
                if created_tab_id and tab.id == created_tab_id:
                    assert tab.name == "Test Tab 1 Updated"
                    found_updated = True
            if created_tab_id: # Only assert if we expected to find it
                 assert found_updated, f"Did not find the updated tab {created_tab_id} in get_multi_by_user result."
        except HTTPException as e:
            print(f"❌ GET MULTI failed: HTTP {e.status_code} - {e.detail}")
        except Exception as e:
            print(f"❌ GET MULTI failed with unexpected error: {e}")

        # --- Test Remove (if create succeeded) ---
        if created_tab_id:
            print(f"\n➡️ Testing REMOVE for ID ({created_tab_id})...")
            deleted_tab_obj = None
            try:
                deleted_tab_obj = await crud.remove(id=created_tab_id, user_id=test_user_id)
                print(f"✅ REMOVE successful (object before deletion): {format_tab(deleted_tab_obj)}")
                assert deleted_tab_obj is not None
                assert deleted_tab_obj.id == created_tab_id
                # Verify deletion
                verify_deleted = await crud.get(id=created_tab_id, user_id=test_user_id)
                print(f"   Verification GET after REMOVE: {format_tab(verify_deleted)}")
                assert verify_deleted is None
            except HTTPException as e:
                print(f"❌ REMOVE failed: HTTP {e.status_code} - {e.detail}")
            except Exception as e:
                print(f"❌ REMOVE failed with unexpected error: {e}")
        else:
            print("\n⚠️ Skipping REMOVE test as CREATE failed or was skipped.")

    print("\n🏁 CRUDTodoTab test finished.")

if __name__ == "__main__":
    # Ensure the database URL is set (e.g., via .env loaded by load_dotenv)
    # You might need to initialize your database/tables if running for the first time
    # Example: from app.models import Base; from app.database.database import engine
    # async def init_db(): async with engine.begin() as conn: await conn.run_sync(Base.metadata.create_all)
    asyncio.run(main())
