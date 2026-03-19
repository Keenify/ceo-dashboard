from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from datetime import date

from app.database.database import get_db
from app.crud.annual_calendar_plans import CRUDAnnualCalendarPlan
from app.schemas.annual_calendar_plans import (
    AnnualCalendarPlanCreate,
    AnnualCalendarPlanUpdate,
    AnnualCalendarPlan,
    AnnualCalendarPlanFilter,
    AnnualCalendarPlanColorUpdate
)
from app.service.annual_calendar_pdf_service import generate_annual_calendar_pdf

router = APIRouter()

# ================================
# PDF EXPORT (must be before /{plan_id} to avoid path collision)
# ================================

@router.get("/export/pdf")
async def export_annual_calendar_pdf(
    user_id: UUID,
    year: Optional[int] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Export the annual calendar as a landscape A4 PDF with coloured plan bars."""
    from datetime import datetime as dt
    resolved_year = year or dt.now().year

    year_start = date(resolved_year, 1, 1)
    year_end = date(resolved_year, 12, 31)

    crud = CRUDAnnualCalendarPlan(db)
    filter_params = AnnualCalendarPlanFilter(
        user_id=user_id,
        start_date_from=year_start,
        end_date_to=year_end,
    )
    plans = await crud.get_multi_with_filter(filter_params=filter_params, skip=0, limit=1000)
    plans_data = [AnnualCalendarPlan.model_validate(p).model_dump() for p in plans]

    # Convert date objects to ISO strings for the PDF service
    for p in plans_data:
        if isinstance(p.get("start_date"), date):
            p["start_date"] = p["start_date"].isoformat()
        if isinstance(p.get("end_date"), date):
            p["end_date"] = p["end_date"].isoformat()

    pdf_buffer = generate_annual_calendar_pdf(plans_data, resolved_year)
    filename = f"annual_calendar_{resolved_year}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )

# ================================
# BASIC CRUD ENDPOINTS
# ================================

@router.post("/", response_model=AnnualCalendarPlan, status_code=status.HTTP_201_CREATED)
async def create_annual_calendar_plan(
    *,
    db: AsyncSession = Depends(get_db),
    plan_in: AnnualCalendarPlanCreate
) -> AnnualCalendarPlan:
    """Create a new annual calendar plan."""
    crud = CRUDAnnualCalendarPlan(db)
    try:
        plan = await crud.create(obj_in=plan_in)
        return AnnualCalendarPlan.model_validate(plan)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/{plan_id}", response_model=AnnualCalendarPlan)
async def get_annual_calendar_plan(
    *,
    db: AsyncSession = Depends(get_db),
    plan_id: UUID,
    user_id: UUID
) -> AnnualCalendarPlan:
    """Get a specific annual calendar plan."""
    crud = CRUDAnnualCalendarPlan(db)
    plan = await crud.get(id=plan_id, user_id=user_id)
    if not plan or str(plan.user_id) != str(user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Annual calendar plan not found"
        )
    return AnnualCalendarPlan.model_validate(plan)

@router.get("/", response_model=List[AnnualCalendarPlan])
async def get_user_annual_calendar_plans(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID,
    start_date_from: Optional[date] = Query(None),
    start_date_to: Optional[date] = Query(None),
    end_date_from: Optional[date] = Query(None),
    end_date_to: Optional[date] = Query(None),
    title_contains: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000)
) -> List[AnnualCalendarPlan]:
    """Get all annual calendar plans for a user with optional filtering."""
    crud = CRUDAnnualCalendarPlan(db)
    
    # Check if any filters are applied
    has_filters = any([start_date_from, start_date_to, end_date_from, end_date_to, title_contains])
    
    if has_filters:
        # Use filtered query
        filter_params = AnnualCalendarPlanFilter(
            user_id=user_id,
            start_date_from=start_date_from,
            start_date_to=start_date_to,
            end_date_from=end_date_from,
            end_date_to=end_date_to,
            title_contains=title_contains
        )
        plans = await crud.get_multi_with_filter(filter_params=filter_params, skip=skip, limit=limit)
    else:
        # Use simple user query
        plans = await crud.get_multi_by_user(user_id=user_id, skip=skip, limit=limit)
    
    return [AnnualCalendarPlan.model_validate(plan) for plan in plans]

@router.put("/{plan_id}", response_model=AnnualCalendarPlan)
async def update_annual_calendar_plan(
    *,
    db: AsyncSession = Depends(get_db),
    plan_id: UUID,
    user_id: UUID,
    plan_in: AnnualCalendarPlanUpdate
) -> AnnualCalendarPlan:
    """Update an annual calendar plan."""
    crud = CRUDAnnualCalendarPlan(db)
    plan = await crud.get(id=plan_id, user_id=user_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Annual calendar plan not found"
        )
    try:
        updated_plan = await crud.update(db_obj=plan, obj_in=plan_in)
        return AnnualCalendarPlan.model_validate(updated_plan)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_annual_calendar_plan(
    *,
    db: AsyncSession = Depends(get_db),
    plan_id: UUID,
    user_id: UUID
) -> None:
    """Delete an annual calendar plan."""
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Delete request for plan_id: {plan_id}, user_id: {user_id}")
    
    try:
        crud = CRUDAnnualCalendarPlan(db)
        
        # First verify the plan exists and belongs to the user
        plan = await crud.get(id=plan_id, user_id=user_id)
        if not plan:
            logger.warning(f"Plan not found: plan_id={plan_id}, user_id={user_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Annual calendar plan not found"
            )
        
        logger.info(f"Found plan to delete: {plan.title} (id: {plan_id})")
        
        # Perform the deletion
        deleted_plan = await crud.remove(id=plan_id, user_id=user_id)
        
        if deleted_plan:
            logger.info(f"Successfully deleted plan: {deleted_plan.title} (id: {plan_id})")
        else:
            logger.error(f"Failed to delete plan: plan_id={plan_id}, user_id={user_id}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete plan"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error deleting plan {plan_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete plan: {str(e)}"
        )

@router.patch("/{plan_id}/color", response_model=AnnualCalendarPlan)
async def update_plan_color(
    *,
    db: AsyncSession = Depends(get_db),
    plan_id: UUID,
    user_id: UUID,
    color_update: AnnualCalendarPlanColorUpdate
) -> AnnualCalendarPlan:
    """Update only the color of an annual calendar plan."""
    crud = CRUDAnnualCalendarPlan(db)
    plan = await crud.get(id=plan_id, user_id=user_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Annual calendar plan not found"
        )
    
    # Check if color is already the same
    if plan.color == color_update.color:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Color is already set to this value"
        )
    
    try:
        # Create an update object with only the color field
        update_data = AnnualCalendarPlanUpdate(color=color_update.color)
        updated_plan = await crud.update(db_obj=plan, obj_in=update_data)
        return AnnualCalendarPlan.model_validate(updated_plan)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

# ================================
# FILTERED QUERY ENDPOINTS
# ================================

@router.get("/filter/", response_model=List[AnnualCalendarPlan])
async def get_filtered_annual_calendar_plans(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: Optional[UUID] = Query(None),
    start_date_from: Optional[date] = Query(None),
    start_date_to: Optional[date] = Query(None),
    end_date_from: Optional[date] = Query(None),
    end_date_to: Optional[date] = Query(None),
    title_contains: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000)
) -> List[AnnualCalendarPlan]:
    """Get annual calendar plans with filtering options."""
    crud = CRUDAnnualCalendarPlan(db)
    
    # Build filter object
    filter_params = AnnualCalendarPlanFilter(
        user_id=user_id,
        start_date_from=start_date_from,
        start_date_to=start_date_to,
        end_date_from=end_date_from,
        end_date_to=end_date_to,
        title_contains=title_contains
    )
    
    plans = await crud.get_multi_with_filter(
        filter_params=filter_params,
        skip=skip,
        limit=limit
    )
    return [AnnualCalendarPlan.model_validate(plan) for plan in plans]

# ================================
# SPECIALIZED QUERY ENDPOINTS
# ================================

@router.get("/current/", response_model=List[AnnualCalendarPlan])
async def get_current_plans(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID,
    current_date: Optional[date] = Query(None)
) -> List[AnnualCalendarPlan]:
    """Get annual calendar plans that are currently active."""
    crud = CRUDAnnualCalendarPlan(db)
    plans = await crud.get_current_plans(user_id=user_id, current_date=current_date)
    return [AnnualCalendarPlan.model_validate(plan) for plan in plans]

@router.get("/upcoming/", response_model=List[AnnualCalendarPlan])
async def get_upcoming_plans(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID,
    from_date: Optional[date] = Query(None),
    days_ahead: int = Query(30, ge=1, le=365)
) -> List[AnnualCalendarPlan]:
    """Get annual calendar plans that are starting in the near future."""
    crud = CRUDAnnualCalendarPlan(db)
    plans = await crud.get_upcoming_plans(
        user_id=user_id,
        from_date=from_date,
        days_ahead=days_ahead
    )
    return [AnnualCalendarPlan.model_validate(plan) for plan in plans]

@router.get("/date-range/", response_model=List[AnnualCalendarPlan])
async def get_plans_by_date_range(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID,
    start_date: date,
    end_date: date
) -> List[AnnualCalendarPlan]:
    """Get annual calendar plans that overlap with the given date range."""
    crud = CRUDAnnualCalendarPlan(db)
    plans = await crud.get_plans_by_date_range(
        user_id=user_id,
        start_date=start_date,
        end_date=end_date
    )
    return [AnnualCalendarPlan.model_validate(plan) for plan in plans]

# ================================
# STATISTICS ENDPOINTS
# ================================

@router.get("/stats/count")
async def get_plan_count(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID
) -> dict:
    """Get the total count of annual calendar plans for a user."""
    crud = CRUDAnnualCalendarPlan(db)
    count = await crud.count_by_user(user_id=user_id)
    return {"total_plans": count}

@router.get("/stats/summary")
async def get_plans_summary(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID
) -> dict:
    """Get a summary of annual calendar plans for a user."""
    crud = CRUDAnnualCalendarPlan(db)
    
    # Get current plans
    current_plans = await crud.get_current_plans(user_id=user_id)
    
    # Get upcoming plans (next 30 days)
    upcoming_plans = await crud.get_upcoming_plans(user_id=user_id)
    
    # Get total count
    total_count = await crud.count_by_user(user_id=user_id)
    
    return {
        "total_plans": total_count,
        "active_plans": len(current_plans),
        "upcoming_plans": len(upcoming_plans)
    }

# ================================
# BULK OPERATIONS
# ================================

@router.post("/bulk/", response_model=List[AnnualCalendarPlan], status_code=status.HTTP_201_CREATED)
async def create_multiple_plans(
    *,
    db: AsyncSession = Depends(get_db),
    plans_in: List[AnnualCalendarPlanCreate]
) -> List[AnnualCalendarPlan]:
    """Create multiple annual calendar plans at once."""
    crud = CRUDAnnualCalendarPlan(db)
    created_plans = []
    
    for plan_in in plans_in:
        try:
            plan = await crud.create(obj_in=plan_in)
            created_plans.append(AnnualCalendarPlan.model_validate(plan))
        except Exception as e:
            # Log the error but continue with other plans
            print(f"Error creating plan: {e}")
    
    return created_plans

@router.delete("/bulk/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_multiple_plans(
    *,
    db: AsyncSession = Depends(get_db),
    plan_ids: List[UUID] = Query(..., description="List of plan IDs to delete"),
    user_id: UUID
) -> None:
    """Delete multiple annual calendar plans at once."""
    crud = CRUDAnnualCalendarPlan(db)
    
    for plan_id in plan_ids:
        try:
            await crud.remove(id=plan_id, user_id=user_id)
        except Exception as e:
            # Log the error but continue with other deletions
            print(f"Error deleting plan {plan_id}: {e}") 