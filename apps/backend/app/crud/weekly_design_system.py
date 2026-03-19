from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from datetime import date

from app.models.weekly_design_system import WeeklyDesignSystem
from app.schemas.weekly_design_system import WeeklyDesignSystemCreate, WeeklyDesignSystemUpdate

class CRUDWeeklyDesignSystem:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _sync_goals_to_weekly_rhythms(self, user_id: UUID, week_start_date: date, next_goals: List[dict]):
        """Sync next_goals to weekly rhythms."""
        try:
            from app.models.weekly_ryhthms import WeeklyRhythm
            
            # Find corresponding weekly rhythm
            query = select(WeeklyRhythm).where(
                WeeklyRhythm.user_id == user_id,
                WeeklyRhythm.week_start_date == week_start_date
            )
            result = await self.db.execute(query)
            weekly_rhythm = result.scalar_one_or_none()
            
            # Convert design system goals to rhythm goals format
            rhythm_goals = []
            for goal in next_goals:
                rhythm_goals.append({
                    "goal": goal.get("goal", ""),
                    "help_needed": None  # Default value for help_needed
                })
            
            if weekly_rhythm:
                # Update existing weekly rhythm's next_goals
                weekly_rhythm.next_goals = rhythm_goals
                await self.db.commit()
                await self.db.refresh(weekly_rhythm)
                print(f"✅ Synced goals to existing WeeklyRhythm for week {week_start_date}")
            else:
                # Create new weekly rhythm with proper default structure (3 empty rows)
                new_weekly_rhythm = WeeklyRhythm(
                    user_id=user_id,
                    week_start_date=week_start_date,
                    most_significant_moment="",  # Empty string, not null
                    goals=[
                        {"goal": "", "target_completion_by": ""},
                        {"goal": "", "target_completion_by": ""},
                        {"goal": "", "target_completion_by": ""}
                    ],
                    actions=[
                        {"action_item": "", "outcome": ""},
                        {"action_item": "", "outcome": ""},
                        {"action_item": "", "outcome": ""}
                    ],
                    challenges=[
                        {"challenge": "", "note": ""},
                        {"challenge": "", "note": ""},
                        {"challenge": "", "note": ""}
                    ],
                    next_goals=rhythm_goals  # Sync the goals
                )
                self.db.add(new_weekly_rhythm)
                await self.db.commit()
                await self.db.refresh(new_weekly_rhythm)
                print(f"✅ Created new WeeklyRhythm with synced goals for week {week_start_date}")
                
        except Exception as e:
            # Log error but don't fail the main operation
            print(f"Warning: Failed to sync goals to weekly rhythms: {str(e)}")

    async def create_weekly_design_system(
        self, *, weekly_design_system: WeeklyDesignSystemCreate, user_id: UUID
    ) -> WeeklyDesignSystem:
        """Create a new weekly design system."""
        db_obj = WeeklyDesignSystem(
            user_id=user_id,
            **weekly_design_system.model_dump()
        )
        self.db.add(db_obj)
        await self.db.commit()
        await self.db.refresh(db_obj)
        
        # Sync only next_goals to weekly rhythms
        if db_obj.next_goals:
            await self._sync_goals_to_weekly_rhythms(
                user_id=user_id,
                week_start_date=db_obj.week_start_date,
                next_goals=db_obj.next_goals
            )
        
        return db_obj

    async def get_weekly_design_system(
        self, *, weekly_design_system_id: UUID
    ) -> Optional[WeeklyDesignSystem]:
        """Get a weekly design system by ID."""
        query = select(WeeklyDesignSystem).where(WeeklyDesignSystem.id == weekly_design_system_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_weekly_design_system_by_week(
        self, *, user_id: UUID, week_start_date: date
    ) -> Optional[WeeklyDesignSystem]:
        """Get a weekly design system by week start date and user ID."""
        query = select(WeeklyDesignSystem).where(
            WeeklyDesignSystem.user_id == user_id,
            WeeklyDesignSystem.week_start_date == week_start_date
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_weekly_design_systems(
        self, *, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[WeeklyDesignSystem]:
        """Get all weekly design systems for a user."""
        query = select(WeeklyDesignSystem)\
            .where(WeeklyDesignSystem.user_id == user_id)\
            .offset(skip)\
            .limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_weekly_design_system(
        self, *, weekly_design_system_id: UUID, weekly_design_system_update: WeeklyDesignSystemUpdate
    ) -> Optional[WeeklyDesignSystem]:
        """Update a weekly design system."""
        db_obj = await self.get_weekly_design_system(weekly_design_system_id=weekly_design_system_id)
        if not db_obj:
            return None
        
        update_data = weekly_design_system_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        
        await self.db.commit()
        await self.db.refresh(db_obj)
        
        # Sync only next_goals to weekly rhythms if next_goals were updated
        if 'next_goals' in update_data and db_obj.next_goals:
            await self._sync_goals_to_weekly_rhythms(
                user_id=db_obj.user_id,
                week_start_date=db_obj.week_start_date,
                next_goals=db_obj.next_goals
            )
        
        return db_obj

    async def delete_weekly_design_system(
        self, *, weekly_design_system_id: UUID
    ) -> Optional[WeeklyDesignSystem]:
        """Delete a weekly design system."""
        db_obj = await self.get_weekly_design_system(weekly_design_system_id=weekly_design_system_id)
        if not db_obj:
            return None
        
        await self.db.delete(db_obj)
        await self.db.commit()
        return db_obj

# Create a singleton instance
crud_weekly_design_system = CRUDWeeklyDesignSystem(None)  # DB session will be set per request

# --- Test Functions ---
import os
import asyncio
from dotenv import load_dotenv
from uuid import uuid4
from app.database.database import AsyncSessionLocal

async def test_crud_weekly_design_system(db, user_id):
    print("\n🧪 Testing CRUDWeeklyDesignSystem...")
    crud = CRUDWeeklyDesignSystem(db)
    
    try:
        # Clean up any existing test data for this week
        test_date = date(2024, 3, 18)
        existing_systems = await crud.get_weekly_design_systems(user_id=user_id)
        for system in existing_systems:
            if system.week_start_date == test_date:
                await crud.delete_weekly_design_system(weekly_design_system_id=system.id)
                print(f"🧹 Cleaned up existing test data: {system.id}")
        
        # Create test data
        create_data = WeeklyDesignSystemCreate(
            week_start_date=test_date,
            next_goals=[
                {"goal": "Complete project proposal"},
                {"goal": "Schedule team meeting"},
                {"goal": "Review quarterly reports"}
            ],
            personal_goals=[
                {"goal": "Exercise 3 times this week"},
                {"goal": "Read 1 book chapter"}
            ],
            time_blocks={
                "Monday": {"9:00": "Test Meeting", "10:00": "Test Work"},
                "Tuesday": {"14:00": "Test Planning"}
            },
            daily_checklists={
                "Monday": {
                    "gratitude": ["Test Family", "Test Health"],
                    "habits": ["Test Exercise", "Test Reading"]
                },
                "Tuesday": {
                    "gratitude": ["Test Work"],
                    "habits": ["Test Meditation"]
                }
            }
        )
        created = await crud.create_weekly_design_system(weekly_design_system=create_data, user_id=user_id)
        print(f"✅ Created: {created.id}")
        
        # Get by ID
        fetched = await crud.get_weekly_design_system(weekly_design_system_id=created.id)
        assert fetched is not None
        print(f"✅ Fetched by ID: {fetched.id}")
        
        # Get by Week
        fetched_by_week = await crud.get_weekly_design_system_by_week(
            user_id=user_id, 
            week_start_date=test_date
        )
        assert fetched_by_week is not None
        print(f"✅ Fetched by Week: {fetched_by_week.id}")
        
        # Get Multi
        multi = await crud.get_weekly_design_systems(user_id=user_id)
        assert any(system.id == created.id for system in multi)
        print(f"✅ Multi fetch count: {len(multi)}")
        
        # Update
        update_data = WeeklyDesignSystemUpdate(
            next_goals=[
                {"goal": "Updated Goal 1"},
                {"goal": "Updated Goal 2"}
            ],
            time_blocks={
                "Wednesday": {"11:00": "Updated Meeting"}
            }
        )
        updated = await crud.update_weekly_design_system(
            weekly_design_system_id=created.id,
            weekly_design_system_update=update_data
        )
        assert len(updated.next_goals) == 2
        assert updated.next_goals[0]["goal"] == "Updated Goal 1"
        assert "11:00" in updated.time_blocks["Wednesday"]
        print(f"✅ Updated: {updated.id}")
        
        # Delete
        deleted = await crud.delete_weekly_design_system(weekly_design_system_id=created.id)
        assert deleted is not None
        print(f"✅ Deleted: {deleted.id}")
        
        # Verify deletion
        verify_deleted = await crud.get_weekly_design_system(weekly_design_system_id=created.id)
        assert verify_deleted is None
        print("✅ Verified deletion")
        
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        await db.rollback()
        raise

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
        await test_crud_weekly_design_system(session, test_user_id)
    print("\n🏁 All WeeklyDesignSystem CRUD tests completed.")

if __name__ == "__main__":
    asyncio.run(main()) 