from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from uuid import UUID
from typing import List, Optional, Union, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from datetime import date, datetime
import os
import asyncio
from dotenv import load_dotenv

from app.models.payment_reminders import PaymentReminder
from app.schemas.payment_reminders import (
    PaymentReminderCreate, PaymentReminderUpdate
)
from app.database.database import AsyncSessionLocal

class CRUDPaymentReminder:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: PaymentReminderCreate) -> PaymentReminder:
        """Creates a new PaymentReminder record."""
        data = obj_in.model_dump()
        db_obj = PaymentReminder(**data)
        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not create PaymentReminder record: {e.orig}"
            )

    async def get(self, *, id: UUID, user_id: UUID) -> Optional[PaymentReminder]:
        """Retrieves a single PaymentReminder record by its ID and User ID."""
        result = await self.db.execute(
            select(PaymentReminder).filter(
                and_(PaymentReminder.id == id, PaymentReminder.user_id == user_id)
            )
        )
        return result.scalars().first()

    async def get_multi_by_user(
        self, *, user_id: UUID,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        return_all: Optional[bool] = False
    ) -> List[PaymentReminder]:
        """Retrieves PaymentReminder records for a specific user.
        
        Args:
            user_id: The user's ID.
            skip: Number of records to skip (pagination).
            limit: Maximum number of records to return (pagination).
            status: Filter by reminder status (pending, sent, failed, cancelled).
            return_all: If True, ignore skip/limit and return all records.
            
        Returns:
            A list of PaymentReminder records, ordered by scheduled_date ascending.
        """
        query = select(PaymentReminder).filter(PaymentReminder.user_id == user_id)
        
        # Add status filter if provided
        if status:
            query = query.filter(PaymentReminder.status == status)
        
        query = query.order_by(PaymentReminder.scheduled_date.asc())
        
        # Apply pagination only if return_all is not True
        if not return_all:
            query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_multi_by_card(
        self, *, card_id: UUID, user_id: UUID,
        status: Optional[str] = None
    ) -> List[PaymentReminder]:
        """Retrieves PaymentReminder records for a specific credit card.
        
        Args:
            card_id: The credit card instruction ID.
            user_id: The user's ID (for security).
            status: Filter by reminder status.
            
        Returns:
            A list of PaymentReminder records for the specified card.
        """
        query = select(PaymentReminder).filter(
            and_(
                PaymentReminder.card_id == card_id,
                PaymentReminder.user_id == user_id
            )
        )
        
        if status:
            query = query.filter(PaymentReminder.status == status)
        
        query = query.order_by(PaymentReminder.scheduled_date.asc())
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_due_today(self, *, target_date: Optional[date] = None) -> List[PaymentReminder]:
        """Retrieves all PaymentReminder records that are due on the specified date.
        
        Args:
            target_date: The date to check for due reminders. Defaults to today.
            
        Returns:
            A list of PaymentReminder records due on the target date with status 'pending'.
        """
        if target_date is None:
            target_date = date.today()
        
        query = select(PaymentReminder).filter(
            and_(
                PaymentReminder.scheduled_date == target_date,
                PaymentReminder.status == 'pending'
            )
        )
        
        result = await self.db.execute(query)
        return result.scalars().all()

    async def update(
        self, *, db_obj: PaymentReminder, obj_in: Union[PaymentReminderUpdate, Dict[str, Any]]
    ) -> PaymentReminder:
        """Updates an existing PaymentReminder record."""
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
                detail=f"Could not update PaymentReminder record: {e.orig}"
            )

    async def mark_as_sent(self, *, reminder_id: UUID, user_id: UUID) -> Optional[PaymentReminder]:
        """Marks a payment reminder as sent with current timestamp."""
        db_obj = await self.get(id=reminder_id, user_id=user_id)
        if db_obj:
            update_data = {
                "status": "sent",
                "sent_at": datetime.now()
            }
            return await self.update(db_obj=db_obj, obj_in=update_data)
        return None

    async def mark_as_failed(self, *, reminder_id: UUID, user_id: UUID) -> Optional[PaymentReminder]:
        """Marks a payment reminder as failed."""
        db_obj = await self.get(id=reminder_id, user_id=user_id)
        if db_obj:
            update_data = {
                "status": "failed"
            }
            return await self.update(db_obj=db_obj, obj_in=update_data)
        return None

    async def cancel_reminders_for_card(self, *, card_id: UUID, user_id: UUID) -> int:
        """Cancels all pending reminders for a specific credit card.
        
        Returns:
            Number of reminders cancelled.
        """
        reminders = await self.get_multi_by_card(
            card_id=card_id, 
            user_id=user_id, 
            status='pending'
        )
        
        cancelled_count = 0
        for reminder in reminders:
            await self.update(db_obj=reminder, obj_in={"status": "cancelled"})
            cancelled_count += 1
        
        return cancelled_count

    async def remove(self, *, id: UUID, user_id: UUID) -> Optional[PaymentReminder]:
        """Deletes a PaymentReminder record by its ID and User ID."""
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
                    detail=f"Cannot delete PaymentReminder record: {e.orig}"
                )
        return None

