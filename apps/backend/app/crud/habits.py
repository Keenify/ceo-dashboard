from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, asc
from sqlalchemy.orm import selectinload
from uuid import UUID
from datetime import date, datetime, timedelta
from typing import List, Optional, Union, Dict, Any

from app.models.habits import Habit, HabitEntry, HabitStreak, HabitBuddy
from app.schemas.habits import HabitCreate, HabitUpdate, HabitEntryCreate, HabitEntryUpdate, HabitStreakCreate, HabitStreakUpdate, HabitBuddyCreate, HabitBuddyUpdate
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

class CRUDHabit:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: HabitCreate) -> Habit:
        """Creates a new Habit. If sort_order is not provided, set it to the last order + 1 for the user."""
        data = obj_in.model_dump()
        # If sort_order is not provided, set to last + 1 for the user
        if data.get("sort_order") is None:
            result = await self.db.execute(
                select(Habit.sort_order).filter(Habit.user_id == data["user_id"]).order_by(Habit.sort_order.desc())
            )
            last_order = result.scalars().first()
            data["sort_order"] = (last_order + 1) if last_order is not None else 0
        db_obj = Habit(**data)
        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not create Habit: {e}"
            )

    async def get(self, *, id: UUID, user_id: UUID) -> Optional[Habit]:
        """Retrieves a single Habit by its ID and User ID."""
        result = await self.db.execute(
            select(Habit).filter(Habit.id == id, Habit.user_id == user_id)
        )
        return result.scalars().first()

    async def get_multi_by_user(
        self, *, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[Habit]:
        """Retrieves Habits for a specific user."""
        query = select(Habit).filter(Habit.user_id == user_id)
        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def update(
        self, *, db_obj: Habit, obj_in: Union[HabitUpdate, Dict[str, Any]]
    ) -> Habit:
        """Updates an existing Habit. If sort_order is changed, shift other habits accordingly for the user."""
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)

        old_sort_order = db_obj.sort_order
        new_sort_order = update_data.get("sort_order", old_sort_order)
        user_id = db_obj.user_id

        for field, value in update_data.items():
            setattr(db_obj, field, value)

        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            # If sort_order changed, reorder other habits
            if "sort_order" in update_data and new_sort_order != old_sort_order:
                await self._reorder_habits_after_update(user_id, db_obj.id, old_sort_order, new_sort_order)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not update Habit: {e}"
            )

    async def _reorder_habits_after_update(self, user_id: UUID, habit_id: UUID, old_order: int, new_order: int) -> None:
        """
        Shift sort_order for other habits when a habit's sort_order is updated.
        If a habit moves from old_order to new_order, shift others in between accordingly.
        """
        if new_order > old_order:
            # Shift habits with sort_order in (old_order, new_order] down by 1
            result = await self.db.execute(
                select(Habit).filter(
                    Habit.user_id == user_id,
                    Habit.id != habit_id,
                    Habit.sort_order > old_order,
                    Habit.sort_order <= new_order
                )
            )
            habits = result.scalars().all()
            for habit in habits:
                habit.sort_order -= 1
                self.db.add(habit)
        elif new_order < old_order:
            # Shift habits with sort_order in [new_order, old_order) up by 1
            result = await self.db.execute(
                select(Habit).filter(
                    Habit.user_id == user_id,
                    Habit.id != habit_id,
                    Habit.sort_order >= new_order,
                    Habit.sort_order < old_order
                )
            )
            habits = result.scalars().all()
            for habit in habits:
                habit.sort_order += 1
                self.db.add(habit)
        await self.db.commit()

    async def remove(self, *, id: UUID, user_id: UUID) -> Optional[Habit]:
        """Deletes a Habit by its ID and User ID."""
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
                    detail=f"Cannot delete Habit due to constraints: {e}"
                )
        return None

    async def manual_update_sort_order(self, user_id: Optional[UUID] = None) -> None:
        """
        Updates the sort_order of habits for a given user (or all users if user_id is None),
        ordering by created_at ascending. Sets sort_order to 0, 1, 2, ... per user.
        """
        query = select(Habit)
        if user_id:
            query = query.filter(Habit.user_id == user_id)
        query = query.order_by(Habit.user_id.asc(), Habit.created_at.asc())
        result = await self.db.execute(query)
        habits = result.scalars().all()
        # Group by user_id
        from collections import defaultdict
        user_habits = defaultdict(list)
        for habit in habits:
            user_habits[habit.user_id].append(habit)
        for habits_list in user_habits.values():
            for idx, habit in enumerate(habits_list):
                habit.sort_order = idx
                self.db.add(habit)
        await self.db.commit()

