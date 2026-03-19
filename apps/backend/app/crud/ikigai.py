from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import List, Optional, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.models.ikigai import Ikigai
from app.schemas.ikigai import IkigaiCreate, IkigaiUpdate


class CRUDIkigai:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: IkigaiCreate) -> Ikigai:
        """Creates a new Ikigai record for a user."""
        data = obj_in.model_dump()
        db_obj = Ikigai(**data)
        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            if "ikigai_user_id_key" in str(e):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="User already has an ikigai record. Use update instead."
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not create Ikigai: {e}"
            )

    async def get(self, *, id: UUID, user_id: UUID) -> Optional[Ikigai]:
        """Retrieves a single Ikigai record by its ID and User ID."""
        result = await self.db.execute(
            select(Ikigai).filter(
                Ikigai.id == id,
                Ikigai.user_id == user_id
            )
        )
        return result.scalars().first()

    async def get_by_user(self, *, user_id: UUID) -> Optional[Ikigai]:
        """Retrieves the Ikigai record for a specific user (since each user has only one)."""
        result = await self.db.execute(
            select(Ikigai).filter(Ikigai.user_id == user_id)
        )
        return result.scalars().first()

    async def update(self, *, db_obj: Ikigai, obj_in: IkigaiUpdate) -> Ikigai:
        """Updates an existing Ikigai record."""
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not update Ikigai: {e}"
            )

    async def delete(self, *, id: UUID, user_id: UUID) -> Optional[Ikigai]:
        """Deletes an Ikigai record."""
        ikigai = await self.get(id=id, user_id=user_id)
        if ikigai:
            await self.db.delete(ikigai)
            try:
                await self.db.commit()
                return ikigai
            except Exception as e:
                await self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Could not delete Ikigai: {e}"
                )
        return None

    async def upsert(self, *, user_id: UUID, ikigai_data: Dict[str, Any]) -> Ikigai:
        """Creates or updates an Ikigai record for a user."""
        existing = await self.get_by_user(user_id=user_id)
        
        if existing:
            # Update existing record
            update_data = IkigaiUpdate(ikigai_data=ikigai_data)
            return await self.update(db_obj=existing, obj_in=update_data)
        else:
            # Create new record
            create_data = IkigaiCreate(user_id=user_id, ikigai_data=ikigai_data)
            return await self.create(obj_in=create_data)


# --- Test Functions ---
import os
import asyncio
import pytest
from dotenv import load_dotenv
from uuid import UUID as _UUID
from app.database.database import AsyncSessionLocal
from app.schemas.ikigai import IkigaiCreate, IkigaiUpdate


async def test_crud_ikigai(db, user_id):
    """
    Test function for CRUD operations on Ikigai model.
    
    Args:
        db: Database session
        user_id: UUID of the test user
    """
    crud = CRUDIkigai(db)
    created_id: Optional[_UUID] = None
    
    # Create test ikigai data
    test_ikigai_data = {
        "what_you_love": ["Reading", "Teaching", "Creating", "Helping others"],
        "what_you_are_good_at": ["Programming", "Problem solving", "Communication", "Leadership"],
        "what_the_world_needs": ["Better education", "Technology solutions", "Mentorship", "Innovation"],
        "what_you_can_be_paid_for": ["Software development", "Consulting", "Training", "Product management"],
        "passion": "Technology education",
        "mission": "Empowering others through technology",
        "profession": "Software engineering and teaching",
        "vocation": "Creating educational technology solutions",
        "ikigai": "Building technology that educates and empowers people"
    }
    
    create_data = IkigaiCreate(
        user_id=user_id,
        ikigai_data=test_ikigai_data
    )
    
    # Test Create
    try:
        created = await crud.create(obj_in=create_data)
        assert created is not None, "Failed to create ikigai"
        assert created.id is not None
        assert created.user_id == user_id
        assert created.ikigai_data == test_ikigai_data
        created_id = created.id
        print(f"✅ Created ikigai with ID: {created.id}")
    except HTTPException as e:
        pytest.fail(f"Create failed: {e.detail}")
    
    # Test Get by ID
    fetched = await crud.get(id=created_id, user_id=user_id)
    assert fetched is not None, "Failed to fetch created ikigai"
    assert fetched.id == created_id, "Fetched ikigai ID mismatch"
    assert fetched.ikigai_data == test_ikigai_data
    print(f"✅ Fetched ikigai with ID: {fetched.id}")
    
    # Test Get by User
    fetched_by_user = await crud.get_by_user(user_id=user_id)
    assert fetched_by_user is not None, "Failed to fetch ikigai by user"
    assert fetched_by_user.id == created_id
    print(f"✅ Fetched ikigai by user ID: {fetched_by_user.id}")
    
    # Test Update
    updated_data = test_ikigai_data.copy()
    updated_data["ikigai"] = "Building technology that transforms education globally"
    
    update_obj = IkigaiUpdate(ikigai_data=updated_data)
    updated = await crud.update(db_obj=fetched, obj_in=update_obj)
    assert updated is not None, "Failed to update ikigai"
    assert updated.ikigai_data["ikigai"] == "Building technology that transforms education globally"
    print(f"✅ Updated ikigai with ID: {updated.id}")
    
    # Test Upsert (should update existing)
    upsert_data = updated_data.copy()
    upsert_data["passion"] = "Educational technology and mentorship"
    
    upserted = await crud.upsert(user_id=user_id, ikigai_data=upsert_data)
    assert upserted is not None, "Failed to upsert ikigai"
    assert upserted.id == created_id  # Should be same record
    assert upserted.ikigai_data["passion"] == "Educational technology and mentorship"
    print(f"✅ Upserted ikigai with ID: {upserted.id}")
    
    # Test Delete
    deleted = await crud.delete(id=created_id, user_id=user_id)
    assert deleted is not None, "Failed to delete ikigai"
    assert deleted.id == created_id
    print(f"✅ Deleted ikigai with ID: {deleted.id}")
    
    # Verify deletion
    verify_deleted = await crud.get(id=created_id, user_id=user_id)
    assert verify_deleted is None, "Ikigai was not properly deleted"
    print("✅ Verified ikigai deletion")
    
    print("🎉 All Ikigai CRUD tests passed!")


# Standalone test runner (for development/debugging)
async def run_ikigai_test():
    """
    Standalone function to run ikigai CRUD tests.
    """
    load_dotenv()
    
    # Get test user ID from environment
    test_user_id_str = os.getenv("TEST_USER_ID")
    if not test_user_id_str:
        raise ValueError("TEST_USER_ID environment variable not set or empty")
    try:
        test_user_id = _UUID(test_user_id_str)
    except ValueError:
        raise ValueError(f"Invalid UUID format for TEST_USER_ID: {test_user_id_str}")
    
    async with AsyncSessionLocal() as db:
        await test_crud_ikigai(db, test_user_id)


if __name__ == "__main__":
    asyncio.run(run_ikigai_test()) 