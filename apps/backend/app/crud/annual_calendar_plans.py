from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_, desc, asc
from sqlalchemy.orm import selectinload
from uuid import UUID
from datetime import date, datetime, timedelta
from typing import List, Optional, Union, Dict, Any

from app.models.annual_calendar_plans import AnnualCalendarPlan
from app.schemas.annual_calendar_plans import (
    AnnualCalendarPlanCreate,
    AnnualCalendarPlanUpdate,
    AnnualCalendarPlanFilter
)
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

class CRUDAnnualCalendarPlan:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, obj_in: AnnualCalendarPlanCreate) -> AnnualCalendarPlan:
        """Creates a new Annual Calendar Plan."""
        try:
            db_obj = AnnualCalendarPlan(**obj_in.model_dump())
            self.db.add(db_obj)
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except IntegrityError as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Could not create Annual Calendar Plan: {e}"
            )

    async def get(self, *, id: UUID, user_id: Optional[UUID] = None) -> Optional[AnnualCalendarPlan]:
        """Retrieves a single Annual Calendar Plan by its ID and optionally by user ID."""
        query = select(AnnualCalendarPlan).filter(AnnualCalendarPlan.id == id)
        
        # Add user filter only if user_id is provided
        if user_id is not None:
            query = query.filter(AnnualCalendarPlan.user_id == user_id)
            
        result = await self.db.execute(query)
        return result.scalars().first()

    async def get_multi_by_user(
        self, *, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[AnnualCalendarPlan]:
        """Retrieves Annual Calendar Plans for a specific user."""
        result = await self.db.execute(
            select(AnnualCalendarPlan)
            .filter(AnnualCalendarPlan.user_id == user_id)
            .order_by(desc(AnnualCalendarPlan.start_date))
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    async def get_multi_with_filter(
        self, *, filter_params: AnnualCalendarPlanFilter, skip: int = 0, limit: int = 100
    ) -> List[AnnualCalendarPlan]:
        """Retrieves Annual Calendar Plans with filtering options."""
        query = select(AnnualCalendarPlan)
        
        # Apply filters
        if filter_params.user_id:
            query = query.filter(AnnualCalendarPlan.user_id == filter_params.user_id)
        
        if filter_params.start_date_from:
            query = query.filter(AnnualCalendarPlan.start_date >= filter_params.start_date_from)
        
        if filter_params.start_date_to:
            query = query.filter(AnnualCalendarPlan.start_date <= filter_params.start_date_to)
        
        if filter_params.end_date_from:
            query = query.filter(AnnualCalendarPlan.end_date >= filter_params.end_date_from)
        
        if filter_params.end_date_to:
            query = query.filter(AnnualCalendarPlan.end_date <= filter_params.end_date_to)
        
        if filter_params.title_contains:
            query = query.filter(AnnualCalendarPlan.title.ilike(f"%{filter_params.title_contains}%"))
        
        # Order by start date descending
        query = query.order_by(desc(AnnualCalendarPlan.start_date))
        query = query.offset(skip).limit(limit)
        
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_current_plans(self, *, user_id: UUID, current_date: Optional[date] = None) -> List[AnnualCalendarPlan]:
        """Retrieves Annual Calendar Plans that are currently active (current date falls within plan dates)."""
        if current_date is None:
            current_date = date.today()
        
        result = await self.db.execute(
            select(AnnualCalendarPlan)
            .filter(
                AnnualCalendarPlan.user_id == user_id,
                AnnualCalendarPlan.start_date <= current_date,
                AnnualCalendarPlan.end_date >= current_date
            )
            .order_by(asc(AnnualCalendarPlan.start_date))
        )
        return result.scalars().all()

    async def get_upcoming_plans(self, *, user_id: UUID, from_date: Optional[date] = None, days_ahead: int = 30) -> List[AnnualCalendarPlan]:
        """Retrieves Annual Calendar Plans that are starting in the near future."""
        if from_date is None:
            from_date = date.today()
        
        end_date = from_date + timedelta(days=days_ahead)
        
        result = await self.db.execute(
            select(AnnualCalendarPlan)
            .filter(
                AnnualCalendarPlan.user_id == user_id,
                AnnualCalendarPlan.start_date >= from_date,
                AnnualCalendarPlan.start_date <= end_date
            )
            .order_by(asc(AnnualCalendarPlan.start_date))
        )
        return result.scalars().all()

    async def update(
        self, *, db_obj: AnnualCalendarPlan, obj_in: Union[AnnualCalendarPlanUpdate, Dict[str, Any]]
    ) -> AnnualCalendarPlan:
        """Updates an existing Annual Calendar Plan."""
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)

        # Remove None values to avoid updating with None
        update_data = {k: v for k, v in update_data.items() if v is not None}

        # Update the updated_at timestamp
        update_data['updated_at'] = datetime.utcnow()

        # Validate date constraints if both dates are being updated
        if 'start_date' in update_data and 'end_date' in update_data:
            if update_data['end_date'] < update_data['start_date']:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="End date must be greater than or equal to start date"
                )
        elif 'start_date' in update_data and update_data['start_date'] > db_obj.end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Start date must be less than or equal to current end date"
            )
        elif 'end_date' in update_data and update_data['end_date'] < db_obj.start_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="End date must be greater than or equal to current start date"
            )

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
                detail=f"Could not update Annual Calendar Plan: {e}"
            )

    async def remove(self, *, id: UUID, user_id: UUID) -> Optional[AnnualCalendarPlan]:
        """Deletes an Annual Calendar Plan by its ID and User ID."""
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"CRUD remove called for plan_id: {id}, user_id: {user_id}")
        
        # Get the object to delete
        db_obj = await self.get(id=id, user_id=user_id)
        if not db_obj:
            logger.warning(f"Plan not found in database: plan_id={id}, user_id={user_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Annual Calendar Plan not found"
            )
        
        logger.info(f"Found plan in database: {db_obj.title} (id: {id})")
        
        try:
            # Mark for deletion
            await self.db.delete(db_obj)
            logger.info(f"Marked plan for deletion: {id}")
            
            # Commit the transaction immediately
            await self.db.commit()
            logger.info(f"Successfully committed deletion for plan: {id}")
            
            # Verify the deletion by trying to fetch the record
            verification = await self.get(id=id, user_id=user_id)
            if verification is not None:
                logger.error(f"Plan still exists after deletion: {id}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Plan deletion failed - record still exists"
                )
            
            logger.info(f"Verified deletion successful for plan: {id}")
            return db_obj
            
        except IntegrityError as e:
            logger.error(f"Integrity constraint violation deleting plan {id}: {e}")
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot delete Annual Calendar Plan due to constraints: {e}"
            )
        except Exception as e:
            logger.error(f"Unexpected error deleting plan {id}: {e}")
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete plan: {str(e)}"
            )

    async def count_by_user(self, *, user_id: UUID) -> int:
        """Counts the total number of Annual Calendar Plans for a user."""
        result = await self.db.execute(
            select(AnnualCalendarPlan.id).filter(AnnualCalendarPlan.user_id == user_id)
        )
        return len(list(result.scalars().all()))

    async def get_plans_by_date_range(
        self, *, user_id: UUID, start_date: date, end_date: date
    ) -> List[AnnualCalendarPlan]:
        """Retrieves Annual Calendar Plans that overlap with the given date range."""
        result = await self.db.execute(
            select(AnnualCalendarPlan)
            .filter(
                AnnualCalendarPlan.user_id == user_id,
                # Plans that overlap with the given range
                or_(
                    # Plan starts within the range
                    and_(
                        AnnualCalendarPlan.start_date >= start_date,
                        AnnualCalendarPlan.start_date <= end_date
                    ),
                    # Plan ends within the range
                    and_(
                        AnnualCalendarPlan.end_date >= start_date,
                        AnnualCalendarPlan.end_date <= end_date
                    ),
                    # Plan encompasses the entire range
                    and_(
                        AnnualCalendarPlan.start_date <= start_date,
                        AnnualCalendarPlan.end_date >= end_date
                    )
                )
            )
            .order_by(asc(AnnualCalendarPlan.start_date))
        )
        return result.scalars().all() 