class CRUDHabitEntry:
    def __init__(self, db: AsyncSession):
        self.db = db
        self._crud_streak = CRUDHabitStreak(db)

    async def create(self, *, obj_in: HabitEntryCreate) -> HabitEntry:
        """Creates a new HabitEntry and updates the streak."""
        db_obj = HabitEntry(**obj_in.model_dump())
        habit_id = db_obj.habit_id
        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            await self._crud_streak.update_streak(habit_id=habit_id)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not create HabitEntry: {e}"
            )
        except Exception as e:
            print(f"ERROR updating streak after creating entry {db_obj.id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"HabitEntry created, but error updating streak: {e}"
            )

    async def get(self, *, id: UUID, habit_id: UUID) -> Optional[HabitEntry]:
        """Retrieves a single HabitEntry by its ID and Habit ID."""
        result = await self.db.execute(
            select(HabitEntry).filter(HabitEntry.id == id, HabitEntry.habit_id == habit_id)
        )
        return result.scalars().first()

    async def get_multi_by_habit(
        self, *, habit_id: UUID, skip: int = 0, limit: int = 100,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[HabitEntry]:
        """Retrieves HabitEntries for a specific habit with optional date filtering."""
        query = select(HabitEntry).filter(HabitEntry.habit_id == habit_id)
        
        if start_date:
            query = query.filter(HabitEntry.entry_date >= start_date)
        if end_date:
            query = query.filter(HabitEntry.entry_date <= end_date)
            
        query = query.order_by(HabitEntry.entry_date.desc())
        query = query.offset(skip).limit(limit)
        
        result = await self.db.execute(query)
        return result.scalars().all()

    async def update(
        self, *, db_obj: HabitEntry, obj_in: Union[HabitEntryUpdate, Dict[str, Any]]
    ) -> HabitEntry:
        """Updates an existing HabitEntry and recalculates the streak."""
        original_habit_id = db_obj.habit_id
        update_habit_id_later = None

        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)

        new_habit_id = update_data.get('habit_id', original_habit_id)
        if new_habit_id != original_habit_id:
            update_habit_id_later = original_habit_id

        for field, value in update_data.items():
            setattr(db_obj, field, value)

        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)

            await self._crud_streak.update_streak(habit_id=db_obj.habit_id)
            if update_habit_id_later:
                await self._crud_streak.update_streak(habit_id=update_habit_id_later)

            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not update HabitEntry: {e}"
            )
        except Exception as e:
            print(f"ERROR updating streak after updating entry {db_obj.id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"HabitEntry updated, but error updating streak: {e}"
            )

    async def remove(self, *, id: UUID, habit_id: UUID) -> Optional[HabitEntry]:
        """Deletes a HabitEntry and recalculates the streak."""
        db_obj = await self.get(id=id, habit_id=habit_id)
        if db_obj:
            habit_id_to_update = db_obj.habit_id
            await self.db.delete(db_obj)
            try:
                await self.db.commit()
                await self._crud_streak.update_streak(habit_id=habit_id_to_update)
                return db_obj
            except IntegrityError as e:
                await self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Cannot delete HabitEntry due to constraints: {e}"
                )
            except Exception as e:
                print(f"ERROR updating streak after deleting entry {id} for habit {habit_id_to_update}: {e}")
                return db_obj
        return None

