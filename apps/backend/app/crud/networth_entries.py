from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from uuid import UUID
from typing import List, Optional, Union, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from datetime import date # Added for type hinting

from app.models.networth_entries import NetworthEntry
from app.schemas.networth_entries import (
    NetworthEntryCreate, NetworthEntryUpdate, NetworthSectionRename
)

class CRUDNetworthEntry:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: NetworthEntryCreate) -> NetworthEntry:
        """Creates a new NetworthEntry record."""
        # Pydantic schemas (NetworthType, NetworthCategory) already validate enum values.
        # Database check constraints will provide final validation.
        data = obj_in.model_dump()
        db_obj = NetworthEntry(**data)
        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            detail = "Could not create Networth Entry record due to a data integrity issue."
            if e.orig:
                pg_error_msg = str(e.orig).lower()
                if "networth_entries_user_id_fkey" in pg_error_msg:
                    detail = f"Invalid user_id: {obj_in.user_id}. User does not exist or constraint violated."
                elif "networth_entries_type_check" in pg_error_msg:
                    detail = f"Invalid type: '{obj_in.type}'. Must be 'personal' or 'business'."
                elif "networth_entries_category_check" in pg_error_msg:
                    detail = f"Invalid category: '{obj_in.category}'. Must be 'asset' or 'liability'."
                elif "violates not-null constraint" in pg_error_msg and "section" in pg_error_msg:
                    detail = "Section cannot be empty."
                elif "violates not-null constraint" in pg_error_msg and "snapshot_date" in pg_error_msg:
                    detail = "Snapshot date cannot be empty."
                else:
                    detail = f"Database integrity error: {e.orig}"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, # Generally 400 for validation/constraint issues
                detail=detail
            )
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An unexpected error occurred while creating net worth entry: {str(e)}"
            )

    async def get(self, *, id: UUID, user_id: UUID) -> Optional[NetworthEntry]:
        """Retrieves a single NetworthEntry record by its ID and User ID."""
        result = await self.db.execute(
            select(NetworthEntry).filter(NetworthEntry.id == id, NetworthEntry.user_id == user_id)
        )
        return result.scalars().first()

    async def get_multi_by_user(
        self, *,
        user_id: UUID,
        skip: int = 0,
        limit: int = 100,
        entry_type: Optional[str] = None, # 'type' is a reserved keyword
        category: Optional[str] = None,
        section: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        return_all: Optional[bool] = False
    ) -> List[NetworthEntry]:
        """Retrieves NetworthEntry records for a specific user with filters."""
        query = select(NetworthEntry).filter(NetworthEntry.user_id == user_id)

        if entry_type:
            if entry_type not in ['personal', 'business']:
                # Silently ignore invalid filter values or raise an error
                pass # Or raise HTTPException for bad filter value
            else:
                query = query.filter(NetworthEntry.type == entry_type)
        if category:
            if category not in ['asset', 'liability']:
                pass # Or raise HTTPException
            else:
                query = query.filter(NetworthEntry.category == category)
        if section:
            query = query.filter(NetworthEntry.section.ilike(f"%{section}%"))
        if start_date:
            query = query.filter(NetworthEntry.snapshot_date >= start_date)
        if end_date:
            query = query.filter(NetworthEntry.snapshot_date <= end_date)

        query = query.order_by(NetworthEntry.snapshot_date.desc(), NetworthEntry.section.asc(), NetworthEntry.name.asc(), NetworthEntry.created_at.desc())

        if not return_all:
            query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        return result.scalars().all()

    async def update(
        self, *, db_obj: NetworthEntry, obj_in: Union[NetworthEntryUpdate, Dict[str, Any]]
    ) -> NetworthEntry:
        """Updates an existing NetworthEntry record."""
        update_data = obj_in if isinstance(obj_in, dict) else obj_in.model_dump(exclude_unset=True)

        # Pydantic schema NetworthEntryUpdate with Optional fields handles type validation for provided fields.
        # Database check constraints will provide final validation.

        for field, value in update_data.items():
            setattr(db_obj, field, value)

        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            detail = "Could not update Networth Entry record due to a data integrity issue."
            if e.orig:
                pg_error_msg = str(e.orig).lower()
                # Check for specific constraint violations on update
                if "networth_entries_type_check" in pg_error_msg:
                    invalid_type = update_data.get('type', '[unknown]')
                    detail = f"Invalid type for update: '{invalid_type}'. Must be 'personal' or 'business'."
                elif "networth_entries_category_check" in pg_error_msg:
                    invalid_category = update_data.get('category', '[unknown]')
                    detail = f"Invalid category for update: '{invalid_category}'. Must be 'asset' or 'liability'."
                elif "violates not-null constraint" in pg_error_msg:
                    # Identify which not-null field was violated if possible from update_data
                    for nn_field in ['type', 'category', 'snapshot_date', 'section']:
                        if nn_field in update_data and update_data[nn_field] is None and nn_field in pg_error_msg:
                            detail = f"Field '{nn_field}' cannot be set to null."
                            break
                    else:
                         detail = f"Database integrity error (not-null violation): {e.orig}"
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
                detail=f"An unexpected error occurred while updating net worth entry: {str(e)}"
            )

    async def remove(self, *, id: UUID, user_id: UUID) -> Optional[NetworthEntry]:
        """Deletes a NetworthEntry record by its ID and User ID."""
        db_obj = await self.get(id=id, user_id=user_id)
        if db_obj:
            await self.db.delete(db_obj)
            try:
                await self.db.commit()
                return db_obj
            except IntegrityError as e: # Should be rare due to CASCADE or if no FKs block delete
                await self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT, # Or 500 if unexpected
                    detail=f"Cannot delete Networth Entry record due to conflict: {e.orig}"
                )
            except Exception as e:
                await self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"An unexpected error occurred while deleting net worth entry: {str(e)}"
                )
        return None # Object not found

    async def remove_all_by_name_and_section(self, *, user_id: UUID, name: str, section: str) -> int:
        """Deletes all NetworthEntry records for a user with the given name and section (case-insensitive section match). Returns the number of deleted rows."""
        if not name or not section:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Both 'name' and 'section' must be provided and non-empty."
            )
        try:
            stmt = delete(NetworthEntry).where(
                NetworthEntry.user_id == user_id,
                NetworthEntry.name == name,
                NetworthEntry.section.ilike(section)
            )
            result = await self.db.execute(stmt)
            await self.db.commit()
            return result.rowcount or 0
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An error occurred while deleting entries: {str(e)}"
            )

    async def remove_all_by_section(
        self, *, 
        user_id: UUID, 
        section: str, 
        entry_type: str, 
        entry_category: str
    ) -> int:
        """Deletes all NetworthEntry records for a user in the given section, type, and category. Returns the number of deleted rows."""
        if not section:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Section must be provided and non-empty."
            )
        
        # Validate entry_type and entry_category
        if entry_type not in ['personal', 'business']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid entry_type. Must be 'personal' or 'business'."
            )
        
        if entry_category not in ['asset', 'liability']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid entry_category. Must be 'asset' or 'liability'."
            )
        
        try:
            stmt = delete(NetworthEntry).where(
                NetworthEntry.user_id == user_id,
                NetworthEntry.section == section.strip(),
                NetworthEntry.type == entry_type,
                NetworthEntry.category == entry_category
            )
            result = await self.db.execute(stmt)
            await self.db.commit()
            return result.rowcount or 0
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An error occurred while deleting section entries: {str(e)}"
            )

    async def rename_section(
        self, *, 
        user_id: UUID, 
        old_section_name: str, 
        new_section_name: str,
        entry_type: str,
        entry_category: str
    ) -> int:
        """Renames a section for all NetworthEntry records matching the user_id, old section name, type, and category. Returns the number of updated rows."""
        if not old_section_name or not new_section_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Both 'old_section_name' and 'new_section_name' must be provided and non-empty."
            )
        
        if old_section_name.strip() == new_section_name.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Old and new section names cannot be the same."
            )
        
        # Validate entry_type and entry_category
        if entry_type not in ['personal', 'business']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid entry_type. Must be 'personal' or 'business'."
            )
        
        if entry_category not in ['asset', 'liability']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid entry_category. Must be 'asset' or 'liability'."
            )
        
        try:
            # Use update() to modify all matching records
            from sqlalchemy import update
            stmt = update(NetworthEntry).where(
                NetworthEntry.user_id == user_id,
                NetworthEntry.section == old_section_name.strip(),
                NetworthEntry.type == entry_type,
                NetworthEntry.category == entry_category
            ).values(section=new_section_name.strip())
            
            result = await self.db.execute(stmt)
            await self.db.commit()
            return result.rowcount or 0
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot rename section due to data integrity issue: {str(e.orig) if e.orig else str(e)}"
            )
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An error occurred while renaming section: {str(e)}"
            )

