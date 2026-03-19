import asyncio
from uuid import UUID
from datetime import date, timedelta, datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# Import Models needed for direct querying
from app.models.weekly_ryhthms import WeeklyRhythm
from app.models.journal_entries import JournalEntry as JournalEntryModel
from app.models.habits import Habit, HabitEntry

# We might not need CRUD instances if querying directly,
# but keep imports in case logic changes or other methods are added.
from app.crud.weekly_ryhthms import CRUDWeeklyRhythm
from app.crud.journal_entries import CRUDJournalEntry
from app.crud.habits import CRUDHabit, CRUDHabitEntry

# Import necessary components for testing
import os
from dotenv import load_dotenv
from app.database.database import AsyncSessionLocal


async def get_today_module_updates(db: AsyncSession, user_id: UUID) -> dict:
    """
    Checks if the user has completed key actions for today/this week across modules.

    Args:
        db: The database session.
        user_id: The ID of the user to check.

    Returns:
        A dictionary indicating completion status for each module:
        {
            "weekly_rhythm_completed": bool,
            "daily_journal_completed": bool,
            "habit_tracker_completed": bool
        }
    """
    # Define SGT timezone (UTC+8)
    sgt = timezone(timedelta(hours=8))

    # Get current time in SGT
    now_sgt = datetime.now(sgt)
    today = now_sgt.date()

    # Calculate the start of the current week (Sunday) in SGT
    # today.weekday() is Monday=0, ..., Sunday=6
    # We want Sunday as the start (0)
    days_since_sunday = (today.weekday() + 1) % 7
    current_week_start_sunday = today - timedelta(days=days_since_sunday)

    # --- Check Weekly Rhythm ---
    # Check if a weekly rhythm entry exists for the user for the current week (starting Sunday)
    stmt_weekly = select(WeeklyRhythm.id).filter(
        WeeklyRhythm.user_id == user_id,
        WeeklyRhythm.week_start_date == current_week_start_sunday
    ).limit(1)
    result_weekly = await db.execute(stmt_weekly)
    weekly_rhythm_completed = result_weekly.scalars().first() is not None

    # --- Check Daily Journal ---
    # Check if any journal entry exists for the user for today
    stmt_journal = select(JournalEntryModel.id).filter(
        JournalEntryModel.user_id == user_id,
        JournalEntryModel.entry_date == today
    ).limit(1)
    result_journal = await db.execute(stmt_journal)
    daily_journal_completed = result_journal.scalars().first() is not None

    # --- Check Habit Tracker ---
    habit_tracker_completed = False
    # First, get the IDs of all habits belonging to the user
    habits_result = await db.execute(select(Habit.id).filter(Habit.user_id == user_id))
    habit_ids = habits_result.scalars().all()

    if habit_ids:
        # Check if any habit entry for these habits is marked 'completed' today
        stmt_habit = select(HabitEntry.id).filter(
            HabitEntry.habit_id.in_(habit_ids),
            HabitEntry.entry_date == today,
            HabitEntry.status == 'completed'
        ).limit(1)
        result_habit = await db.execute(stmt_habit)
        habit_tracker_completed = result_habit.scalars().first() is not None

    return {
        "weekly_rhythm_completed": weekly_rhythm_completed,
        "daily_journal_completed": daily_journal_completed,
        "habit_tracker_completed": habit_tracker_completed,
    }


async def main():
    load_dotenv()
    # Example: Load user_id from environment or use a default
    test_user_id_str = os.getenv("TEST_USER_ID", "0ad8a451-c027-4f68-abe6-73d8eeb73abb") # Use env var or fallback
    try:
        user_id = UUID(test_user_id_str)
    except ValueError:
        print(f"Error: Invalid UUID format for user ID: {test_user_id_str}")
        return

    print(f"Checking module updates for user: {user_id}")
    async with AsyncSessionLocal() as session:
        try:
            results = await get_today_module_updates(session, user_id)
            print("Module Update Status:")
            print(results)
        except Exception as e:
            print(f"An error occurred: {e}")

if __name__ == "__main__":
    asyncio.run(main())