class CRUDHabitStreak:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: HabitStreakCreate) -> HabitStreak:
        """Creates a new HabitStreak. (Generally handled by update_streak)"""
        db_obj = HabitStreak(**obj_in.model_dump())
        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not create HabitStreak: {e}"
            )

    async def get(self, *, habit_id: UUID) -> Optional[HabitStreak]:
        """Retrieves a HabitStreak by its Habit ID."""
        result = await self.db.execute(
            select(HabitStreak).filter(HabitStreak.habit_id == habit_id)
        )
        return result.scalars().first()

    async def update(
        self, *, db_obj: HabitStreak, obj_in: Union[HabitStreakUpdate, Dict[str, Any]]
    ) -> HabitStreak:
        """Updates an existing HabitStreak. (Generally handled by update_streak)"""
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
                detail=f"Could not update HabitStreak: {e}"
            )

    async def remove(self, *, habit_id: UUID) -> Optional[HabitStreak]:
        """Deletes a HabitStreak by its Habit ID."""
        db_obj = await self.get(habit_id=habit_id)
        if db_obj:
            await self.db.delete(db_obj)
            try:
                await self.db.commit()
                return db_obj
            except IntegrityError as e:
                await self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Cannot delete HabitStreak due to constraints: {e}"
                )
        return None

    async def update_streak(self, *, habit_id: UUID) -> Optional[HabitStreak]:
        """
        Recalculates and updates the current, longest, and total streak for a habit.
        Streaks only count consecutive days with 'completed' status. Any gap (missed day or not 'completed') resets the streak.
        """
        stmt = (
            select(HabitEntry)
            .filter(HabitEntry.habit_id == habit_id)
            .order_by(asc(HabitEntry.entry_date))
        )
        result = await self.db.execute(stmt)
        entries = result.scalars().all()

        current_streak = 0
        longest_streak = 0
        total_streak = 0
        temp_streak = 0
        last_entry_date: Optional[date] = None
        last_value: Optional[float] = None
        prev_completed_date: Optional[date] = None

        existing_streak_obj = await self.db.get(HabitStreak, habit_id)
        existing_longest = existing_streak_obj.longest_streak if existing_streak_obj else 0

        # Recalculate streaks from scratch using DB data
        longest_streak = 0
        temp_streak = 0
        prev_completed_date = None
        last_entry_date = None
        last_value = None
        for entry in entries:
            entry_date_obj = entry.entry_date
            if isinstance(entry_date_obj, datetime):
                entry_date_obj = entry_date_obj.date()
            if getattr(entry, "status", None) == "completed":
                if prev_completed_date is not None and (entry_date_obj - prev_completed_date).days == 1:
                    temp_streak += 1
                else:
                    temp_streak = 1
                prev_completed_date = entry_date_obj
                total_streak += 1  # Increment total streak for each completed entry
            else:
                temp_streak = 0
                prev_completed_date = None
            if temp_streak > longest_streak:
                longest_streak = temp_streak
            last_entry_date = entry_date_obj
            last_value = getattr(entry, "value", None)

        # Calculate current streak (ending at most recent date)
        current_streak = 0
        if entries:
            # Only if most recent entry is completed
            last_completed = None
            last_completed_idx = None
            for idx, entry in enumerate(reversed(entries)):
                entry_date_obj = entry.entry_date
                if isinstance(entry_date_obj, datetime):
                    entry_date_obj = entry_date_obj.date()
                if getattr(entry, "status", None) == "completed":
                    last_completed = entry_date_obj
                    last_completed_idx = len(entries) - 1 - idx
                    break
            if last_completed is not None and last_completed_idx == len(entries) - 1:
                streak_count = 1
                for j in range(len(entries) - 2, -1, -1):
                    prev_entry = entries[j]
                    prev_entry_date = prev_entry.entry_date
                    if isinstance(prev_entry_date, datetime):
                        prev_entry_date = prev_entry_date.date()
                    if getattr(prev_entry, "status", None) == "completed" and (last_completed - prev_entry_date).days == 1:
                        streak_count += 1
                        last_completed = prev_entry_date
                    else:
                        break
                current_streak = streak_count
            else:
                current_streak = 0
        else:
            current_streak = 0
            last_entry_date = None
            last_value = None
            longest_streak = 0
            total_streak = 0

        streak_obj = await self.db.get(HabitStreak, habit_id)
        if not streak_obj:
            streak_obj = HabitStreak(habit_id=habit_id)
            self.db.add(streak_obj)

        streak_obj.current_streak = current_streak
        streak_obj.longest_streak = longest_streak
        streak_obj.total_streak = total_streak
        streak_obj.last_entry_date = last_entry_date
        streak_obj.last_value = last_value

        try:
            await self.db.commit()
            await self.db.refresh(streak_obj)
            return streak_obj
        except IntegrityError as e:
            await self.db.rollback()
            print(f"ERROR committing streak update for habit {habit_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error saving updated streak: {e}"
            )
        except Exception as e:
            await self.db.rollback()
            print(f"ERROR during streak update commit for habit {habit_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Unexpected error saving updated streak: {e}"
            )

