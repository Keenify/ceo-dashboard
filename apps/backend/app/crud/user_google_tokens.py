from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from uuid import UUID
from typing import Optional, Union, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from datetime import datetime

from app.models.user_google_tokens import UserGoogleToken
from app.schemas.user_google_tokens import (
    UserGoogleTokenCreate, UserGoogleTokenUpdate
)

class CRUDUserGoogleToken:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: UserGoogleTokenCreate) -> UserGoogleToken:
        """Creates or updates a UserGoogleToken record."""
        data = obj_in.model_dump()
        
        # Check if a record already exists for this user
        existing = await self.get(user_id=obj_in.user_id)
        
        if existing:
            # Update existing record
            for field, value in data.items():
                if field != "user_id":  # Don't update the primary key
                    setattr(existing, field, value)
            db_obj = existing
        else:
            # Create new record
            db_obj = UserGoogleToken(**data)
            
        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            detail = "Could not create/update Google token record due to a data integrity issue."
            if e.orig:
                pg_error_msg = str(e.orig).lower()
                if "user_google_tokens_user_id_fkey" in pg_error_msg:
                    detail = f"Invalid user_id: {obj_in.user_id}. User does not exist."
                else:
                    detail = f"Database integrity error: {e.orig}"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=detail
            )
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An unexpected error occurred while saving Google token: {str(e)}"
            )

    async def get(self, *, user_id: UUID) -> Optional[UserGoogleToken]:
        """Retrieves a UserGoogleToken record by User ID."""
        result = await self.db.execute(
            select(UserGoogleToken).filter(UserGoogleToken.user_id == user_id)
        )
        return result.scalars().first()

    async def update(
        self, *, db_obj: UserGoogleToken, obj_in: Union[UserGoogleTokenUpdate, Dict[str, Any]]
    ) -> UserGoogleToken:
        """Updates an existing UserGoogleToken record."""
        update_data = obj_in if isinstance(obj_in, dict) else obj_in.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            if field != "user_id":  # Don't update the primary key
                setattr(db_obj, field, value)

        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An unexpected error occurred while updating Google token: {str(e)}"
            )

    async def remove(self, *, user_id: UUID) -> Optional[UserGoogleToken]:
        """Deletes a UserGoogleToken record by User ID."""
        db_obj = await self.get(user_id=user_id)
        if db_obj:
            await self.db.delete(db_obj)
            try:
                await self.db.commit()
                return db_obj
            except Exception as e:
                await self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"An unexpected error occurred while deleting Google token: {str(e)}"
                )
        return None

    async def is_token_expired(self, *, token: UserGoogleToken) -> bool:
        """Checks if the access token is expired."""
        if not token or not token.expires_at:
            return True
        return token.expires_at <= datetime.now()

# --- Test Functions ---
import os
import asyncio
from dotenv import load_dotenv
from app.database.database import AsyncSessionLocal

async def test_crud_user_google_token(db: AsyncSession, user_id: UUID):
    print("\n🧪 Testing CRUDUserGoogleToken...")
    crud = CRUDUserGoogleToken(db)
    
    # Create test token
    print("  Test: Create Google Token")
    expires_at = datetime.now()
    token_data = UserGoogleTokenCreate(
        user_id=user_id,
        access_token="test_access_token",
        refresh_token="test_refresh_token",
        expires_at=expires_at
    )
    
    created_token = await crud.create(obj_in=token_data)
    print(f"  ✅ Created Token for user: {created_token.user_id}")
    assert created_token.access_token == "test_access_token"
    assert created_token.refresh_token == "test_refresh_token"
    
    # Get token
    print("\n  Test: Get Token")
    fetched_token = await crud.get(user_id=user_id)
    assert fetched_token is not None
    assert fetched_token.user_id == user_id
    print(f"  ✅ Fetched Token for user: {fetched_token.user_id}")
    
    # Update token
    print("\n  Test: Update Token")
    update_data = UserGoogleTokenUpdate(
        access_token="updated_access_token",
        expires_at=datetime.now()
    )
    updated_token = await crud.update(db_obj=fetched_token, obj_in=update_data)
    assert updated_token.access_token == "updated_access_token"
    assert updated_token.refresh_token == "test_refresh_token"  # Should remain unchanged
    print(f"  ✅ Updated Token for user: {updated_token.user_id}")
    
    # Check if token is expired
    is_expired = await crud.is_token_expired(token=updated_token)
    print(f"  ✅ Token expired check: {is_expired}")
    
    # Remove token
    print("\n  Test: Remove Token")
    removed_token = await crud.remove(user_id=user_id)
    assert removed_token is not None
    assert removed_token.user_id == user_id
    print(f"  ✅ Removed Token for user: {removed_token.user_id}")
    
    # Verify removal
    verify_removed = await crud.get(user_id=user_id)
    assert verify_removed is None
    print("  ✅ Verified Token removal.")

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

    print(f"Using TEST_USER_ID: {test_user_id} for CRUDUserGoogleToken direct testing.")
    
    async with AsyncSessionLocal() as session:
        try:
            await test_crud_user_google_token(session, test_user_id)
            print("\n🏁 All UserGoogleToken CRUD tests completed successfully.")
        except Exception as e:
            print(f"\n❌ An error occurred during testing: {e}")
            import traceback
            traceback.print_exc()
            await session.rollback()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Testing interrupted by user.") 