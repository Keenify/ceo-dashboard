from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from uuid import UUID
from datetime import date
from typing import List, Optional, Union, Dict, Any

from app.models.productivity_tracker import ProductivityLegend, ProductivityTracker
from app.schemas.productivity_tracker import (
    ProductivityLegendCreate,
    ProductivityLegendUpdate,
    ProductivityTrackerCreate,
    ProductivityTrackerUpdate,
    ProductivityTrackerUpsert,
    HoursDistributionItem
)
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError


# Default legends that will be initialized for new users
DEFAULT_LEGENDS = [
    {"number": 0, "name": "Sleep", "color": "#1e1e1e"},
    {"number": 1, "name": "Work", "color": "#3b82f6"},
    {"number": 2, "name": "Hobbies/Projects", "color": "#8b5cf6"},
    {"number": 3, "name": "Freelance", "color": "#f59e0b"},
    {"number": 4, "name": "Exercise", "color": "#22c55e"},
    {"number": 5, "name": "Friends", "color": "#ec4899"},
    {"number": 6, "name": "Relaxation", "color": "#06b6d4"},
    {"number": 7, "name": "Dating/Partner", "color": "#f43f5e"},
    {"number": 8, "name": "Family", "color": "#a855f7"},
    {"number": 9, "name": "Productive/Chores", "color": "#84cc16"},
    {"number": 10, "name": "Travel", "color": "#0ea5e9"},
    {"number": 11, "name": "Misc", "color": "#6b7280"},
]


class CRUDProductivityLegend:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: ProductivityLegendCreate) -> ProductivityLegend:
        """Creates a new ProductivityLegend."""
        db_obj = ProductivityLegend(**obj_in.model_dump())
        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not create ProductivityLegend: {e}"
            )

    async def get(self, *, id: UUID, user_id: UUID) -> Optional[ProductivityLegend]:
        """Retrieves a single legend by ID and user ID."""
        result = await self.db.execute(
            select(ProductivityLegend).filter(
                ProductivityLegend.id == id,
                ProductivityLegend.user_id == user_id
            )
        )
        return result.scalars().first()

    async def get_by_user(self, *, user_id: UUID) -> List[ProductivityLegend]:
        """Retrieves all legends for a specific user, ordered by number."""
        result = await self.db.execute(
            select(ProductivityLegend)
            .filter(ProductivityLegend.user_id == user_id)
            .order_by(ProductivityLegend.number)
        )
        return result.scalars().all()

    async def get_next_number(self, *, user_id: UUID) -> int:
        """Returns the next available legend number for a user."""
        result = await self.db.execute(
            select(func.max(ProductivityLegend.number))
            .filter(ProductivityLegend.user_id == user_id)
        )
        max_number = result.scalar()
        return (max_number + 1) if max_number is not None else 0

    async def initialize_defaults(self, *, user_id: UUID) -> List[ProductivityLegend]:
        """Initializes default legends for a new user."""
        existing = await self.get_by_user(user_id=user_id)
        if existing:
            return existing  # Already initialized

        created_legends = []
        for legend_data in DEFAULT_LEGENDS:
            legend_create = ProductivityLegendCreate(
                user_id=user_id,
                number=legend_data["number"],
                name=legend_data["name"],
                color=legend_data["color"]
            )
            db_obj = ProductivityLegend(**legend_create.model_dump())
            self.db.add(db_obj)
            created_legends.append(db_obj)

        try:
            await self.db.commit()
            for legend in created_legends:
                await self.db.refresh(legend)
            return created_legends
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not initialize default legends: {e}"
            )

    async def update(
        self, *, db_obj: ProductivityLegend, obj_in: Union[ProductivityLegendUpdate, Dict[str, Any]]
    ) -> ProductivityLegend:
        """Updates an existing legend."""
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
                detail=f"Could not update ProductivityLegend: {e}"
            )

    async def remove(self, *, id: UUID, user_id: UUID) -> Optional[ProductivityLegend]:
        """Deletes a legend by ID and user ID."""
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
                    detail=f"Cannot delete ProductivityLegend: {e}"
                )
        return None