class CRUDHabitBuddy:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: HabitBuddyCreate) -> HabitBuddy:
        """Creates a new HabitBuddy."""
        db_obj = HabitBuddy(**obj_in.model_dump())
        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not create HabitBuddy: {e}"
            )

    async def get(self, *, id: UUID) -> Optional[HabitBuddy]:
        """Retrieves a single HabitBuddy by its ID."""
        result = await self.db.execute(
            select(HabitBuddy).filter(HabitBuddy.id == id)
        )
        return result.scalars().first()

    async def get_by_user(self, *, user_id: UUID) -> List[HabitBuddy]:
        """Retrieves all HabitBuddies for a specific user."""
        result = await self.db.execute(
            select(HabitBuddy).filter(HabitBuddy.user_id == user_id)
        )
        return result.scalars().all()

    async def get_multi(
        self, *, skip: int = 0, limit: int = 100
    ) -> List[HabitBuddy]:
        """Retrieves multiple HabitBuddies."""
        query = select(HabitBuddy).offset(skip).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def update(
        self, *, db_obj: HabitBuddy, obj_in: Union[HabitBuddyUpdate, Dict[str, Any]]
    ) -> HabitBuddy:
        """Updates an existing HabitBuddy."""
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
                detail=f"Could not update HabitBuddy: {e}"
            )

    async def remove(self, *, id: UUID) -> Optional[HabitBuddy]:
        """Deletes a HabitBuddy by its ID."""
        db_obj = await self.get(id=id)
        if db_obj:
            await self.db.delete(db_obj)
            try:
                await self.db.commit()
                return db_obj
            except IntegrityError as e:
                await self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Cannot delete HabitBuddy due to constraints: {e}"
                )
        return None

