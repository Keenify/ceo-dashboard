from typing import List, Optional, Dict
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from sqlalchemy.orm import Session

from app.models.bucket_list_items import BucketListItems
from app.schemas.bucket_list_items import BucketListItemsCreate, BucketListItemsUpdate

class CRUDBucketListItems:
    def __init__(self, db: Session):
        self.db = db

    async def create_bucket_list_item(
        self, *, bucket_list_item: BucketListItemsCreate, user_id: UUID
    ) -> BucketListItems:
        """Create a new bucket list item with auto-assigned position."""
        # Get the highest sort_order for this user to assign next position
        next_position = await self._get_next_sort_order(user_id=user_id)
        
        # If sort_order is not provided, use auto-assigned position
        create_data = bucket_list_item.model_dump(exclude={'user_id'})
        if create_data.get('sort_order') is None:
            create_data['sort_order'] = next_position
            
        db_obj = BucketListItems(
            user_id=user_id,
            **create_data
        )
        self.db.add(db_obj)
        await self.db.commit()
        await self.db.refresh(db_obj)
        return db_obj

    async def get_bucket_list_item(
        self, *, bucket_list_item_id: UUID
    ) -> Optional[BucketListItems]:
        """Get a bucket list item by ID."""
        query = select(BucketListItems).where(BucketListItems.id == bucket_list_item_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_bucket_list_item_by_category(
        self, *, user_id: UUID, category: str
    ) -> Optional[BucketListItems]:
        """Get a bucket list item by category and user ID."""
        query = select(BucketListItems).where(
            BucketListItems.user_id == user_id,
            BucketListItems.category == category
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_bucket_list_items(
        self, *, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[BucketListItems]:
        """Get all bucket list items for a user, ordered by sort_order."""
        query = select(BucketListItems)\
            .where(BucketListItems.user_id == user_id)\
            .order_by(BucketListItems.sort_order, BucketListItems.created_at)\
            .offset(skip)\
            .limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_bucket_list_item(
        self, *, bucket_list_item_id: UUID, bucket_list_item_update: BucketListItemsUpdate
    ) -> Optional[BucketListItems]:
        """Update a bucket list item."""
        db_obj = await self.get_bucket_list_item(bucket_list_item_id=bucket_list_item_id)
        if not db_obj:
            return None
        
        update_data = bucket_list_item_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        
        await self.db.commit()
        await self.db.refresh(db_obj)
        return db_obj

    async def delete_bucket_list_item(
        self, *, bucket_list_item_id: UUID
    ) -> Optional[BucketListItems]:
        """Delete a bucket list item."""
        db_obj = await self.get_bucket_list_item(bucket_list_item_id=bucket_list_item_id)
        if not db_obj:
            return None
        
        await self.db.delete(db_obj)
        await self.db.commit()
        return db_obj
    
    async def _get_next_sort_order(self, *, user_id: UUID) -> int:
        """Get the next available sort_order for a user's buckets."""
        query = select(func.coalesce(func.max(BucketListItems.sort_order), -1) + 1)\
            .where(BucketListItems.user_id == user_id)
        result = await self.db.execute(query)
        return result.scalar()
    
    async def reorder_bucket_list_items(
        self, *, user_id: UUID, bucket_positions: List[Dict[str, any]]
    ) -> List[BucketListItems]:
        """
        Reorder bucket list items by updating their sort_order values.
        Uses temporary offset approach to avoid unique constraint violations during batch updates.
        
        Args:
            user_id: UUID of the user
            bucket_positions: List of dicts with 'bucket_id' and 'sort_order' keys
            
        Returns:
            List of updated bucket list items ordered by sort_order
        """
        if not bucket_positions:
            return []
            
        updated_buckets = []
        temp_offset = 10000  # Large offset to avoid conflicts with existing sort_orders
        
        # First pass: Set temporary values to avoid constraint violations
        for i, position_data in enumerate(bucket_positions):
            bucket_id = position_data.get('bucket_id')
            final_sort_order = position_data.get('sort_order')
            
            if bucket_id is None or final_sort_order is None:
                continue
                
            # Get the bucket and verify it belongs to the user
            bucket = await self.get_bucket_list_item(bucket_list_item_id=bucket_id)
            if bucket and bucket.user_id == user_id:
                # Set temporary sort_order first (temp_offset + index to ensure uniqueness)
                bucket.sort_order = temp_offset + i
                updated_buckets.append((bucket, final_sort_order))
        
        if not updated_buckets:
            return []
        
        # Commit temporary values
        await self.db.commit()
        
        # Second pass: Set final sort_order values
        final_buckets = []
        for bucket, final_sort_order in updated_buckets:
            bucket.sort_order = final_sort_order
            final_buckets.append(bucket)
        
        # Final commit
        await self.db.commit()
        
        # Refresh all updated objects
        for bucket in final_buckets:
            await self.db.refresh(bucket)
        
        # Return buckets sorted by sort_order to match frontend expectations
        return sorted(final_buckets, key=lambda b: b.sort_order)

# Create a singleton instance
crud_bucket_list_items = CRUDBucketListItems(None)  # DB session will be set per request

# --- Test Functions ---
import os
import asyncio
from dotenv import load_dotenv
from uuid import uuid4
from app.database.database import AsyncSessionLocal

async def test_crud_bucket_list_items(db, user_id):
    print("\n🧪 Testing CRUDBucketListItems...")
    crud = CRUDBucketListItems(db)
    
    try:
        
        # Create test data
        create_data = BucketListItemsCreate(
            category="Travel",
            items=[
                {"text": "Visit Japan", "completed": False},
                {"text": "See Northern Lights in Iceland", "completed": True},
                {"text": "Explore New Zealand", "completed": False}
            ]
        )
        created = await crud.create_bucket_list_item(bucket_list_item=create_data, user_id=user_id)
        print(f"✅ Created: {created.id}")
        
        # Get by ID
        fetched = await crud.get_bucket_list_item(bucket_list_item_id=created.id)
        assert fetched is not None
        print(f"✅ Fetched by ID: {fetched.id}")
        
        # Get by Category
        fetched_by_category = await crud.get_bucket_list_item_by_category(
            user_id=user_id, 
            category="Travel"
        )
        assert fetched_by_category is not None
        print(f"✅ Fetched by Category: {fetched_by_category.id}")
        
        # Get Multi
        multi = await crud.get_bucket_list_items(user_id=user_id)
        assert any(item.id == created.id for item in multi)
        print(f"✅ Multi fetch count: {len(multi)}")
        
        # Update
        update_data = BucketListItemsUpdate(
            category="Adventure Travel",
            items=[
                {"text": "Visit Japan", "completed": False},
                {"text": "See Northern Lights in Iceland", "completed": True},
                {"text": "Explore New Zealand", "completed": False},
                {"text": "Hike in Norway", "completed": True}
            ]
        )
        updated = await crud.update_bucket_list_item(
            bucket_list_item_id=created.id,
            bucket_list_item_update=update_data
        )
        assert updated.category == "Adventure Travel"
        assert any(item["text"] == "Hike in Norway" and item["completed"] for item in updated.items)
        print(f"✅ Updated: {updated.id}")
        
        # Delete
        deleted = await crud.delete_bucket_list_item(bucket_list_item_id=created.id)
        assert deleted is not None
        print(f"✅ Deleted: {deleted.id}")
        
        # Verify deletion
        verify_deleted = await crud.get_bucket_list_item(bucket_list_item_id=created.id)
        assert verify_deleted is None
        print("✅ Verified deletion")
        
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        await db.rollback()
        raise

async def main():
    load_dotenv()
    test_user_id_str = os.getenv("TEST_USER_ID")
    if not test_user_id_str:
        print("❌ Error: TEST_USER_ID environment variable not set.")
        return
    
    try:
        test_user_id = UUID(test_user_id_str.strip())
    except ValueError:
        print(f"❌ Error: Invalid UUID format for TEST_USER_ID: {test_user_id_str}")
        return
    
    async with AsyncSessionLocal() as session:
        await test_crud_bucket_list_items(session, test_user_id)
    print("\n🏁 All BucketListItems CRUD tests completed.")

if __name__ == "__main__":
    asyncio.run(main()) 