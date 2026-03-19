from typing import List, Optional
from uuid import UUID
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.database.database import get_db
from app.schemas.weekly_design_system import (
    WeeklyDesignSystem,
    WeeklyDesignSystemCreate,
    WeeklyDesignSystemUpdate,
)

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/", response_model=WeeklyDesignSystem, status_code=status.HTTP_201_CREATED)
async def create_weekly_design_system(
    request: Request,
    weekly_design_system_in: WeeklyDesignSystemCreate,
    user_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> WeeklyDesignSystem:
    """Create new weekly design system."""
    try:
        # Log the incoming request data
        logger.info(f"Creating weekly design system for user: {user_id}")
        logger.debug(f"Request data: {weekly_design_system_in.model_dump()}")
        
        from app.crud.weekly_design_system import CRUDWeeklyDesignSystem
        crud = CRUDWeeklyDesignSystem(db)
        
        # Check if weekly design system already exists for this week
        existing_system = await crud.get_weekly_design_system_by_week(
            user_id=user_id, 
            week_start_date=weekly_design_system_in.week_start_date
        )
        
        if existing_system:
            logger.warning(f"Weekly design system already exists for week starting {weekly_design_system_in.week_start_date}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Weekly design system already exists for week starting {weekly_design_system_in.week_start_date}"
            )
        
        # Create new system
        result = await crud.create_weekly_design_system(
            weekly_design_system=weekly_design_system_in, 
            user_id=user_id
        )
        
        logger.info(f"Successfully created weekly design system with ID: {result.id}")
        return result
        
    except HTTPException as he:
        # Re-raise HTTP exceptions as is
        raise he
    except Exception as e:
        logger.error(f"Error creating weekly design system: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating weekly design system: {str(e)}"
        )

@router.get("/{weekly_design_system_id}", response_model=WeeklyDesignSystem)
async def read_weekly_design_system(
    weekly_design_system_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> WeeklyDesignSystem:
    """Get weekly design system by ID."""
    from app.crud.weekly_design_system import CRUDWeeklyDesignSystem
    crud = CRUDWeeklyDesignSystem(db)
    weekly_design_system = await crud.get_weekly_design_system(
        weekly_design_system_id=weekly_design_system_id
    )
    if not weekly_design_system or weekly_design_system.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Weekly design system not found"
        )
    return weekly_design_system

@router.get("/by-week/{week_id}", response_model=WeeklyDesignSystem)
async def read_weekly_design_system_by_week(
    week_id: str,
    user_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> WeeklyDesignSystem:
    """Get weekly design system by week ID."""
    try:
        # Convert the week_id string to a date object
        week_start_date = date.fromisoformat(week_id)
        
        logger.info(f"Fetching weekly design system for user: {user_id}, week: {week_start_date}")
        
        from app.crud.weekly_design_system import CRUDWeeklyDesignSystem
        crud = CRUDWeeklyDesignSystem(db)
        weekly_design_system = await crud.get_weekly_design_system_by_week(
            user_id=user_id, week_start_date=week_start_date
        )
        
        if not weekly_design_system:
            logger.warning(f"Weekly design system not found for week {week_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Weekly design system not found for week {week_id}"
            )
            
        return weekly_design_system
    except ValueError as e:
        # Handle invalid date format
        logger.error(f"Invalid date format: {week_id}. Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid date format: {week_id}. Use YYYY-MM-DD format."
        )
    except HTTPException as e:
        # Re-raise HTTP exceptions as is without wrapping
        raise e
    except Exception as e:
        logger.error(f"Error fetching weekly design system: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error while fetching weekly design system"
        )

@router.get("/", response_model=List[WeeklyDesignSystem])
async def list_weekly_design_systems(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100
) -> List[WeeklyDesignSystem]:
    """Get list of weekly design systems."""
    from app.crud.weekly_design_system import CRUDWeeklyDesignSystem
    crud = CRUDWeeklyDesignSystem(db)
    return await crud.get_weekly_design_systems(
        user_id=user_id, skip=skip, limit=limit
    )

@router.put("/{weekly_design_system_id}", response_model=WeeklyDesignSystem)
async def update_weekly_design_system(
    weekly_design_system_id: UUID,
    weekly_design_system_in: WeeklyDesignSystemUpdate,
    user_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> WeeklyDesignSystem:
    """Update weekly design system."""
    from app.crud.weekly_design_system import CRUDWeeklyDesignSystem
    crud = CRUDWeeklyDesignSystem(db)
    weekly_design_system = await crud.get_weekly_design_system(
        weekly_design_system_id=weekly_design_system_id
    )
    if not weekly_design_system or weekly_design_system.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Weekly design system not found"
        )
    return await crud.update_weekly_design_system(
        weekly_design_system_id=weekly_design_system_id,
        weekly_design_system_update=weekly_design_system_in
    )

@router.delete("/{weekly_design_system_id}", response_model=WeeklyDesignSystem)
async def delete_weekly_design_system(
    weekly_design_system_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> WeeklyDesignSystem:
    """Delete weekly design system."""
    from app.crud.weekly_design_system import CRUDWeeklyDesignSystem
    crud = CRUDWeeklyDesignSystem(db)
    weekly_design_system = await crud.get_weekly_design_system(
        weekly_design_system_id=weekly_design_system_id
    )
    if not weekly_design_system or weekly_design_system.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Weekly design system not found"
        )
    return await crud.delete_weekly_design_system(
        weekly_design_system_id=weekly_design_system_id
    ) 