# --- Test Functions ---
async def test_crud_habit(db: AsyncSession, user_id: UUID) -> None:
    """Test CRUD operations for Habit."""
    print("\n🧪 Testing CRUDHabit...")
    crud = CRUDHabit(db)
    
    # Store IDs for cleanup
    habit_ids = []
    
    try:
        # Test Create with 'build' type
        habit_data_build = HabitCreate(
            user_id=user_id,
            name="Test Build Habit",
            description="Test Description",
            habit_type="build",
            color_code="#FF0000"
        )
        created_habit_build = await crud.create(obj_in=habit_data_build)
        habit_ids.append(created_habit_build.id)
        assert created_habit_build.habit_type == "build"
        print(f"✅ Created build habit: {created_habit_build.name}")
        
        # Test Create with 'break' type
        habit_data_break = HabitCreate(
            user_id=user_id,
            name="Test Break Habit",
            description="Test Description",
            habit_type="break",
            color_code="#00FF00"
        )
        created_habit_break = await crud.create(obj_in=habit_data_break)
        habit_ids.append(created_habit_break.id)
        assert created_habit_break.habit_type == "break"
        print(f"✅ Created break habit: {created_habit_break.name}")
        
        # Test Create with 'track' type
        habit_data_track = HabitCreate(
            user_id=user_id,
            name="Test Track Habit",
            description="Test Description",
            habit_type="track",
            color_code="#0000FF"
        )
        created_habit_track = await crud.create(obj_in=habit_data_track)
        habit_ids.append(created_habit_track.id)
        assert created_habit_track.habit_type == "track"
        print(f"✅ Created track habit: {created_habit_track.name}")
        
        # Test Get for each type
        fetched_habit_build = await crud.get(id=habit_ids[0], user_id=user_id)
        assert fetched_habit_build is not None
        assert fetched_habit_build.habit_type == "build"
        print(f"✅ Retrieved build habit: {fetched_habit_build.name}")
        
        fetched_habit_break = await crud.get(id=habit_ids[1], user_id=user_id)
        assert fetched_habit_break is not None
        assert fetched_habit_break.habit_type == "break"
        print(f"✅ Retrieved break habit: {fetched_habit_break.name}")
        
        fetched_habit_track = await crud.get(id=habit_ids[2], user_id=user_id)
        assert fetched_habit_track is not None
        assert fetched_habit_track.habit_type == "track"
        print(f"✅ Retrieved track habit: {fetched_habit_track.name}")
        
        # Test Update - change types
        update_data_build = HabitUpdate(
            name="Updated Build Habit",
            description="Updated Description",
            habit_type="break"  # Change from build to break
        )
        updated_habit_build = await crud.update(db_obj=fetched_habit_build, obj_in=update_data_build)
        assert updated_habit_build.habit_type == "break"
        print(f"✅ Updated build habit to break: {updated_habit_build.name}")
        
        update_data_break = HabitUpdate(
            name="Updated Break Habit",
            description="Updated Description",
            habit_type="track"  # Change from break to track
        )
        updated_habit_break = await crud.update(db_obj=fetched_habit_break, obj_in=update_data_break)
        assert updated_habit_break.habit_type == "track"
        print(f"✅ Updated break habit to track: {updated_habit_break.name}")
        
        update_data_track = HabitUpdate(
            name="Updated Track Habit",
            description="Updated Description",
            habit_type="build"  # Change from track to build
        )
        updated_habit_track = await crud.update(db_obj=fetched_habit_track, obj_in=update_data_track)
        assert updated_habit_track.habit_type == "build"
        print(f"✅ Updated track habit to build: {updated_habit_track.name}")
        
        # Test Get Multi
        habits = await crud.get_multi_by_user(user_id=user_id)
        assert len(habits) >= 3  # Should have at least our test habits
        print(f"✅ Retrieved {len(habits)} habits")
        
        # Verify all types are present in the results
        habit_types = {h.habit_type for h in habits}
        assert "build" in habit_types
        assert "break" in habit_types
        assert "track" in habit_types
        print("✅ Verified all habit types are present")
        
    except Exception as e:
        print(f"❌ Error during test: {e}")
        raise
    finally:
        # Cleanup
        for habit_id in habit_ids:
            try:
                await crud.remove(id=habit_id, user_id=user_id)
            except Exception as e:
                print(f"⚠️ Warning: Failed to cleanup habit {habit_id}: {e}")
        print("✅ Cleaned up all test habits")