# --- Test Functions ---
async def test_crud_payment_reminder(db: AsyncSession, user_id: UUID, card_id: UUID) -> None:
    """Test CRUD operations for PaymentReminder."""
    print("\n🧪 Testing CRUDPaymentReminder...")
    crud = CRUDPaymentReminder(db)
    
    # Store IDs for cleanup
    reminder_ids = []
    
    try:
        from datetime import timedelta
        
        # Test Create - Multiple reminders with different statuses and dates
        print("  📝 Testing Create operations...")
        
        # Reminder 1 - Due tomorrow
        reminder_data_1 = PaymentReminderCreate(
            user_id=user_id,
            card_id=card_id,
            scheduled_date=date.today() + timedelta(days=1),
            email="test@example.com",
            days_before_due=3
        )
        created_reminder_1 = await crud.create(obj_in=reminder_data_1)
        reminder_ids.append(created_reminder_1.id)
        assert created_reminder_1.status == "pending"
        assert created_reminder_1.days_before_due == 3
        print(f"    ✅ Created reminder 1: {created_reminder_1.id} (due tomorrow)")
        
        # Reminder 2 - Due in 3 days  
        reminder_data_2 = PaymentReminderCreate(
            user_id=user_id,
            card_id=card_id,
            scheduled_date=date.today() + timedelta(days=3),
            email="test2@example.com",
            days_before_due=5
        )
        created_reminder_2 = await crud.create(obj_in=reminder_data_2)
        reminder_ids.append(created_reminder_2.id)
        assert created_reminder_2.status == "pending"
        print(f"    ✅ Created reminder 2: {created_reminder_2.id} (due in 3 days)")
        
        # Reminder 3 - Due today (for testing get_due_today)
        reminder_data_3 = PaymentReminderCreate(
            user_id=user_id,
            card_id=card_id,
            scheduled_date=date.today(),
            email="test3@example.com",
            days_before_due=2
        )
        created_reminder_3 = await crud.create(obj_in=reminder_data_3)
        reminder_ids.append(created_reminder_3.id)
        print(f"    ✅ Created reminder 3: {created_reminder_3.id} (due today)")
        
        # Test Get
        print("  🔍 Testing Get operations...")
        fetched_reminder = await crud.get(id=created_reminder_1.id, user_id=user_id)
        assert fetched_reminder is not None
        assert fetched_reminder.id == created_reminder_1.id
        assert fetched_reminder.email == "test@example.com"
        print(f"    ✅ Retrieved reminder: {fetched_reminder.id}")
        
        # Test Get Multi by User
        print("  📊 Testing Get Multi by User...")
        user_reminders = await crud.get_multi_by_user(user_id=user_id, return_all=True)
        assert len(user_reminders) >= 3  # Should have at least our test reminders
        print(f"    ✅ Retrieved {len(user_reminders)} reminders for user")
        
        # Test Get Multi by User with status filter
        pending_reminders = await crud.get_multi_by_user(user_id=user_id, status="pending", return_all=True)
        assert len(pending_reminders) >= 3  # All our test reminders should be pending
        print(f"    ✅ Retrieved {len(pending_reminders)} pending reminders")
        
        # Test Get Multi by Card
        print("  💳 Testing Get Multi by Card...")
        card_reminders = await crud.get_multi_by_card(card_id=card_id, user_id=user_id)
        assert len(card_reminders) >= 3  # Should have all our test reminders
        print(f"    ✅ Retrieved {len(card_reminders)} reminders for card")
        
        # Test Get Due Today
        print("  📅 Testing Get Due Today...")
        due_today = await crud.get_due_today(target_date=date.today())
        due_today_for_user = [r for r in due_today if r.user_id == user_id]
        assert len(due_today_for_user) >= 1  # Should have reminder 3
        print(f"    ✅ Retrieved {len(due_today_for_user)} reminders due today for user")
        
        # Test Update
        print("  ✏️  Testing Update operations...")
        update_data = PaymentReminderUpdate(
            email="updated@example.com",
            days_before_due=4
        )
        updated_reminder = await crud.update(db_obj=fetched_reminder, obj_in=update_data)
        assert updated_reminder.email == "updated@example.com"
        assert updated_reminder.days_before_due == 4
        print(f"    ✅ Updated reminder: {updated_reminder.id}")
        
        # Test Mark as Sent
        print("  📧 Testing Mark as Sent...")
        sent_reminder = await crud.mark_as_sent(reminder_id=created_reminder_1.id, user_id=user_id)
        assert sent_reminder is not None
        assert sent_reminder.status == "sent"
        assert sent_reminder.sent_at is not None
        print(f"    ✅ Marked as sent: {sent_reminder.id}")
        
        # Test Mark as Failed
        print("  ❌ Testing Mark as Failed...")
        failed_reminder = await crud.mark_as_failed(reminder_id=created_reminder_2.id, user_id=user_id)
        assert failed_reminder is not None
        assert failed_reminder.status == "failed"
        print(f"    ✅ Marked as failed: {failed_reminder.id}")
        
        # Test Cancel Reminders for Card
        print("  🚫 Testing Cancel Reminders for Card...")
        # First create a few more pending reminders to test cancellation
        for i in range(2):
            temp_reminder_data = PaymentReminderCreate(
                user_id=user_id,
                card_id=card_id,
                scheduled_date=date.today() + timedelta(days=i+5),
                email=f"temp{i}@example.com",
                days_before_due=3
            )
            temp_reminder = await crud.create(obj_in=temp_reminder_data)
            reminder_ids.append(temp_reminder.id)
        
        cancelled_count = await crud.cancel_reminders_for_card(card_id=card_id, user_id=user_id)
        print(f"    ✅ Cancelled {cancelled_count} reminders for card")
        
        # Verify cancellations
        remaining_pending = await crud.get_multi_by_card(card_id=card_id, user_id=user_id, status="pending")
        print(f"    ✅ Verified: {len(remaining_pending)} pending reminders remain")
        
        # Test pagination
        print("  📄 Testing Pagination...")
        page_1 = await crud.get_multi_by_user(user_id=user_id, skip=0, limit=2)
        page_2 = await crud.get_multi_by_user(user_id=user_id, skip=2, limit=2)
        assert len(page_1) <= 2
        assert len(page_2) <= 2
        print(f"    ✅ Page 1: {len(page_1)} reminders, Page 2: {len(page_2)} reminders")
        
    except Exception as e:
        print(f"    ❌ Error during test: {e}")
        raise
    finally:
        # Cleanup - Remove all test reminders
        print("  🧹 Cleaning up test reminders...")
        cleanup_count = 0
        for reminder_id in reminder_ids:
            try:
                removed = await crud.remove(id=reminder_id, user_id=user_id)
                if removed:
                    cleanup_count += 1
            except Exception as e:
                print(f"    ⚠️  Warning: Failed to cleanup reminder {reminder_id}: {e}")
        print(f"    ✅ Cleaned up {cleanup_count} test reminders")

