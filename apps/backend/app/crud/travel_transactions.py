from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import List, Optional, Union, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from datetime import date

from app.models.travel_transactions import TravelTransaction
from app.schemas.travel_transactions import (
    TravelTransactionCreate, TravelTransactionUpdate
)

class CRUDTravelTransaction:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: TravelTransactionCreate) -> TravelTransaction:
        """Creates a new TravelTransaction.

        The input schema's validator (`check_amount_fields`) ensures either
        `amount_sgd` is provided directly, or it calculates `amount_sgd` from
        the local currency fields. The dumped data will always contain `amount_sgd`.
        """
        # Data is validated by the Pydantic model, including amount logic
        data = obj_in.model_dump()

        # If amount_sgd was provided directly, local fields might be None in data
        # If local fields were provided, amount_sgd was calculated and added to data

        db_obj = TravelTransaction(**data) # Create model instance
        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            # Check for specific constraints if needed, e.g., foreign key
            if "travel_transactions_user_id_fkey" in str(e):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid user_id: {obj_in.user_id}"
                )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not create TravelTransaction: {e.orig}" # Show original error context
            )

    async def get(self, *, id: UUID, user_id: UUID) -> Optional[TravelTransaction]:
        """Retrieves a single TravelTransaction by its ID and User ID."""
        result = await self.db.execute(
            select(TravelTransaction).filter(TravelTransaction.id == id, TravelTransaction.user_id == user_id)
        )
        return result.scalars().first()

    async def get_multi_by_user(
        self, *, user_id: UUID, skip: int = 0, limit: int = 100
        , start_date: Optional[date] = None
        , end_date: Optional[date] = None
        , city: Optional[str] = None
        , country: Optional[str] = None
    ) -> List[TravelTransaction]:
        """Retrieves TravelTransactions for a specific user, with optional filters."""
        query = select(TravelTransaction).filter(TravelTransaction.user_id == user_id)

        # Apply optional filters
        if start_date:
            query = query.filter(TravelTransaction.payment_date >= start_date)
        if end_date:
            query = query.filter(TravelTransaction.payment_date <= end_date)
        if city:
            # Use ilike for case-insensitive matching, adjust if case-sensitive is needed
            query = query.filter(TravelTransaction.city.ilike(f"%{city}%"))
        if country:
            query = query.filter(TravelTransaction.country.ilike(f"%{country}%"))

        # Apply ordering
        query = query.order_by(TravelTransaction.payment_date.desc(), TravelTransaction.created_at.desc())

        # Apply pagination
        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def update(
        self, *, db_obj: TravelTransaction, obj_in: Union[TravelTransactionUpdate, Dict[str, Any]]
    ) -> TravelTransaction:
        """Updates an existing TravelTransaction."""
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            # Ensure `exclude_unset=True` to only update provided fields
            update_data = obj_in.model_dump(exclude_unset=True)

        # --- Handle potential conflicts between direct SGD and local currency updates --- 
        # The schema validator (`check_update_amount_fields`) prevents sending both in one request
        # and enforces providing all 3 local fields if updating that way.
        # It also calculates and adds `amount_sgd` to `update_data` if local fields were provided.

        if 'amount_sgd' in update_data and not any(key in update_data for key in ['local_currency', 'amount_local_currency', 'exchange_rate_to_sgd']):
             # If updating amount_sgd directly, explicitly nullify the local currency fields in the DB object
             db_obj.local_currency = None
             db_obj.amount_local_currency = None
             db_obj.exchange_rate_to_sgd = None
        elif all(key in update_data for key in ['local_currency', 'amount_local_currency', 'exchange_rate_to_sgd']):
             # If updating via local currency fields (schema validator added calculated amount_sgd to update_data)
             # No need to nullify amount_sgd here, as it's being set by the update_data anyway.
             pass # Proceed to apply all fields from update_data
        # --- End Handle Conflicts ---

        for field, value in update_data.items():
            setattr(db_obj, field, value)

        self.db.add(db_obj) # Add the updated object to the session
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not update TravelTransaction: {e.orig}"
            )

    async def remove(self, *, id: UUID, user_id: UUID) -> Optional[TravelTransaction]:
        """Deletes a TravelTransaction by its ID and User ID."""
        db_obj = await self.get(id=id, user_id=user_id)
        if db_obj:
            await self.db.delete(db_obj)
            try:
                await self.db.commit()
                return db_obj # Return the deleted object
            except IntegrityError as e:
                await self.db.rollback()
                # It's unlikely to hit constraint issues on delete unless cascaded deletes cause problems
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Cannot delete TravelTransaction: {e.orig}"
                )
        return None # Return None if the object was not found

    async def bulk_rename_trip(
        self, 
        *,
        user_id: UUID,
        old_trip_name: str,
        old_city: str, 
        old_country: str,
        new_trip_name: str,
        new_city: str,
        new_country: str
    ) -> tuple[int, List[UUID]]:
        """
        Bulk rename trip details for all transactions matching the old trip name, city, and country.
        Returns a tuple of (count of updated transactions, list of updated transaction IDs).
        """
        # Find all transactions matching the old trip details
        query = select(TravelTransaction).filter(
            TravelTransaction.user_id == user_id,
            TravelTransaction.trip_name == old_trip_name,
            TravelTransaction.city == old_city,
            TravelTransaction.country == old_country
        )
        
        result = await self.db.execute(query)
        transactions_to_update = result.scalars().all()
        
        if not transactions_to_update:
            return 0, []
        
        # Update each transaction
        updated_ids = []
        try:
            for transaction in transactions_to_update:
                transaction.trip_name = new_trip_name
                transaction.city = new_city
                transaction.country = new_country
                self.db.add(transaction)
                updated_ids.append(transaction.id)
            
            await self.db.commit()
            return len(updated_ids), updated_ids
            
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not bulk rename trip: {e.orig}"
            )

