import os
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from typing import List, Optional, Dict
from uuid import UUID, uuid4
from datetime import date, datetime
import asyncio # Added for main guard

from app.database.database import AsyncSessionLocal
from app.models.journal_entries import JournalEntry as JournalEntryModel
from app.schemas.journal_entries import JournalEntryUpsert, JournalEntryBulkUpsert

class CRUDJournalEntry:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def upsert(self, *, entry_in: JournalEntryUpsert) -> JournalEntryModel:
        """Upserts a journal entry based on user_id, template_id, question_id, and entry_date."""
        
        # Check if an entry already exists for this user, template, question, and date
        existing_entry = await self.get_by_user_template_question_date(
            user_id=entry_in.user_id,
            template_id=entry_in.template_id,
            question_id=entry_in.question_id,
            entry_date=entry_in.entry_date
        )

        try:
            if existing_entry:
                # Update existing entry's answer
                existing_entry.answer = entry_in.answer
                # Also update template_id if it was null before
                if existing_entry.template_id is None and entry_in.template_id:
                    existing_entry.template_id = entry_in.template_id
                self.db.add(existing_entry)
                db_obj = existing_entry
                action = "updated"
            else:
                # Create new entry
                entry_data = entry_in.model_dump()
                db_obj = JournalEntryModel(**entry_data)
                self.db.add(db_obj)
                action = "created"

            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            print(f"Database Integrity Error during {action}: {e}")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not {action} journal entry. An entry for this user, template, question, and date might already exist."
            )
        except Exception as e:
            await self.db.rollback()
            print(f"Unexpected error during {action}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An unexpected error occurred while trying to {action} the entry."
            )

    async def bulk_upsert(self, *, bulk_entry: JournalEntryBulkUpsert) -> List[JournalEntryModel]:
        """Bulk upsert journal entries for all questions in a template on a specific date."""
        try:
            results = []
            for question_id, answer in bulk_entry.answers.items():
                if answer.strip():  # Only save non-empty answers
                    entry_data = JournalEntryUpsert(
                        user_id=bulk_entry.user_id,
                        template_id=bulk_entry.template_id,
                        question_id=question_id,
                        entry_date=bulk_entry.entry_date,
                        answer=answer
                    )
                    entry = await self.upsert(entry_in=entry_data)
                    results.append(entry)
            
            return results
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred during bulk upsert"
            )

    async def get(self, id: int) -> Optional[JournalEntryModel]:
        """Retrieves a journal entry by its ID."""
        result = await self.db.execute(select(JournalEntryModel).filter(JournalEntryModel.id == id))
        return result.scalars().first()

    async def get_multi_by_user(
        self, *, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[JournalEntryModel]:
        """Retrieves journal entries for a specific user."""
        result = await self.db.execute(
            select(JournalEntryModel)
            .filter(JournalEntryModel.user_id == user_id)
            .order_by(JournalEntryModel.entry_date.desc(), JournalEntryModel.question_id.asc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    async def get_multi_by_user_and_template(
        self, *, user_id: UUID, template_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[JournalEntryModel]:
        """Retrieves journal entries for a specific user and template."""
        result = await self.db.execute(
            select(JournalEntryModel)
            .filter(
                JournalEntryModel.user_id == user_id,
                JournalEntryModel.template_id == template_id
            )
            .order_by(JournalEntryModel.entry_date.desc(), JournalEntryModel.question_id.asc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    async def get_by_user_template_question_date(
        self, *, user_id: UUID, template_id: Optional[UUID], question_id: int, entry_date: date
    ) -> Optional[JournalEntryModel]:
        """Retrieves a single journal entry for a specific user, template, question, and date."""
        filters = [
            JournalEntryModel.user_id == user_id,
            JournalEntryModel.question_id == question_id,
            JournalEntryModel.entry_date == entry_date
        ]
        
        # Handle template_id properly (can be None)
        if template_id is not None:
            filters.append(JournalEntryModel.template_id == template_id)
        else:
            filters.append(JournalEntryModel.template_id.is_(None))

        result = await self.db.execute(
            select(JournalEntryModel).filter(and_(*filters))
        )
        return result.scalars().first()

    # Legacy method - keep for backward compatibility
    async def get_by_user_date_and_question(
        self, *, user_id: UUID, entry_date: date, question_id: int
    ) -> Optional[JournalEntryModel]:
        """Legacy method: Retrieves a single journal entry for a specific user, date, and question."""
        result = await self.db.execute(
            select(JournalEntryModel).filter(
                JournalEntryModel.user_id == user_id,
                JournalEntryModel.entry_date == entry_date,
                JournalEntryModel.question_id == question_id
            )
        )
        return result.scalars().first()

    async def get_multi_by_user_and_date(
        self, *, user_id: UUID, entry_date: date
    ) -> List[JournalEntryModel]:
        """Retrieves all journal entries for a specific user and date."""
        result = await self.db.execute(
            select(JournalEntryModel).filter(
                JournalEntryModel.user_id == user_id,
                JournalEntryModel.entry_date == entry_date
            ).order_by(JournalEntryModel.question_id.asc())
        )
        return result.scalars().all()

    async def get_multi_by_user_template_and_date(
        self, *, user_id: UUID, template_id: UUID, entry_date: date
    ) -> List[JournalEntryModel]:
        """Retrieves all journal entries for a specific user, template, and date."""
        result = await self.db.execute(
            select(JournalEntryModel).filter(
                JournalEntryModel.user_id == user_id,
                JournalEntryModel.template_id == template_id,
                JournalEntryModel.entry_date == entry_date
            ).order_by(JournalEntryModel.question_id.asc())
        )
        return result.scalars().all()

    async def get_entry_dates_by_user(self, *, user_id: UUID) -> List[date]:
        """Get all unique entry dates for a user."""
        result = await self.db.execute(
            select(JournalEntryModel.entry_date.distinct())
            .filter(JournalEntryModel.user_id == user_id)
            .order_by(JournalEntryModel.entry_date.desc())
        )
        return result.scalars().all()

    async def get_entry_dates_by_user_and_template(self, *, user_id: UUID, template_id: UUID) -> List[date]:
        """Get all unique entry dates for a user and template."""
        result = await self.db.execute(
            select(JournalEntryModel.entry_date.distinct())
            .filter(
                JournalEntryModel.user_id == user_id,
                JournalEntryModel.template_id == template_id
            )
            .order_by(JournalEntryModel.entry_date.desc())
        )
        return result.scalars().all()

    async def remove(self, *, id: int) -> Optional[JournalEntryModel]:
        """Deletes a journal entry by its ID."""
        try:
            db_obj = await self.get(id=id)
            if db_obj:
                await self.db.delete(db_obj)
                await self.db.commit()
            return db_obj
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred while deleting the entry"
            )

# Helper function to format entry details
def format_entry(entry: Optional[JournalEntryModel]) -> str:
    if not entry:
        return "None"
    return (
        f"JournalEntry(id={entry.id}, user_id={entry.user_id}, "
        f"template_id={entry.template_id}, question_id={entry.question_id}, "
        f"entry_date={entry.entry_date}, answer='{entry.answer}', created_at={entry.created_at})"
    )

# Main guard for testing CRUD operations
async def main():
    """Tests the CRUD operations for JournalEntry."""
    print("🧪 Starting CRUDJournalEntry test...")
    test_user_id_str = os.getenv("TEST_USER_ID")
    if not test_user_id_str:
        print("❌ Error: TEST_USER_ID environment variable not set.")
        return
    try:
        test_user_id = UUID(test_user_id_str)
    except ValueError:
        print(f"❌ Error: Invalid UUID format for TEST_USER_ID: {test_user_id_str}")
        return

    test_entry_date = date.today()
    test_template_id = uuid4()  # Generate a test template ID
    entry_id_q1: Optional[int] = None
    entry_id_q2: Optional[int] = None

    async with AsyncSessionLocal() as session:
        crud = CRUDJournalEntry(db=session)

        # --- Test Upsert (Create Q1 with template) ---
        print(f"\n➡️ Testing UPSERT (Create Q1 with template) for user {test_user_id} on {test_entry_date}...")
        entry_to_create_q1 = JournalEntryUpsert(
            user_id=test_user_id,
            template_id=test_template_id,
            question_id=1,
            entry_date=test_entry_date,
            answer="Initial answer for Q1 with template."
        )
        created_entry_q1 = None
        try:
            created_entry_q1 = await crud.upsert(entry_in=entry_to_create_q1)
            print(f"✅ UPSERT (Create Q1) successful: {format_entry(created_entry_q1)}")
            assert created_entry_q1.question_id == 1
            assert created_entry_q1.template_id == test_template_id
            assert created_entry_q1.answer == "Initial answer for Q1 with template."
            entry_id_q1 = created_entry_q1.id
        except Exception as e:
            print(f"❌ UPSERT (Create Q1) failed: {e}")

        # --- Test Bulk Upsert ---
        if entry_id_q1:
            print(f"\n➡️ Testing BULK UPSERT for template {test_template_id}...")
            bulk_entry = JournalEntryBulkUpsert(
                user_id=test_user_id,
                template_id=test_template_id,
                entry_date=test_entry_date,
                answers={
                    1: "Updated Q1 via bulk",
                    2: "New Q2 via bulk",
                    3: "New Q3 via bulk"
                }
            )
            try:
                bulk_results = await crud.bulk_upsert(bulk_entry=bulk_entry)
                print(f"✅ BULK UPSERT successful: {len(bulk_results)} entries processed")
                for entry in bulk_results:
                    print(f"   {format_entry(entry)}")
            except Exception as e:
                print(f"❌ BULK UPSERT failed: {e}")

        print(f"\n✅ Template-aware CRUD test completed.")

    print("\n🏁 CRUDJournalEntry test finished.")

if __name__ == "__main__":
    asyncio.run(main())