async def test_crud_habit_entry(db: AsyncSession, user_id: UUID) -> None:
    """Test CRUD operations for HabitEntry."""
    print("\n🧪 Testing CRUDHabitEntry...")
    crud_habit = CRUDHabit(db)
    crud_entry = CRUDHabitEntry(db)
    
    # Create a test habit first
    habit_data = HabitCreate(
        user_id=user_id,
        name="Test Habit for Entry",
        habit_type="track",
        color_code="#0000FF"
    )
    test_habit = await crud_habit.create(obj_in=habit_data)
    test_habit_id = test_habit.id  # Store the ID immediately
    print(f"✅ Created test habit: {test_habit.name}")
    
    try:
        # Test Create
        entry_data = HabitEntryCreate(
            habit_id=test_habit_id,
            entry_date=date.today(),
            status="completed",
            note="Test entry",
            value="5.0"
        )
        created_entry = await crud_entry.create(obj_in=entry_data)
        created_entry_id = created_entry.id  # Store the ID immediately
        print(f"✅ Created entry: {created_entry_id}")
        
        # Test Get
        fetched_entry = await crud_entry.get(id=created_entry_id, habit_id=test_habit_id)
        assert fetched_entry is not None
        assert fetched_entry.status == "completed"
        print(f"✅ Retrieved entry: {fetched_entry.id}")
        
        # Test Update
        update_data = HabitEntryUpdate(
            status="skipped",
            note="Updated test entry"
        )
        updated_entry = await crud_entry.update(db_obj=fetched_entry, obj_in=update_data)
        assert updated_entry.status == "skipped"
        print(f"✅ Updated entry: {updated_entry.id}")
        
        # Test Get Multi with date filtering
        entries = await crud_entry.get_multi_by_habit(
            habit_id=test_habit_id,
            start_date=date.today(),
            end_date=date.today()
        )
        assert len(entries) > 0
        print(f"✅ Retrieved {len(entries)} entries with date filtering")
        
        # Cleanup entry
        await crud_entry.remove(id=created_entry_id, habit_id=test_habit_id)
        print("✅ Cleaned up test entry")
    except Exception as e:
        print(f"❌ Error during test: {e}")
        raise
    finally:
        # Cleanup habit using stored ID
        if test_habit_id:
            await crud_habit.remove(id=test_habit_id, user_id=user_id)
            print("✅ Cleaned up test habit")

async def test_crud_habit_streak(db: AsyncSession, user_id: UUID) -> None:
    """Test CRUD operations for HabitStreak."""
    print("\n🧪 Testing CRUDHabitStreak...")
    crud_habit = CRUDHabit(db)
    crud_streak = CRUDHabitStreak(db)
    
    # Create a test habit first
    habit_data = HabitCreate(
        user_id=user_id,
        name="Test Habit for Streak",
        habit_type="build",
        color_code="#00FF00"
    )
    test_habit = await crud_habit.create(obj_in=habit_data)
    test_habit_id = test_habit.id  # Store the ID immediately
    print(f"✅ Created test habit: {test_habit.name}")
    
    try:
        # Test Create
        streak_data = HabitStreakCreate(
            habit_id=test_habit_id,
            current_streak=5,
            longest_streak=10,
            total_streak=15,
            last_entry_date=date.today(),
            last_value="5.0"
        )
        created_streak = await crud_streak.create(obj_in=streak_data)
        print(f"✅ Created streak for habit: {created_streak.habit_id}")
        
        # Test Get
        fetched_streak = await crud_streak.get(habit_id=test_habit_id)
        assert fetched_streak is not None
        assert fetched_streak.current_streak == 5
        print(f"✅ Retrieved streak: current={fetched_streak.current_streak}")
        
        # Test Update
        update_data = HabitStreakUpdate(
            current_streak=6,
            longest_streak=11
        )
        updated_streak = await crud_streak.update(db_obj=fetched_streak, obj_in=update_data)
        assert updated_streak.current_streak == 6
        print(f"✅ Updated streak: current={updated_streak.current_streak}")
        
        # Cleanup streak
        await crud_streak.remove(habit_id=test_habit_id)
        print("✅ Cleaned up test streak")
    except Exception as e:
        print(f"❌ Error during test: {e}")
        raise
    finally:
        # Cleanup habit using stored ID
        if test_habit_id:
            await crud_habit.remove(id=test_habit_id, user_id=user_id)
            print("✅ Cleaned up test habit")

