from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import List, Optional, Union, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from datetime import date

from app.models.weekly_ryhthms import WeeklyRhythm
from app.schemas.weekly_ryhthms import (
    WeeklyRhythmCreate, WeeklyRhythmUpdate
)

class CRUDWeeklyRhythm:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _sync_goals_to_weekly_design_system(self, user_id: UUID, week_start_date: date, next_goals: List[dict]):
        """Sync next_goals to weekly design system."""
        try:
            from app.models.weekly_design_system import WeeklyDesignSystem
            
            # Find corresponding weekly design system
            query = select(WeeklyDesignSystem).where(
                WeeklyDesignSystem.user_id == user_id,
                WeeklyDesignSystem.week_start_date == week_start_date
            )
            result = await self.db.execute(query)
            weekly_design_system = result.scalar_one_or_none()
            
            # Convert rhythm goals to design system goals format
            design_goals = []
            for goal in next_goals:
                design_goals.append({
                    "goal": goal.get("goal", "")
                })
            
            if weekly_design_system:
                # Update existing weekly design system's next_goals
                weekly_design_system.next_goals = design_goals
                await self.db.commit()
                await self.db.refresh(weekly_design_system)
                print(f"✅ Synced goals to existing WeeklyDesignSystem for week {week_start_date}")
            else:
                # Create new weekly design system with proper default structure (3 empty rows)
                new_weekly_design_system = WeeklyDesignSystem(
                    user_id=user_id,
                    week_start_date=week_start_date,
                    next_goals=design_goals,  # Sync the goals
                    personal_goals=[
                        {"goal": ""},
                        {"goal": ""},
                        {"goal": ""}
                    ],
                    time_blocks={
                        "Monday": {},
                        "Tuesday": {},
                        "Wednesday": {},
                        "Thursday": {},
                        "Friday": {},
                        "Saturday": {},
                        "Sunday": {}
                    },
                    daily_checklists={
                        "Monday": {"gratitude": ["", "", "", "", "", ""], "habits": [], "am_protocol": [], "daily_goal_setting": [], "peak_diet": []},
                        "Tuesday": {"gratitude": ["", "", "", "", "", ""], "habits": [], "am_protocol": [], "daily_goal_setting": [], "peak_diet": []},
                        "Wednesday": {"gratitude": ["", "", "", "", "", ""], "habits": [], "am_protocol": [], "daily_goal_setting": [], "peak_diet": []},
                        "Thursday": {"gratitude": ["", "", "", "", "", ""], "habits": [], "am_protocol": [], "daily_goal_setting": [], "peak_diet": []},
                        "Friday": {"gratitude": ["", "", "", "", "", ""], "habits": [], "am_protocol": [], "daily_goal_setting": [], "peak_diet": []},
                        "Saturday": {"gratitude": ["", "", "", "", "", ""], "habits": [], "am_protocol": [], "daily_goal_setting": [], "peak_diet": []},
                        "Sunday": {"gratitude": ["", "", "", "", "", ""], "habits": [], "am_protocol": [], "daily_goal_setting": [], "peak_diet": []}
                    }
                )
                self.db.add(new_weekly_design_system)
                await self.db.commit()
                await self.db.refresh(new_weekly_design_system)
                print(f"✅ Created new WeeklyDesignSystem with synced goals for week {week_start_date}")
                
        except Exception as e:
            # Log error but don't fail the main operation
            print(f"Warning: Failed to sync goals to weekly design system: {str(e)}")

    async def create(self, *, obj_in: WeeklyRhythmCreate) -> WeeklyRhythm:
        """Creates a new WeeklyRhythm."""
        data = obj_in.model_dump()
        db_obj = WeeklyRhythm(**data)
        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            
            # Sync goals to weekly design system
            if db_obj.next_goals:
                await self._sync_goals_to_weekly_design_system(
                    user_id=db_obj.user_id,
                    week_start_date=db_obj.week_start_date,
                    next_goals=db_obj.next_goals
                )
            
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not create WeeklyRhythm: {e}"
            )

    async def get(self, *, id: UUID, user_id: UUID) -> Optional[WeeklyRhythm]:
        """Retrieves a single WeeklyRhythm by its ID and User ID."""
        result = await self.db.execute(
            select(WeeklyRhythm).filter(WeeklyRhythm.id == id, WeeklyRhythm.user_id == user_id)
        )
        return result.scalars().first()

    async def get_by_week(self, *, user_id: UUID, week_start_date: date) -> Optional[WeeklyRhythm]:
        """Retrieves a WeeklyRhythm by week start date and user ID."""
        result = await self.db.execute(
            select(WeeklyRhythm).filter(
                WeeklyRhythm.user_id == user_id,
                WeeklyRhythm.week_start_date == week_start_date
            )
        )
        return result.scalars().first()

    async def get_multi_by_user(
        self, *, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[WeeklyRhythm]:
        """Retrieves WeeklyRhythms for a specific user."""
        query = select(WeeklyRhythm).filter(WeeklyRhythm.user_id == user_id)
        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def update(
        self, *, db_obj: WeeklyRhythm, obj_in: Union[WeeklyRhythmUpdate, Dict[str, Any]]
    ) -> WeeklyRhythm:
        """Updates an existing WeeklyRhythm."""
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
            
            # Sync goals to weekly design system if next_goals were updated
            if 'next_goals' in update_data and db_obj.next_goals:
                await self._sync_goals_to_weekly_design_system(
                    user_id=db_obj.user_id,
                    week_start_date=db_obj.week_start_date,
                    next_goals=db_obj.next_goals
                )
            
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not update WeeklyRhythm: {e}"
            )

    async def remove(self, *, id: UUID, user_id: UUID) -> Optional[WeeklyRhythm]:
        """Deletes a WeeklyRhythm by its ID and User ID."""
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
                    detail=f"Cannot delete WeeklyRhythm due to constraints: {e}"
                )
        return None

