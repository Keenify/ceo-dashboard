from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from datetime import datetime

from app.models.user_modules import UserModules
from app.schemas.user_modules import UserModulesCreate, UserModulesUpdate


class CRUDUserModules:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: UserModulesCreate) -> UserModules:
        """Creates a new UserModules record for a user."""
        data = obj_in.model_dump()
        db_obj = UserModules(**data)
        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not create UserModules: {e}"
            )

    async def get(self, *, id: UUID, user_id: UUID) -> Optional[UserModules]:
        """Retrieves a single UserModules record by its ID and User ID."""
        result = await self.db.execute(
            select(UserModules).filter(
                UserModules.id == id,
                UserModules.user_id == user_id
            )
        )
        return result.scalars().first()

    async def get_by_user(self, *, user_id: UUID) -> List[UserModules]:
        """Retrieves all UserModules records for a specific user."""
        result = await self.db.execute(
            select(UserModules).filter(UserModules.user_id == user_id)
        )
        return result.scalars().all()

    async def get_by_stripe_customer(self, *, stripe_customer_id: str) -> List[UserModules]:
        """Retrieves all UserModules records for a specific Stripe customer."""
        result = await self.db.execute(
            select(UserModules).filter(UserModules.stripe_customer_id == stripe_customer_id)
        )
        return result.scalars().all()

    async def get_active_subscriptions(self, *, user_id: UUID) -> List[UserModules]:
        """Retrieves all active UserModules records for a specific user."""
        result = await self.db.execute(
            select(UserModules).filter(
                UserModules.user_id == user_id,
                UserModules.status == 'active'
            )
        )
        return result.scalars().all()

    async def update(self, *, db_obj: UserModules, obj_in: UserModulesUpdate) -> UserModules:
        """Updates an existing UserModules record."""
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
                detail=f"Could not update UserModules: {e}"
            )

    async def delete(self, *, id: UUID, user_id: UUID) -> Optional[UserModules]:
        """Deletes a UserModules record."""
        user_module = await self.get(id=id, user_id=user_id)
        if user_module:
            await self.db.delete(user_module)
            try:
                await self.db.commit()
                return user_module
            except Exception as e:
                await self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Could not delete UserModules: {e}"
                )
        return None

    async def update_subscription_status(self, *, id: UUID, user_id: UUID, status: str) -> Optional[UserModules]:
        """Updates the subscription status of a UserModules record."""
        user_module = await self.get(id=id, user_id=user_id)
        if user_module:
            update_data = UserModulesUpdate(status=status)
            return await self.update(db_obj=user_module, obj_in=update_data)
        return None


# --- Test Functions ---
import os
import asyncio
from dotenv import load_dotenv
from uuid import UUID as _UUID
from app.database.database import AsyncSessionLocal
from app.schemas.user_modules import UserModulesCreate, UserModulesUpdate


async def test_crud_user_modules(db, user_id):
    """
    Test function for CRUD operations on UserModules model.
    
    Args:
        db: Database session
        user_id: UUID of the test user
    """
    crud = CRUDUserModules(db)
    created_id: Optional[_UUID] = None
    
    # Create test user modules data
    test_start_date = datetime.now()
    test_end_date = datetime.now()
    
    create_data = UserModulesCreate(
        user_id=user_id,
        stripe_customer_id="cus_test123456789",
        stripe_subscription_item_id="si_test123456789",
        product_id="prod_test123456789",
        price_id="price_test123456789",
        status="active",
        start_date=test_start_date,
        end_date=test_end_date
    )
    
    # Test Create
    try:
        created = await crud.create(obj_in=create_data)
        assert created is not None, "Failed to create user modules"
        assert created.id is not None
        assert created.user_id == user_id
        assert created.stripe_customer_id == "cus_test123456789"
        assert created.status == "active"
        created_id = created.id
        print(f"✅ Created user modules with ID: {created.id}")
    except HTTPException as e:
        raise RuntimeError(f"Create failed: {e.detail}")
    
    # Test Get by ID
    fetched = await crud.get(id=created_id, user_id=user_id)
    assert fetched is not None, "Failed to fetch created user modules"
    assert fetched.id == created_id, "Fetched user modules ID mismatch"
    assert fetched.stripe_customer_id == "cus_test123456789"
    print(f"✅ Fetched user modules with ID: {fetched.id}")
    
    # Test Get by User
    fetched_by_user = await crud.get_by_user(user_id=user_id)
    assert len(fetched_by_user) >= 1, "Failed to fetch user modules by user"
    assert any(um.id == created_id for um in fetched_by_user)
    print(f"✅ Fetched {len(fetched_by_user)} user modules by user ID")
    
    # Test Get by Stripe Customer
    fetched_by_stripe = await crud.get_by_stripe_customer(stripe_customer_id="cus_test123456789")
    assert len(fetched_by_stripe) >= 1, "Failed to fetch user modules by Stripe customer"
    assert any(um.id == created_id for um in fetched_by_stripe)
    print(f"✅ Fetched {len(fetched_by_stripe)} user modules by Stripe customer ID")
    
    # Test Get Active Subscriptions
    active_subscriptions = await crud.get_active_subscriptions(user_id=user_id)
    assert len(active_subscriptions) >= 1, "Failed to fetch active subscriptions"
    assert any(um.id == created_id for um in active_subscriptions)
    print(f"✅ Fetched {len(active_subscriptions)} active subscriptions")
    
    # Test Update
    update_obj = UserModulesUpdate(
        status="paused",
        product_id="prod_updated123456789"
    )
    updated = await crud.update(db_obj=fetched, obj_in=update_obj)
    assert updated is not None, "Failed to update user modules"
    assert updated.status == "paused"
    assert updated.product_id == "prod_updated123456789"
    print(f"✅ Updated user modules with ID: {updated.id}")
    
    # Test Update Subscription Status
    status_updated = await crud.update_subscription_status(
        id=created_id,
        user_id=user_id,
        status="cancelled"
    )
    assert status_updated is not None, "Failed to update subscription status"
    assert status_updated.status == "cancelled"
    print(f"✅ Updated subscription status to cancelled for ID: {status_updated.id}")
    
    # Test Delete
    deleted = await crud.delete(id=created_id, user_id=user_id)
    assert deleted is not None, "Failed to delete user modules"
    assert deleted.id == created_id
    print(f"✅ Deleted user modules with ID: {deleted.id}")
    
    # Verify deletion
    verify_deleted = await crud.get(id=created_id, user_id=user_id)
    assert verify_deleted is None, "UserModules was not properly deleted"
    print("✅ Verified user modules deletion")
    
    print("🎉 All UserModules CRUD tests passed!")


# Standalone test runner (for development/debugging)
async def run_user_modules_test():
    """
    Standalone function to run user modules CRUD tests.
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
        await test_crud_user_modules(db, test_user_id)


if __name__ == "__main__":
    asyncio.run(run_user_modules_test())
