from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import List, Optional, Union, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
import os
import asyncio
from dotenv import load_dotenv

from app.models.credit_card_instructions import CreditCardInstructions
from app.schemas.credit_card_instructions import (
    CreditCardInstructionsCreate, CreditCardInstructionsUpdate
)
from app.database.database import AsyncSessionLocal

class CRUDCreditCardInstructions:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: CreditCardInstructionsCreate) -> CreditCardInstructions:
        """Creates a new CreditCardInstructions record."""
        data = obj_in.model_dump()
        db_obj = CreditCardInstructions(**data)
        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not create CreditCardInstructions record: {e.orig}"
            )

    async def get(self, *, id: UUID, user_id: UUID) -> Optional[CreditCardInstructions]:
        """Retrieves a single CreditCardInstructions record by its ID and User ID."""
        result = await self.db.execute(
            select(CreditCardInstructions).filter(CreditCardInstructions.id == id, CreditCardInstructions.user_id == user_id)
        )
        return result.scalars().first()

    async def get_multi_by_user(
        self, *, user_id: UUID,
        skip: int = 0,
        limit: int = 100,
        return_all: Optional[bool] = False
    ) -> List[CreditCardInstructions]:
        """Retrieves CreditCardInstructions records for a specific user.
        
        Args:
            user_id: The user's ID.
            skip: Number of records to skip (pagination).
            limit: Maximum number of records to return (pagination).
            return_all: If True, ignore skip/limit and return all records.
            
        Returns:
            A list of CreditCardInstructions records, ordered by created_at descending.
        """
        query = select(CreditCardInstructions).filter(CreditCardInstructions.user_id == user_id)
        query = query.order_by(CreditCardInstructions.created_at.desc())
        
        # Apply pagination only if return_all is not True
        if not return_all:
            query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        return result.scalars().all()

    async def update(
        self, *, db_obj: CreditCardInstructions, obj_in: Union[CreditCardInstructionsUpdate, Dict[str, Any]]
    ) -> CreditCardInstructions:
        """Updates an existing CreditCardInstructions record."""
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
                detail=f"Could not update CreditCardInstructions record: {e.orig}"
            )

    async def remove(self, *, id: UUID, user_id: UUID) -> Optional[CreditCardInstructions]:
        """Deletes a CreditCardInstructions record by its ID and User ID."""
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
                    detail=f"Cannot delete CreditCardInstructions record: {e.orig}"
                )
        return None

async def test_crud_credit_card_instructions(db, user_id):
    print("\n🧪 Testing CRUDCreditCardInstructions...")
    crud = CRUDCreditCardInstructions(db)

    # --- Create First Instruction ---
    print("  Test: Create First Instruction")
    instruction_data1 = CreditCardInstructionsCreate(
        user_id=user_id,
        card_name="Visa",
        payment_day=10,
        description="Monthly payment",
        instruction="Pay the full amount",
        is_paid=False
    )
    created_instruction1 = await crud.create(obj_in=instruction_data1)
    print(f"  ✅ Created Instruction: {created_instruction1.id}, Card Name: {created_instruction1.card_name}")
    assert created_instruction1.card_name == "Visa"

    # --- Create Second Instruction ---
    print("  Test: Create Second Instruction")
    instruction_data2 = CreditCardInstructionsCreate(
        user_id=user_id,
        card_name="MasterCard",
        payment_day=15,
        description="Quarterly payment",
        instruction="Pay minimum amount",
        is_paid=True
    )
    created_instruction2 = await crud.create(obj_in=instruction_data2)
    print(f"  ✅ Created Instruction: {created_instruction2.id}, Card Name: {created_instruction2.card_name}")
    assert created_instruction2.card_name == "MasterCard"

    # --- Get Instruction ---
    print("\n  Test: Get Instruction")
    fetched_instruction = await crud.get(id=created_instruction1.id, user_id=user_id)
    assert fetched_instruction is not None
    assert fetched_instruction.id == created_instruction1.id
    print(f"  ✅ Fetched Instruction: {fetched_instruction.id}, Card Name: {fetched_instruction.card_name}")

    # --- Get Multi with Pagination ---
    print("\n  Test: Get Multi with Pagination")
    multi = await crud.get_multi_by_user(user_id=user_id, limit=1)
    assert len(multi) == 1
    print(f"  ✅ Multi fetch with limit=1: {len(multi)}")

    # --- Get All Records ---
    print("\n  Test: Get All Records")
    all_records = await crud.get_multi_by_user(user_id=user_id, return_all=True)
    assert len(all_records) >= 2
    assert any(instr.id == created_instruction1.id for instr in all_records)
    assert any(instr.id == created_instruction2.id for instr in all_records)
    print(f"  ✅ Fetched All records: {len(all_records)}")

    # --- Update Instruction ---
    print("\n  Test: Update Instruction")
    update_data = CreditCardInstructionsUpdate(card_name="MasterCard Gold", payment_day=20)
    updated_instruction = await crud.update(db_obj=fetched_instruction, obj_in=update_data)
    assert updated_instruction.card_name == "MasterCard Gold"
    assert updated_instruction.payment_day == 20
    print(f"  ✅ Updated Instruction: {updated_instruction.id}, Card Name: {updated_instruction.card_name}")

    # --- Remove Instructions ---
    print("\n  Test: Remove Instructions")
    removed_instruction1 = await crud.remove(id=created_instruction1.id, user_id=user_id)
    assert removed_instruction1 is not None
    assert removed_instruction1.id == created_instruction1.id
    print(f"  ✅ Removed Instruction: {removed_instruction1.id}")
    
    removed_instruction2 = await crud.remove(id=created_instruction2.id, user_id=user_id)
    assert removed_instruction2 is not None
    assert removed_instruction2.id == created_instruction2.id
    print(f"  ✅ Removed Instruction: {removed_instruction2.id}")

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
            await test_crud_credit_card_instructions(session, test_user_id)
            print("\n🏁 All CreditCardInstructions CRUD tests completed successfully.")
        except Exception as e:
            print(f"\n❌ An error occurred during testing: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await session.rollback()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Testing interrupted by user.")