async def test_crud_habit_buddy(db: AsyncSession, user_id: UUID) -> None:
    """Test CRUD operations for HabitBuddy."""
    print("\n🧪 Testing CRUDHabitBuddy...")
    crud_buddy = CRUDHabitBuddy(db)
    
    try:
        # Test Create
        buddy_data = HabitBuddyCreate(
            user_id=user_id,
            buddy_email="test.buddy@example.com"
        )
        created_buddy = await crud_buddy.create(obj_in=buddy_data)
        created_buddy_id = created_buddy.id
        print(f"✅ Created buddy: {created_buddy.buddy_email}")
        
        # Test Get
        fetched_buddy = await crud_buddy.get(id=created_buddy_id)
        assert fetched_buddy is not None
        assert fetched_buddy.buddy_email == "test.buddy@example.com"
        print(f"✅ Retrieved buddy: {fetched_buddy.buddy_email}")
        
        # Test Update
        update_data = HabitBuddyUpdate(
            buddy_email="updated.buddy@example.com"
        )
        updated_buddy = await crud_buddy.update(db_obj=fetched_buddy, obj_in=update_data)
        assert updated_buddy.buddy_email == "updated.buddy@example.com"
        print(f"✅ Updated buddy: {updated_buddy.buddy_email}")
        
        # Test Get by User
        buddies = await crud_buddy.get_by_user(user_id=user_id)
        assert len(buddies) > 0
        print(f"✅ Retrieved {len(buddies)} buddies for user")
        
        # Cleanup buddy
        await crud_buddy.remove(id=created_buddy_id)
        print("✅ Cleaned up test buddy")
    except Exception as e:
        print(f"❌ Error during test: {e}")
        raise

# --- Main Guard for Testing ---
import os
import asyncio
from dotenv import load_dotenv
from app.database.database import AsyncSessionLocal

async def main():
    """Run all habit CRUD tests."""
    load_dotenv()
    print("🚀 Starting habit CRUD tests...")
    
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
        try:
            # Run tests
            await test_crud_habit(session, test_user_id)
            await test_crud_habit_entry(session, test_user_id)
            await test_crud_habit_streak(session, test_user_id)
            await test_crud_habit_buddy(session, test_user_id)
        except Exception as e:
            print(f"❌ Error during testing: {e}")
            raise
        finally:
            await session.close()
    
    print("\n🏁 All habit CRUD tests completed.")

# A function to update streak based on habit id provided
async def update_streak(db: AsyncSession, habit_id: UUID) -> None:
    """Update streak for a given habit ID."""
    crud_streak = CRUDHabitStreak(db)
    await crud_streak.update_streak(habit_id=habit_id)

if __name__ == "__main__":
    # asyncio.run(main()) 

    # Update streaks for all habits
    # async def _update_streak_main():
    #     async with AsyncSessionLocal() as session:
    #         # Get all habits
    #         habits = await session.execute(select(Habit))
    #         for habit in habits.scalars():
    #             await update_streak(session, habit.id)
    #             print(f"✅ Updated streak for habit {habit.id}")
    # asyncio.run(_update_streak_main())

    # manual sort order for all habits for all user 
    # user_id = "0ad8a451-c027-4f68-abe6-73d8eeb73abb"
    # crud_habit = CRUDHabit(db=AsyncSessionLocal())
    # result = asyncio.run(crud_habit.manual_update_sort_order(user_id=UUID(user_id)))
    # print(f"Updated sort order for {result} habits.")

    pass