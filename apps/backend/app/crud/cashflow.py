from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import List, Optional, Union, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.models.cashflow import Cashflow
from app.schemas.cashflow import (
    CashflowCreate, CashflowUpdate
)

class CRUDCashflow:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: CashflowCreate) -> Cashflow:
        """Creates a new Cashflow record."""
        data = obj_in.model_dump()
        db_obj = Cashflow(**data)
        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            # Check for specific constraints if needed, e.g., foreign key
            if "cashflow_user_id_fkey" in str(e):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid user_id: {obj_in.user_id}"
                )
            # Check for check constraint violation (though Pydantic should catch it)
            if "cashflow_flow_type_check" in str(e):
                 raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid flow_type: {obj_in.flow_type}"
                 )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not create Cashflow record: {e.orig}" # Show original error context
            )

    async def get(self, *, id: UUID, user_id: UUID) -> Optional[Cashflow]:
        """Retrieves a single Cashflow record by its ID and User ID."""
        result = await self.db.execute(
            select(Cashflow).filter(Cashflow.id == id, Cashflow.user_id == user_id)
        )
        return result.scalars().first()

    async def get_multi_by_user(
        self, *, user_id: UUID,
        skip: int = 0,
        limit: int = 100,
        flow_type: Optional[str] = None,
        return_all: Optional[bool] = False
    ) -> List[Cashflow]:
        """Retrieves Cashflow records for a specific user.

        Args:
            user_id: The user's ID.
            skip: Number of records to skip (pagination).
            limit: Maximum number of records to return (pagination).
            flow_type: Optional filter for 'inflow' or 'outflow'.
            return_all: If True, ignore skip/limit and return all records.

        Returns:
            A list of Cashflow records, ordered by flow_date descending.
        """
        query = select(Cashflow).filter(Cashflow.user_id == user_id)

        # Apply optional flow_type filter
        if flow_type:
            if flow_type not in ['inflow', 'outflow']:
                # Or raise an error, or silently ignore invalid types
                pass # Ignoring invalid flow_type for now
            else:
                query = query.filter(Cashflow.flow_type == flow_type)

        # Apply ordering
        query = query.order_by(Cashflow.flow_date.desc(), Cashflow.created_at.desc())

        # Apply pagination only if return_all is not True
        if not return_all:
            query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        return result.scalars().all()

    async def update(
        self, *, db_obj: Cashflow, obj_in: Union[CashflowUpdate, Dict[str, Any]]
    ) -> Cashflow:
        """Updates an existing Cashflow record."""
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            # Ensure `exclude_unset=True` to only update provided fields
            update_data = obj_in.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(db_obj, field, value)

        self.db.add(db_obj) # Add the updated object to the session
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            # Check for check constraint violation (though Pydantic should catch it)
            if "cashflow_flow_type_check" in str(e):
                 # Extract the invalid value if possible from the error or obj_in
                 invalid_type = update_data.get('flow_type', '[unknown]')
                 raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid flow_type for update: {invalid_type}"
                 )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not update Cashflow record: {e.orig}"
            )

    async def remove(self, *, id: UUID, user_id: UUID) -> Optional[Cashflow]:
        """Deletes a Cashflow record by its ID and User ID."""
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
                    detail=f"Cannot delete Cashflow record: {e.orig}"
                )
        return None # Return None if the object was not found

# --- Test Functions (Adapt as needed) ---
import os
import asyncio
from dotenv import load_dotenv
from uuid import uuid4
from datetime import date, timedelta
from decimal import Decimal
from app.database.database import AsyncSessionLocal
from app.schemas.cashflow import CashflowCreate, CashflowUpdate