# --- Test Functions (Adapt as needed) ---
import os
import asyncio
from dotenv import load_dotenv
from uuid import uuid4
from datetime import date, timedelta
from decimal import Decimal
from app.database.database import AsyncSessionLocal
from app.schemas.travel_transactions import TravelTransactionCreate, TravelTransactionUpdate

async def test_crud_travel_transaction(db, user_id):
    print("\n🧪 Testing CRUDTravelTransaction...")
    crud = CRUDTravelTransaction(db)

    # --- Test Case 1: Create using Local Currency --- 
    print("  Test 1: Create using Local Currency")
    today = date.today()
    # Create
    create_data_local = TravelTransactionCreate(
        user_id=user_id,
        booking_date=today - timedelta(days=10),
        payment_date=today - timedelta(days=2),
        description="Test Flight Ticket",
        item="Flight SIN-LON",
        city="London",
        country="UK",
        local_currency="GBP",
        amount_local_currency=Decimal("550.75"),
        exchange_rate_to_sgd=Decimal("1.712345"),
        category="expense"
    )
    created_local = await crud.create(obj_in=create_data_local)
    expected_sgd_local = (Decimal("550.75") * Decimal("1.712345")).quantize(Decimal("0.00"))
    print(f"  ✅ Created (Local): {created_local.id}, Expected SGD: {expected_sgd_local}, Actual SGD: {created_local.amount_sgd}")
    assert created_local.amount_sgd == expected_sgd_local
    assert created_local.local_currency == "GBP"

    # Get
    fetched = await crud.get(id=created_local.id, user_id=user_id)
    assert fetched is not None
    print(f"✅ Fetched: {fetched.id}")

    # Get Multi
    multi = await crud.get_multi_by_user(user_id=user_id)
    assert any(tt.id == created_local.id for tt in multi)
    print(f"✅ Multi fetch count: {len(multi)}")

    # Test Get Multi with filters
    print("\n🔄 Testing Get Multi with filters...")
    # Filter by date range
    filtered_by_date = await crud.get_multi_by_user(user_id=user_id, start_date=today - timedelta(days=5), end_date=today)
    print(f"  Filtered by date ({today - timedelta(days=5)} to {today}): {len(filtered_by_date)} found.")
    assert any(tt.id == created_local.id for tt in filtered_by_date) # Should include the created one

    # Filter by city (case-insensitive)
    filtered_by_city = await crud.get_multi_by_user(user_id=user_id, city="LoNdOn")
    print(f"  Filtered by city ('LoNdOn'): {len(filtered_by_city)} found.")
    assert any(tt.id == created_local.id for tt in filtered_by_city)

    # Filter by country
    filtered_by_country = await crud.get_multi_by_user(user_id=user_id, country="UK")
    print(f"  Filtered by country ('UK'): {len(filtered_by_country)} found.")
    assert any(tt.id == created_local.id for tt in filtered_by_country)

    # Filter by non-matching criteria
    filtered_no_match_city = await crud.get_multi_by_user(user_id=user_id, city="NonExistent")
    print(f"  Filtered by non-matching city ('NonExistent'): {len(filtered_no_match_city)} found.")
    assert not any(tt.id == created_local.id for tt in filtered_no_match_city)

    # --- Test Case 2: Update Local -> Direct SGD ---
    print("\n  Test 2: Update Local -> Direct SGD")
    update_to_sgd = TravelTransactionUpdate(amount_sgd=Decimal("1000.00"))
    updated_direct_sgd = await crud.update(db_obj=fetched, obj_in=update_to_sgd)
    print(f"  ✅ Updated to Direct SGD: {updated_direct_sgd.id}, Amount SGD: {updated_direct_sgd.amount_sgd}")
    assert updated_direct_sgd.amount_sgd == Decimal("1000.00")
    assert updated_direct_sgd.local_currency is None
    assert updated_direct_sgd.amount_local_currency is None
    assert updated_direct_sgd.exchange_rate_to_sgd is None

    # Fetch again to confirm update
    fetched_after_sgd_update = await crud.get(id=created_local.id, user_id=user_id)
    assert fetched_after_sgd_update.amount_sgd == Decimal("1000.00")
    assert fetched_after_sgd_update.local_currency is None

    # --- Test Case 3: Update Direct SGD -> Local Currency ---
    print("\n  Test 3: Update Direct SGD -> Local Currency")
    update_to_local = TravelTransactionUpdate(
        local_currency="EUR",
        amount_local_currency=Decimal("800.50"),
        exchange_rate_to_sgd=Decimal("1.456789")
    )
    updated_back_to_local = await crud.update(db_obj=fetched_after_sgd_update, obj_in=update_to_local)
    expected_sgd_recalc = (Decimal("800.50") * Decimal("1.456789")).quantize(Decimal("0.00"))
    print(f"  ✅ Updated back to Local: {updated_back_to_local.id}, Expected SGD: {expected_sgd_recalc}, Actual SGD: {updated_back_to_local.amount_sgd}")
    assert updated_back_to_local.local_currency == "EUR"
    assert updated_back_to_local.amount_local_currency == Decimal("800.50")
    assert updated_back_to_local.exchange_rate_to_sgd == Decimal("1.456789")
    assert updated_back_to_local.amount_sgd == expected_sgd_recalc

    # Fetch again
    fetched_after_local_update = await crud.get(id=created_local.id, user_id=user_id)
    assert fetched_after_local_update.local_currency == "EUR"
    assert fetched_after_local_update.amount_sgd == expected_sgd_recalc

    # --- Test Case 4: Create using Direct SGD --- 
    print("\n  Test 4: Create using Direct SGD")
    create_data_sgd = TravelTransactionCreate(
        user_id=user_id,
        payment_date=today - timedelta(days=1),
        item="Direct SGD Item",
        city="Singapore",
        country="Singapore",
        amount_sgd=Decimal("99.99"),
        category="expense"
    )
    created_sgd = await crud.create(obj_in=create_data_sgd)
    print(f"  ✅ Created (Direct SGD): {created_sgd.id}, Amount SGD: {created_sgd.amount_sgd}")
    assert created_sgd.amount_sgd == Decimal("99.99")
    assert created_sgd.local_currency is None

    # Update
    # Update the original record (which is now local currency again)
    update_data = TravelTransactionUpdate(description="Updated Flight Ticket Description", city="Manchester")
    updated = await crud.update(db_obj=fetched_after_local_update, obj_in=update_data)
    assert updated.description == "Updated Flight Ticket Description"
    assert updated.city == "Manchester"
    # Check that computed field is still correct (or at least present) after update
    assert updated.amount_sgd is not None
    assert updated.amount_sgd == expected_sgd_recalc # Should not change if only description/city updated
    print(f"✅ Updated: {updated.id}")

    # Remove
    # Remove both created records
    removed_local = await crud.remove(id=created_local.id, user_id=user_id)
    removed_sgd = await crud.remove(id=created_sgd.id, user_id=user_id)
    assert removed_local is not None
    print(f"✅ Removed Local: {removed_local.id}")
    print(f"✅ Removed SGD: {removed_sgd.id}")

    # Verify Removal
    verify_removed_local = await crud.get(id=created_local.id, user_id=user_id)
    verify_removed_sgd = await crud.get(id=created_sgd.id, user_id=user_id)
    assert verify_removed_local is None
    assert verify_removed_sgd is None
    print("✅ Verified removal.")

    # --- Test Case 5: Bulk Rename Trip ---
    print("\n  Test 5: Bulk Rename Trip")
    
    # Create test transactions with same trip details
    trip_data_1 = TravelTransactionCreate(
        user_id=user_id,
        payment_date=today - timedelta(days=3),
        item="Hotel Room",
        city="Tokyo",
        country="Japan",
        trip_name="Japan Adventure",
        amount_sgd=Decimal("200.00"),
        category="expense"
    )
    trip_data_2 = TravelTransactionCreate(
        user_id=user_id,
        payment_date=today - timedelta(days=2),
        item="Restaurant",
        city="Tokyo",
        country="Japan",
        trip_name="Japan Adventure",
        amount_sgd=Decimal("50.00"),
        category="expense"
    )
    trip_data_3 = TravelTransactionCreate(
        user_id=user_id,
        payment_date=today - timedelta(days=1),
        item="Train Ticket",
        city="Osaka", # Different city - should not be updated
        country="Japan",
        trip_name="Japan Adventure",
        amount_sgd=Decimal("30.00"),
        category="expense"
    )
    
    created_trip_1 = await crud.create(obj_in=trip_data_1)
    created_trip_2 = await crud.create(obj_in=trip_data_2)
    created_trip_3 = await crud.create(obj_in=trip_data_3)
    print(f"  ✅ Created 3 test transactions for bulk rename")
    
    # Perform bulk rename
    updated_count, updated_ids = await crud.bulk_rename_trip(
        user_id=user_id,
        old_trip_name="Japan Adventure",
        old_city="Tokyo",
        old_country="Japan",
        new_trip_name="Tokyo Trip",
        new_city="Tokyo City",
        new_country="Japan"
    )
    
    print(f"  ✅ Bulk rename completed: {updated_count} transactions updated")
    assert updated_count == 2  # Only Tokyo transactions should be updated
    assert len(updated_ids) == 2
    assert created_trip_1.id in updated_ids
    assert created_trip_2.id in updated_ids
    assert created_trip_3.id not in updated_ids  # Osaka transaction should not be updated
    
    # Verify the updates
    updated_trip_1 = await crud.get(id=created_trip_1.id, user_id=user_id)
    updated_trip_2 = await crud.get(id=created_trip_2.id, user_id=user_id)
    unchanged_trip_3 = await crud.get(id=created_trip_3.id, user_id=user_id)
    
    assert updated_trip_1.trip_name == "Tokyo Trip"
    assert updated_trip_1.city == "Tokyo City"
    assert updated_trip_1.country == "Japan"
    
    assert updated_trip_2.trip_name == "Tokyo Trip"
    assert updated_trip_2.city == "Tokyo City"
    assert updated_trip_2.country == "Japan"
    
    # This one should remain unchanged
    assert unchanged_trip_3.trip_name == "Japan Adventure"
    assert unchanged_trip_3.city == "Osaka"
    assert unchanged_trip_3.country == "Japan"
    
    print(f"  ✅ Verified bulk rename results")
    
    # Clean up test transactions
    await crud.remove(id=created_trip_1.id, user_id=user_id)
    await crud.remove(id=created_trip_2.id, user_id=user_id)
    await crud.remove(id=created_trip_3.id, user_id=user_id)
    print(f"  ✅ Cleaned up bulk rename test transactions")

async def main():
    load_dotenv()
    test_user_id_str = os.getenv("TEST_USER_ID")
    if not test_user_id_str:
        print("❌ Error: TEST_USER_ID environment variable not set.")
        return
    from uuid import UUID
    try:
        test_user_id = UUID(test_user_id_str.strip())
    except ValueError:
        print(f"❌ Error: Invalid UUID format for TEST_USER_ID: {test_user_id_str}")
        return
    async with AsyncSessionLocal() as session:
        await test_crud_travel_transaction(session, test_user_id)
    print("\n🏁 All TravelTransaction CRUD tests completed.")

if __name__ == "__main__":
    asyncio.run(main()) 