class CRUDProductivityTracker:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: ProductivityTrackerCreate) -> ProductivityTracker:
        """Creates a new ProductivityTracker entry."""
        db_obj = ProductivityTracker(**obj_in.model_dump())
        self.db.add(db_obj)
        try:
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not create ProductivityTracker: {e}"
            )

    async def get(self, *, id: UUID, user_id: UUID) -> Optional[ProductivityTracker]:
        """Retrieves a single tracker entry by ID and user ID."""
        result = await self.db.execute(
            select(ProductivityTracker).filter(
                ProductivityTracker.id == id,
                ProductivityTracker.user_id == user_id
            )
        )
        return result.scalars().first()

    async def get_by_date(self, *, user_id: UUID, entry_date: date) -> Optional[ProductivityTracker]:
        """Retrieves a tracker entry by date for a specific user."""
        result = await self.db.execute(
            select(ProductivityTracker).filter(
                ProductivityTracker.user_id == user_id,
                ProductivityTracker.date == entry_date
            )
        )
        return result.scalars().first()

    async def get_by_date_range(
        self, *, user_id: UUID, start_date: date, end_date: date
    ) -> List[ProductivityTracker]:
        """Retrieves tracker entries within a date range."""
        result = await self.db.execute(
            select(ProductivityTracker)
            .filter(
                ProductivityTracker.user_id == user_id,
                ProductivityTracker.date >= start_date,
                ProductivityTracker.date <= end_date
            )
            .order_by(ProductivityTracker.date)
        )
        return result.scalars().all()

    async def get_by_year(self, *, user_id: UUID, year: int) -> List[ProductivityTracker]:
        """Retrieves all tracker entries for a specific year."""
        start_date = date(year, 1, 1)
        end_date = date(year, 12, 31)
        return await self.get_by_date_range(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date
        )

    async def upsert(
        self, *, user_id: UUID, obj_in: ProductivityTrackerUpsert
    ) -> ProductivityTracker:
        """Creates or updates a tracker entry for a specific date."""
        existing = await self.get_by_date(user_id=user_id, entry_date=obj_in.date)

        if existing:
            # Update existing entry
            update_data = obj_in.model_dump(exclude_unset=True, exclude={"date"})
            for field, value in update_data.items():
                if value is not None:
                    setattr(existing, field, value)
            self.db.add(existing)
            try:
                await self.db.commit()
                await self.db.refresh(existing)
                return existing
            except IntegrityError as e:
                await self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Could not update ProductivityTracker: {e}"
                )
        else:
            # Create new entry
            create_data = ProductivityTrackerCreate(
                user_id=user_id,
                date=obj_in.date,
                time_slots=obj_in.time_slots or {},
                spent=obj_in.spent,
                kg=obj_in.kg,
                comments=obj_in.comments
            )
            return await self.create(obj_in=create_data)

    async def update(
        self, *, db_obj: ProductivityTracker, obj_in: Union[ProductivityTrackerUpdate, Dict[str, Any]]
    ) -> ProductivityTracker:
        """Updates an existing tracker entry."""
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
                detail=f"Could not update ProductivityTracker: {e}"
            )

    async def remove(self, *, id: UUID, user_id: UUID) -> Optional[ProductivityTracker]:
        """Deletes a tracker entry by ID and user ID."""
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
                    detail=f"Cannot delete ProductivityTracker: {e}"
                )
        return None

    async def remove_by_date(self, *, user_id: UUID, entry_date: date) -> Optional[ProductivityTracker]:
        """Deletes a tracker entry by date and user ID."""
        db_obj = await self.get_by_date(user_id=user_id, entry_date=entry_date)
        if db_obj:
            await self.db.delete(db_obj)
            try:
                await self.db.commit()
                return db_obj
            except IntegrityError as e:
                await self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Cannot delete ProductivityTracker: {e}"
                )
        return None

    async def get_hours_distribution(self, *, user_id: UUID) -> List[HoursDistributionItem]:
        """
        Gets the distribution of hours by legend for a user.
        Aggregates all time_slots data to count hours per legend.
        """
        # Get all tracker entries for user
        tracker_entries = await self.db.execute(
            select(ProductivityTracker).filter(ProductivityTracker.user_id == user_id)
        )
        entries = tracker_entries.scalars().all()

        # Get all legends for user
        legend_crud = CRUDProductivityLegend(self.db)
        legends = await legend_crud.get_by_user(user_id=user_id)

        # Create a lookup map for legends
        legend_map = {l.number: {"name": l.name, "color": l.color} for l in legends}

        # Count hours per legend number
        hours_count: Dict[int, int] = {}
        for entry in entries:
            if entry.time_slots:
                for hour, legend_number in entry.time_slots.items():
                    if legend_number is not None:
                        hours_count[legend_number] = hours_count.get(legend_number, 0) + 1

        # Build result list
        result = []
        for legend_number, count in sorted(hours_count.items()):
            legend_info = legend_map.get(legend_number, {"name": f"Unknown ({legend_number})", "color": "#6b7280"})
            result.append(HoursDistributionItem(
                legend_number=legend_number,
                legend_name=legend_info["name"],
                legend_color=legend_info["color"],
                hours_count=count
            ))

        return result
