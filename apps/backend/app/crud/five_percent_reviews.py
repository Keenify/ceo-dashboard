from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import List, Optional, Union, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from pydantic import ValidationError

from app.models.five_percent_reviews import FivePercentReview
from app.schemas.five_percent_reviews import (
    FivePercentReviewCreate, FivePercentReviewUpdate
)

class CRUDFivePercentReview:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: FivePercentReviewCreate) -> FivePercentReview:
        """Creates a new FivePercentReview."""
        try:
            data = obj_in.model_dump()
            db_obj = FivePercentReview(**data)
            self.db.add(db_obj)
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except ValidationError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"validation_error": e.errors()}
            )
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not create FivePercentReview: {str(e)}"
            )
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An unexpected error occurred: {str(e)}"
            )

    async def get(self, *, id: UUID, user_id: UUID) -> Optional[FivePercentReview]:
        """Retrieves a single FivePercentReview by its ID and User ID."""
        result = await self.db.execute(
            select(FivePercentReview).filter(FivePercentReview.id == id, FivePercentReview.user_id == user_id)
        )
        return result.scalars().first()

    async def get_multi_by_user(
        self, *, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[FivePercentReview]:
        """Retrieves FivePercentReviews for a specific user."""
        query = select(FivePercentReview).filter(FivePercentReview.user_id == user_id)
        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def update(
        self, *, db_obj: FivePercentReview, obj_in: Union[FivePercentReviewUpdate, Dict[str, Any]]
    ) -> FivePercentReview:
        """Updates an existing FivePercentReview."""
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
                detail=f"Could not update FivePercentReview: {e}"
            )

    async def remove(self, *, id: UUID, user_id: UUID) -> Optional[FivePercentReview]:
        """Deletes a FivePercentReview by its ID and User ID."""
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
                    detail=f"Cannot delete FivePercentReview due to constraints: {e}"
                )
        return None

# --- Test Functions ---
import os
import asyncio
from dotenv import load_dotenv
from uuid import uuid4
from datetime import date
from app.database.database import AsyncSessionLocal
from app.schemas.five_percent_reviews import FivePercentReviewCreate, FivePercentReviewUpdate

async def test_crud_five_percent_review(db, user_id):
    print("\n🧪 Testing CRUDFivePercentReview...")
    crud = CRUDFivePercentReview(db)
    
    # Create
    create_data = FivePercentReviewCreate(
        user_id=user_id,
        review_date=date.today(),
        work_feelings="Test work feelings",
        work_headline="Test work headline",
        work_significance="Test work significance",
        family_feelings="Test family feelings",
        family_headline="Test family headline",
        family_significance="Test family significance",
        personal_feelings="Test personal feelings",
        personal_headline="Test personal headline",
        personal_significance="Test personal significance",
        next_30_60="Test next 30-60 days plans",
        challenge_or_opportunity="Test challenge or opportunity"
    )
    created = await crud.create(obj_in=create_data)
    print(f"✅ Created: {created.id}")
    
    # Get
    fetched = await crud.get(id=created.id, user_id=user_id)
    assert fetched is not None
    print(f"✅ Fetched: {fetched.id}")
    
    # Get Multi
    multi = await crud.get_multi_by_user(user_id=user_id)
    assert any(review.id == created.id for review in multi)
    print(f"✅ Multi fetch count: {len(multi)}")
    
    # Update
    update_data = FivePercentReviewUpdate(
        work_feelings="Updated work feelings",
        work_headline="Updated work headline",
        next_30_60="Updated next 30-60 days plans"
    )
    updated = await crud.update(db_obj=fetched, obj_in=update_data)
    assert updated.work_feelings == "Updated work feelings"
    assert updated.work_headline == "Updated work headline"
    assert updated.next_30_60 == "Updated next 30-60 days plans"
    print(f"✅ Updated: {updated.id}")
    
    # Remove
    removed = await crud.remove(id=created.id, user_id=user_id)
    assert removed is not None
    print(f"✅ Removed: {removed.id}")

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
        await test_crud_five_percent_review(session, test_user_id)
    print("\n🏁 All FivePercentReview CRUD tests completed.")

if __name__ == "__main__":
    asyncio.run(main()) 