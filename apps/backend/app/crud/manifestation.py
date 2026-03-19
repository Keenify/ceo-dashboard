from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import List, Optional, Union, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.models.manifestation import Manifestation
from app.schemas.manifestation import (
    ManifestationCreate, ManifestationUpdate
)


class CRUDManifestation:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: ManifestationCreate) -> Manifestation:
        """Creates a new Manifestation."""
        data = obj_in.model_dump()
        db_obj = Manifestation(**data)
        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not create Manifestation: {e}"
            )

    async def get(self, *, id: UUID, user_id: UUID) -> Optional[Manifestation]:
        """Retrieves a single Manifestation by its ID and User ID."""
        result = await self.db.execute(
            select(Manifestation).filter(
                Manifestation.id == id,
                Manifestation.user_id == user_id
            )
        )
        return result.scalars().first()

    async def get_multi_by_user(
        self, *, user_id: UUID, category: Optional[str] = None, skip: int = 0, limit: int = 100
    ) -> List[Manifestation]:
        """Retrieves Manifestations for a specific user, optionally filtered by category."""
        query = select(Manifestation).filter(Manifestation.user_id == user_id)
        if category:
            query = query.filter(Manifestation.category == category)
        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def update(
        self, *, db_obj: Manifestation, obj_in: Union[ManifestationUpdate, Dict[str, Any]]
    ) -> Manifestation:
        """Updates an existing Manifestation."""
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)

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
                detail=f"Could not update Manifestation: {e}"
            )

    async def remove(self, *, id: UUID, user_id: UUID) -> Optional[Manifestation]:
        """Deletes a Manifestation by its ID and User ID."""
        db_obj = await self.get(id=id, user_id=user_id)
        if db_obj:
            await self.db.delete(db_obj)
            try:
                await self.db.commit()
                return db_obj
            except IntegrityError as e:
                await self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Cannot delete Manifestation due to constraints: {e}"
                )
        return None


# --- Test Functions ---
import os
import asyncio
import pytest # Import pytest for fail
from dotenv import load_dotenv
from uuid import UUID as _UUID
from app.database.database import AsyncSessionLocal
from app.schemas.manifestation import ManifestationCreate, ManifestationUpdate


async def test_crud_manifestation(db, user_id):
    """
    Test function for CRUD operations on Manifestation model.
    
    Args:
        db: Database session
        user_id: UUID of the test user
    """
    crud = CRUDManifestation(db)
    created_id: Optional[_UUID] = None
    
    # Create test data including new fields
    create_data = ManifestationCreate(
        user_id=user_id,
        strong_life_changes=[f"Change {i+1}" for i in range(5)],
        big_targets=[f"Target {i+1}" for i in range(5)],
        top_values=[f"Value {i+1}" for i in range(5)],
        non_negotiables=[f"Non-neg {i+1}" for i in range(5)],
        life_rules=[f"Rule {i+1}" for i in range(5)],
        rituals=[f"Ritual {i+1}" for i in range(5)],
        # Optional fields can be omitted or set
        courage_list=[{"action": "Spoke up", "situation": "Meeting"}],
        year=2024,
        theme="Growth"
    )
    
    # Test Create
    try:
        created = await crud.create(obj_in=create_data)
        assert created is not None, "Failed to create manifestation"
        assert created.id is not None
        assert created.year == 2024
        assert created.theme == "Growth"
        # Check default was applied if courage_list wasn't provided, or check provided value
        assert created.courage_list == [{"action": "Spoke up", "situation": "Meeting"}]
        created_id = created.id
        print(f"✅ Created manifestation with ID: {created.id}")
    except HTTPException as e:
        pytest.fail(f"Create failed: {e.detail}")
    
    # Test Get
    fetched = await crud.get(id=created_id, user_id=user_id)
    assert fetched is not None, "Failed to fetch created manifestation"
    assert fetched.id == created_id, "Fetched manifestation ID mismatch"
    assert fetched.year == 2024
    assert fetched.theme == "Growth"
    print(f"✅ Fetched manifestation with ID: {fetched.id}")
    
    # Test Get Multi
    multi = await crud.get_multi_by_user(user_id=user_id)
    assert any(m.id == created_id for m in multi), "Created manifestation not found in multi fetch"
    print(f"✅ Multi fetch returned {len(multi)} manifestations")
    
    # Test Update
    update_data = ManifestationUpdate(
        rituals=["Updated Ritual"],
        year=2025,
        theme="Consolidation",
        courage_list=[]
    )
    try:
        updated = await crud.update(db_obj=fetched, obj_in=update_data)
        assert updated.rituals == ["Updated Ritual"], "Failed to update rituals"
        assert updated.year == 2025, "Failed to update year"
        assert updated.theme == "Consolidation", "Failed to update theme"
        assert updated.courage_list == [], "Failed to update courage_list"
        print(f"✅ Updated manifestation with ID: {updated.id}")
    except HTTPException as e:
        pytest.fail(f"Update failed: {e.detail}")

    # Test Update specific fields to None (if applicable)
    update_to_none = ManifestationUpdate(year=None, theme=None)
    try:
        updated_none = await crud.update(db_obj=updated, obj_in=update_to_none)
        assert updated_none.year is None, "Failed to set year to None"
        assert updated_none.theme is None, "Failed to set theme to None"
        print(f"✅ Set year/theme to None for ID: {updated_none.id}")
    except HTTPException as e:
         pytest.fail(f"Update to None failed: {e.detail}")

    # Test Remove
    try:
        removed = await crud.remove(id=created_id, user_id=user_id)
        assert removed is not None, "Failed to remove manifestation"
        print(f"✅ Removed manifestation with ID: {removed.id}")
    except HTTPException as e:
         pytest.fail(f"Remove failed: {e.detail}")
    
    # Verify removal
    fetched_after_remove = await crud.get(id=created_id, user_id=user_id)
    assert fetched_after_remove is None, "Manifestation not actually removed"
    print(f"✅ Verified removal for {created_id}")


async def main():
    load_dotenv()
    test_user_id_str = os.getenv("TEST_USER_ID")
    if not test_user_id_str:
        print("❌ Error: TEST_USER_ID environment variable not set.")
        return
    try:
        test_user_id = _UUID(test_user_id_str.strip())
    except ValueError:
        print(f"❌ Error: Invalid UUID format for TEST_USER_ID: {test_user_id_str}")
        return
    async with AsyncSessionLocal() as session:
        await test_crud_manifestation(session, test_user_id)
    print("\n🏁 All Manifestation CRUD tests completed.")


if __name__ == "__main__":
    asyncio.run(main()) 