# --- Test Functions ---
import os
import asyncio
from dotenv import load_dotenv
from uuid import uuid4
from datetime import date, timedelta
from app.database.database import AsyncSessionLocal
from app.schemas.weekly_ryhthms import WeeklyRhythmCreate, WeeklyRhythmUpdate

async def test_crud_weekly_rhythm(db, user_id):
    print("\n🧪 Testing CRUDWeeklyRhythm...")
    crud = CRUDWeeklyRhythm(db)
    week_start = date.today() - timedelta(days=date.today().weekday())  # This week's Monday
    # Create
    create_data = WeeklyRhythmCreate(
        user_id=user_id,
        week_start_date=week_start,
        most_significant_moment="Test moment",
        goals=[
            {"goal": "Goal 1", "target_completion_by": "Friday"},
            {"goal": "Goal 2", "target_completion_by": "Saturday"}
        ],
        actions=[
            {"action_item": "Action 1", "outcome": "Success"},
            {"action_item": "Action 2", "outcome": "Partial"}
        ],
        challenges=[
            {"challenge": "Challenge 1", "note": "Note 1"},
            {"challenge": "Challenge 2", "note": "Note 2"}
        ],
        next_goals=[
            {"goal": "Next Goal 1", "help_needed": "None"},
            {"goal": "Next Goal 2", "help_needed": "Assistance"}
        ]
    )
    created = await crud.create(obj_in=create_data)
    print(f"✅ Created: {created.id}")
    # Get
    fetched = await crud.get(id=created.id, user_id=user_id)
    assert fetched is not None
    print(f"✅ Fetched: {fetched.id}")
    # Get Multi
    multi = await crud.get_multi_by_user(user_id=user_id)
    assert any(wr.id == created.id for wr in multi)
    print(f"✅ Multi fetch count: {len(multi)}")
    # Update
    update_data = WeeklyRhythmUpdate(most_significant_moment="Updated moment")
    updated = await crud.update(db_obj=fetched, obj_in=update_data)
    assert updated.most_significant_moment == "Updated moment"
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
    from uuid import UUID
    try:
        test_user_id = UUID(test_user_id_str.strip())
    except ValueError:
        print(f"❌ Error: Invalid UUID format for TEST_USER_ID: {test_user_id_str}")
        return
    async with AsyncSessionLocal() as session:
        await test_crud_weekly_rhythm(session, test_user_id)
    print("\n🏁 All WeeklyRhythm CRUD tests completed.")

if __name__ == "__main__":
    asyncio.run(main()) 