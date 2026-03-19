from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import List, Optional, Union, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from pydantic import ValidationError

from app.models.future_letters import FutureLetter
from app.schemas.future_letters import (
    FutureLetterCreate, FutureLetterUpdate
)

class CRUDFutureLetter:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: FutureLetterCreate) -> FutureLetter:
        """Creates a new FutureLetter."""
        try:
            data = obj_in.model_dump()
            db_obj = FutureLetter(**data)
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
                detail=f"Could not create FutureLetter: {str(e)}"
            )
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An unexpected error occurred: {str(e)}"
            )

    async def get(self, *, id: UUID, user_id: UUID) -> Optional[FutureLetter]:
        """Retrieves a single FutureLetter by its ID and User ID."""
        result = await self.db.execute(
            select(FutureLetter).filter(FutureLetter.id == id, FutureLetter.user_id == user_id)
        )
        return result.scalars().first()

    async def get_multi_by_user(
        self, *, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[FutureLetter]:
        """Retrieves FutureLetters for a specific user."""
        query = select(FutureLetter).filter(FutureLetter.user_id == user_id)
        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def update(
        self, *, db_obj: FutureLetter, obj_in: Union[FutureLetterUpdate, Dict[str, Any]]
    ) -> FutureLetter:
        """Updates an existing FutureLetter."""
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
                detail=f"Could not update FutureLetter: {e}"
            )

    async def remove(self, *, id: UUID, user_id: UUID) -> Optional[FutureLetter]:
        """Deletes a FutureLetter by its ID and User ID."""
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
                    detail=f"Cannot delete FutureLetter due to constraints: {e}"
                )
        return None

# --- Test Functions ---
import os
import asyncio
from dotenv import load_dotenv
from uuid import uuid4
from datetime import date
from app.database.database import AsyncSessionLocal
from app.schemas.future_letters import FutureLetterCreate, FutureLetterUpdate

async def test_crud_future_letter(db, user_id):
    print("\n🧪 Testing CRUDFutureLetter...")
    crud = CRUDFutureLetter(db)
    
    # Create
    create_data = FutureLetterCreate(
        user_id=user_id,
        recipient_email="future@example.com",
        email_subject="Letter to my future self",
        email_content="Dear Future Me, This is a test letter to my future self.",
        attachment_urls=["https://example.com/file1.pdf", "https://example.com/file2.jpg"],
        send_date=date.today(),
        send_status="scheduled"
    )
    created = await crud.create(obj_in=create_data)
    print(f"✅ Created: {created.id}")
    
    # Get
    fetched = await crud.get(id=created.id, user_id=user_id)
    assert fetched is not None
    print(f"✅ Fetched: {fetched.id}")
    
    # Get Multi
    multi = await crud.get_multi_by_user(user_id=user_id)
    assert any(letter.id == created.id for letter in multi)
    print(f"✅ Multi fetch count: {len(multi)}")
    
    # Update
    update_data = FutureLetterUpdate(
        email_subject="Updated subject",
        email_content="Updated content"
    )
    updated = await crud.update(db_obj=fetched, obj_in=update_data)
    assert updated.email_subject == "Updated subject"
    assert updated.email_content == "Updated content"
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
        await test_crud_future_letter(session, test_user_id)
    print("\n🏁 All FutureLetter CRUD tests completed.")

if __name__ == "__main__":
    asyncio.run(main())