async def main():
    """Run all payment reminder CRUD tests."""
    load_dotenv()
    print("🚀 Starting PaymentReminder CRUD tests...")
    
    # Get test environment variables
    test_user_id_str = os.getenv("TEST_USER_ID")
    test_card_id_str = os.getenv("TEST_CARD_ID")  
    
    if not test_user_id_str:
        print("❌ Error: TEST_USER_ID environment variable not set.")
        print("   Please set TEST_USER_ID in your .env file")
        return
    if not test_card_id_str:
        print("❌ Error: TEST_CARD_ID environment variable not set.")
        print("   Please set TEST_CARD_ID in your .env file")
        return
        
    try:
        test_user_id = UUID(test_user_id_str.strip())
        test_card_id = UUID(test_card_id_str.strip())
    except ValueError as e:
        print(f"❌ Error: Invalid UUID format: {e}")
        print(f"   TEST_USER_ID: {test_user_id_str}")
        print(f"   TEST_CARD_ID: {test_card_id_str}")
        return

    print(f"📋 Using TEST_USER_ID: {test_user_id}")
    print(f"💳 Using TEST_CARD_ID: {test_card_id}")
    
    async with AsyncSessionLocal() as session:
        try:
            # Run payment reminder tests
            await test_crud_payment_reminder(session, test_user_id, test_card_id)
            print("\n🏁 All PaymentReminder CRUD tests completed successfully.")
        except Exception as e:
            print(f"\n❌ Error during testing: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await session.close()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Testing interrupted by user.") 