async def test_crud_cashflow(db, user_id):
    print("\n🧪 Testing CRUDCashflow...")
    crud = CRUDCashflow(db)
    today = date.today()

    # --- Create Inflow ---
    print("  Test: Create Inflow")
    inflow_data = CashflowCreate(
        user_id=user_id,
        flow_type='inflow',
        amount=Decimal("5000.00"),
        description="Salary Deposit",
        flow_date=today - timedelta(days=5),
        category="Income",
        note="Monthly salary"
    )
    created_inflow = await crud.create(obj_in=inflow_data)
    print(f"  ✅ Created Inflow: {created_inflow.id}, Note: {created_inflow.note}")
    assert created_inflow.flow_type == 'inflow'
    assert created_inflow.amount == Decimal("5000.00")
    assert created_inflow.note == "Monthly salary"

    # --- Create Outflow ---
    print("\n  Test: Create Outflow")
    outflow_data = CashflowCreate(
        user_id=user_id,
        flow_type='outflow',
        amount=Decimal("120.50"),
        description="Utility Bill",
        flow_date=today - timedelta(days=2),
        category="Expenses",
        note="Electricity bill"
    )
    created_outflow = await crud.create(obj_in=outflow_data)
    print(f"  ✅ Created Outflow: {created_outflow.id}, Note: {created_outflow.note}")
    assert created_outflow.flow_type == 'outflow'
    assert created_outflow.note == "Electricity bill"

    # --- Get Inflow ---
    print("\n  Test: Get Inflow")
    fetched_inflow = await crud.get(id=created_inflow.id, user_id=user_id)
    assert fetched_inflow is not None
    assert fetched_inflow.id == created_inflow.id
    print(f"  ✅ Fetched Inflow: {fetched_inflow.id}, Note: {fetched_inflow.note}")

    # --- Get Multi ---
    print("\n  Test: Get Multi")
    multi = await crud.get_multi_by_user(user_id=user_id)
    assert len(multi) >= 2
    assert any(cf.id == created_inflow.id for cf in multi)
    assert any(cf.id == created_outflow.id for cf in multi)
    # Check ordering (most recent first)
    if len(multi) > 1:
        assert multi[0].flow_date >= multi[1].flow_date
    print(f"  ✅ Multi fetch count: {len(multi)}")

    # --- Test Get Multi with filters ---
    print("\n  Test: Get Multi with Filters")
    # Filter inflow
    inflows_only = await crud.get_multi_by_user(user_id=user_id, flow_type='inflow')
    assert len(inflows_only) >= 1
    assert all(cf.flow_type == 'inflow' for cf in inflows_only)
    assert any(cf.id == created_inflow.id for cf in inflows_only)
    print(f"  ✅ Fetched Inflows only: {len(inflows_only)}")

    # Filter outflow
    outflows_only = await crud.get_multi_by_user(user_id=user_id, flow_type='outflow')
    assert len(outflows_only) >= 1
    assert all(cf.flow_type == 'outflow' for cf in outflows_only)
    assert any(cf.id == created_outflow.id for cf in outflows_only)
    print(f"  ✅ Fetched Outflows only: {len(outflows_only)}")

    # Test return_all (should return at least the two we created)
    all_records = await crud.get_multi_by_user(user_id=user_id, return_all=True)
    assert len(all_records) >= 2 # Could be more if previous tests left data
    assert any(cf.id == created_inflow.id for cf in all_records)
    assert any(cf.id == created_outflow.id for cf in all_records)
    print(f"  ✅ Fetched All records: {len(all_records)}")

    # --- Update Inflow ---
    print("\n  Test: Update Inflow")
    update_data = CashflowUpdate(description="Salary Deposit (Updated)", category="Salary", note="Updated note for salary")
    updated_inflow = await crud.update(db_obj=fetched_inflow, obj_in=update_data)
    assert updated_inflow.description == "Salary Deposit (Updated)"
    assert updated_inflow.category == "Salary"
    assert updated_inflow.note == "Updated note for salary"
    assert updated_inflow.amount == Decimal("5000.00") # Amount shouldn't change
    print(f"  ✅ Updated Inflow: {updated_inflow.id}, Note: {updated_inflow.note}")

    # --- Remove Outflow ---
    print("\n  Test: Remove Outflow")
    removed_outflow = await crud.remove(id=created_outflow.id, user_id=user_id)
    assert removed_outflow is not None
    assert removed_outflow.id == created_outflow.id
    print(f"  ✅ Removed Outflow: {removed_outflow.id}")

    # --- Verify Removal ---
    print("\n  Test: Verify Removal")
    verify_removed = await crud.get(id=created_outflow.id, user_id=user_id)
    assert verify_removed is None
    print("  ✅ Verified Outflow removal.")

    # --- Clean up remaining record ---
    await crud.remove(id=created_inflow.id, user_id=user_id)
    print(f"  🧹 Cleaned up Inflow: {created_inflow.id}")


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

    print(f"Using TEST_USER_ID: {test_user_id}")
    async with AsyncSessionLocal() as session:
        try:
            await test_crud_cashflow(session, test_user_id)
            print("\n🏁 All Cashflow CRUD tests completed successfully.")
        except Exception as e:
            print(f"\n❌ An error occurred during testing: {e}")
            import traceback
            traceback.print_exc()
        finally:
            # Ensure changes are rolled back if tests fail midway
            await session.rollback()

if __name__ == "__main__":
    # Ensure the event loop is managed correctly for async main
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Testing interrupted by user.") 