# --- Test Functions (similar to cashflow.py) ---
import os
import asyncio
from dotenv import load_dotenv
from uuid import uuid4 # For generating test IDs
from datetime import date, timedelta
from decimal import Decimal
from app.database.database import AsyncSessionLocal # For creating a session
from app.schemas.networth_entries import NetworthEntryCreate, NetworthEntryUpdate

async def test_crud_networth_entry(db: AsyncSession, user_id: UUID):
    print("\n🧪 Testing CRUDNetworthEntry...")
    crud = CRUDNetworthEntry(db)
    today = date.today()

    # --- Create Entry 1: Minimal (section, type, category, date) ---
    print("  Test: Create Minimal Networth Entry (Personal Asset)")
    entry1_data = NetworthEntryCreate(
        user_id=user_id,
        type='personal',
        category='asset',
        snapshot_date=today - timedelta(days=10),
        section="Retirement Accounts"
        # name and value are None by default in schema if not provided
    )
    created_entry1 = await crud.create(obj_in=entry1_data)
    print(f"  ✅ Created Minimal Entry 1: {created_entry1.id} in section '{created_entry1.section}'")
    assert created_entry1.type == 'personal'
    assert created_entry1.category == 'asset'
    assert created_entry1.section == "Retirement Accounts"
    assert created_entry1.name is None
    assert created_entry1.value is None

    # --- Update Entry 1: Add name and value ---
    print("\n  Test: Update Minimal Entry 1 to add name and value")
    update1_data = NetworthEntryUpdate(
        name="401k - Fidelity",
        value=Decimal("75000.00")
    )
    updated_entry1 = await crud.update(db_obj=created_entry1, obj_in=update1_data)
    print(f"  ✅ Updated Entry 1: {updated_entry1.id} with name '{updated_entry1.name}' and value {updated_entry1.value}")
    assert updated_entry1.name == "401k - Fidelity"
    assert updated_entry1.value == Decimal("75000.00")
    assert updated_entry1.section == "Retirement Accounts" # Should remain unchanged

    # --- Create Entry 2: Full (Business Liability) ---
    print("\n  Test: Create Full Networth Entry (Business Liability)")
    entry2_data = NetworthEntryCreate(
        user_id=user_id,
        type='business',
        category='liability',
        snapshot_date=today - timedelta(days=5),
        section="Business Loans",
        name="SBA Loan",
        value=Decimal("25000.00")
    )
    created_entry2 = await crud.create(obj_in=entry2_data)
    print(f"  ✅ Created Full Entry 2: {created_entry2.id}")
    assert created_entry2.type == 'business'
    assert created_entry2.category == 'liability'
    assert created_entry2.value == Decimal("25000.00")

    # --- Get Entry 2 ---
    print("\n  Test: Get Entry 2")
    fetched_entry2 = await crud.get(id=created_entry2.id, user_id=user_id)
    assert fetched_entry2 is not None
    assert fetched_entry2.id == created_entry2.id
    print(f"  ✅ Fetched Entry 2: {fetched_entry2.id}")

    # --- Get Multi by User ---
    print("\n  Test: Get Multi by User")
    multi_entries = await crud.get_multi_by_user(user_id=user_id, limit=10)
    assert len(multi_entries) >= 2
    assert any(e.id == updated_entry1.id for e in multi_entries)
    assert any(e.id == created_entry2.id for e in multi_entries)
    # Check ordering (most recent snapshot_date first, then section, then name)
    if len(multi_entries) > 1:
        # Entry 2 (5 days ago) should come before Entry 1 (10 days ago)
        entry2_idx = next((i for i, e in enumerate(multi_entries) if e.id == created_entry2.id), -1)
        entry1_idx = next((i for i, e in enumerate(multi_entries) if e.id == updated_entry1.id), -1)
        if entry1_idx != -1 and entry2_idx != -1:
            assert entry2_idx < entry1_idx
    print(f"  ✅ Multi fetch count: {len(multi_entries)}")

    # --- Test Get Multi with Filters ---
    print("\n  Test: Get Multi with Filters")
    # Filter by type 'personal'
    personal_entries = await crud.get_multi_by_user(user_id=user_id, entry_type='personal')
    assert len(personal_entries) >= 1
    assert all(e.type == 'personal' for e in personal_entries)
    assert any(e.id == updated_entry1.id for e in personal_entries)
    print(f"  ✅ Fetched Personal Entries only: {len(personal_entries)}")

    # Filter by category 'liability'
    liability_entries = await crud.get_multi_by_user(user_id=user_id, category='liability')
    assert len(liability_entries) >= 1
    assert all(e.category == 'liability' for e in liability_entries)
    assert any(e.id == created_entry2.id for e in liability_entries)
    print(f"  ✅ Fetched Liability Entries only: {len(liability_entries)}")

    # Filter by section
    retirement_section_entries = await crud.get_multi_by_user(user_id=user_id, section="Retirement Accounts")
    assert len(retirement_section_entries) >= 1
    assert any(e.id == updated_entry1.id for e in retirement_section_entries)
    print(f"  ✅ Fetched 'Retirement Accounts' section: {len(retirement_section_entries)}")

    # --- Update Entry 2: Change section and value ---
    print("\n  Test: Update Full Entry 2")
    update2_data = NetworthEntryUpdate(section="Long-term Business Debt", value=Decimal("22500.50"))
    updated_entry2 = await crud.update(db_obj=fetched_entry2, obj_in=update2_data)
    assert updated_entry2.section == "Long-term Business Debt"
    assert updated_entry2.value == Decimal("22500.50")
    assert updated_entry2.name == "SBA Loan" # Should remain unchanged
    print(f"  ✅ Updated Entry 2: {updated_entry2.id} to section '{updated_entry2.section}'")

    # --- Remove Entry 1 ---
    print("\n  Test: Remove Entry 1")
    removed_entry1 = await crud.remove(id=updated_entry1.id, user_id=user_id)
    assert removed_entry1 is not None
    assert removed_entry1.id == updated_entry1.id
    print(f"  ✅ Removed Entry 1: {removed_entry1.id}")

    # --- Verify Removal of Entry 1 ---
    print("\n  Test: Verify Removal of Entry 1")
    verify_removed1 = await crud.get(id=updated_entry1.id, user_id=user_id)
    assert verify_removed1 is None
    print("  ✅ Verified Entry 1 removal.")

    # --- Clean up remaining record (Entry 2) ---
    await crud.remove(id=created_entry2.id, user_id=user_id)
    print(f"  🧹 Cleaned up Entry 2: {created_entry2.id}")

    # --- Test: Remove All By Name and Section ---
    print("\n  Test: Remove All By Name and Section")
    # Create multiple entries with same name and section
    entry3_data = NetworthEntryCreate(
        user_id=user_id,
        type='personal',
        category='asset',
        snapshot_date=today,
        section="Test Section",
        name="Test Item",
        value=Decimal("100.00")
    )
    entry4_data = NetworthEntryCreate(
        user_id=user_id,
        type='personal',
        category='asset',
        snapshot_date=today,
        section="Test Section",
        name="Test Item",
        value=Decimal("200.00")
    )
    created_entry3 = await crud.create(obj_in=entry3_data)
    created_entry4 = await crud.create(obj_in=entry4_data)
    # Confirm both exist
    entries = await crud.get_multi_by_user(user_id=user_id, section="Test Section")
    assert any(e.id == created_entry3.id for e in entries)
    assert any(e.id == created_entry4.id for e in entries)
    # Remove all by name and section
    deleted_count = await crud.remove_all_by_name_and_section(user_id=user_id, name="Test Item", section="Test Section")
    print(f"  ✅ Deleted {deleted_count} entries with name 'Test Item' in section 'Test Section'")
    assert deleted_count >= 2
    # Confirm deletion
    entries_after = await crud.get_multi_by_user(user_id=user_id, section="Test Section")
    assert all(e.name != "Test Item" for e in entries_after)

    # --- Test: Remove All By Section ---
    print("\n  Test: Remove All By Section")
    # Create multiple entries with different names in same section
    entry5_data = NetworthEntryCreate(
        user_id=user_id,
        type='business',
        category='liability',
        snapshot_date=today,
        section="Section Delete Test",
        name="Item A",
        value=Decimal("300.00")
    )
    entry6_data = NetworthEntryCreate(
        user_id=user_id,
        type='business',
        category='liability',
        snapshot_date=today,
        section="Section Delete Test",
        name="Item B",
        value=Decimal("400.00")
    )
    entry7_data = NetworthEntryCreate(
        user_id=user_id,
        type='business',
        category='liability',
        snapshot_date=today,
        section="Section Delete Test",
        name="Item C",
        value=Decimal("500.00")
    )
    created_entry5 = await crud.create(obj_in=entry5_data)
    created_entry6 = await crud.create(obj_in=entry6_data)
    created_entry7 = await crud.create(obj_in=entry7_data)
    # Confirm all exist
    section_entries = await crud.get_multi_by_user(user_id=user_id, section="Section Delete Test", entry_type='business', category='liability')
    assert len(section_entries) >= 3
    # Remove all by section
    deleted_count = await crud.remove_all_by_section(
        user_id=user_id, 
        section="Section Delete Test", 
        entry_type='business', 
        entry_category='liability'
    )
    print(f"  ✅ Deleted {deleted_count} entries in section 'Section Delete Test'")
    assert deleted_count >= 3
    # Confirm deletion
    section_entries_after = await crud.get_multi_by_user(user_id=user_id, section="Section Delete Test", entry_type='business', category='liability')
    assert len(section_entries_after) == 0

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

    print(f"Using TEST_USER_ID: {test_user_id} for CRUDNetworthEntry direct testing.")
    # Get a new database session for testing
    async with AsyncSessionLocal() as session:
        try:
            await test_crud_networth_entry(session, test_user_id)
            print("\n🏁 All NetworthEntry CRUD tests completed successfully.")
        except AssertionError as ae:
            print(f"\n❌ Assertion Error during testing: {ae}")
            import traceback
            traceback.print_exc()
            await session.rollback() # Rollback on assertion failure
        except HTTPException as he:
            print(f"\n❌ HTTPException during testing: Status {he.status_code}, Detail: {he.detail}")
            import traceback
            traceback.print_exc()
            await session.rollback()
        except Exception as e:
            print(f"\n❌ An unexpected error occurred during testing: {e}")
            import traceback
            traceback.print_exc()
            await session.rollback() # Rollback on any other exception
        # No explicit commit here, as we want each test run to be clean or rolled back on error.
        # If tests pass and you wanted to persist, you would commit, but usually, test data is transient.

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Testing interrupted by user.")
