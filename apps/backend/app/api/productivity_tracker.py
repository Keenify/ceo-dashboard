from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from datetime import date

from app.database.database import get_db
from app.crud.productivity_tracker import CRUDProductivityLegend, CRUDProductivityTracker
from app.schemas.productivity_tracker import (
    ProductivityLegendCreate,
    ProductivityLegendUpdate,
    ProductivityLegendResponse,
    ProductivityTrackerCreate,
    ProductivityTrackerUpdate,
    ProductivityTrackerUpsert,
    ProductivityTrackerResponse,
    HoursDistributionItem
)

router = APIRouter()


# --- Legend Endpoints ---

@router.post("/legends", response_model=ProductivityLegendResponse, status_code=status.HTTP_201_CREATED)
async def create_legend(
    *,
    db: AsyncSession = Depends(get_db),
    legend_in: ProductivityLegendCreate
) -> ProductivityLegendResponse:
    """Create a new productivity legend."""
    crud = CRUDProductivityLegend(db)
    # Get next available number if not provided
    if legend_in.number is None:
        legend_in.number = await crud.get_next_number(user_id=legend_in.user_id)
    try:
        legend = await crud.create(obj_in=legend_in)
        return ProductivityLegendResponse.model_validate(legend)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/legends", response_model=List[ProductivityLegendResponse])
async def get_legends(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID
) -> List[ProductivityLegendResponse]:
    """Get all productivity legends for a user. Initializes defaults if none exist."""
    crud = CRUDProductivityLegend(db)
    legends = await crud.get_by_user(user_id=user_id)

    # Initialize defaults if no legends exist
    if not legends:
        legends = await crud.initialize_defaults(user_id=user_id)

    return [ProductivityLegendResponse.model_validate(l) for l in legends]


@router.get("/legends/{legend_id}", response_model=ProductivityLegendResponse)
async def get_legend(
    *,
    db: AsyncSession = Depends(get_db),
    legend_id: UUID,
    user_id: UUID
) -> ProductivityLegendResponse:
    """Get a productivity legend by ID."""
    crud = CRUDProductivityLegend(db)
    legend = await crud.get(id=legend_id, user_id=user_id)
    if not legend:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Productivity legend not found"
        )
    return ProductivityLegendResponse.model_validate(legend)


@router.put("/legends/{legend_id}", response_model=ProductivityLegendResponse)
async def update_legend(
    *,
    db: AsyncSession = Depends(get_db),
    legend_id: UUID,
    user_id: UUID,
    legend_in: ProductivityLegendUpdate
) -> ProductivityLegendResponse:
    """Update a productivity legend."""
    crud = CRUDProductivityLegend(db)
    legend = await crud.get(id=legend_id, user_id=user_id)
    if not legend:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Productivity legend not found"
        )
    try:
        updated_legend = await crud.update(db_obj=legend, obj_in=legend_in)
        return ProductivityLegendResponse.model_validate(updated_legend)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/legends/{legend_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_legend(
    *,
    db: AsyncSession = Depends(get_db),
    legend_id: UUID,
    user_id: UUID
) -> None:
    """Delete a productivity legend."""
    crud = CRUDProductivityLegend(db)
    legend = await crud.get(id=legend_id, user_id=user_id)
    if not legend:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Productivity legend not found"
        )
    await crud.remove(id=legend_id, user_id=user_id)


# --- Tracker Endpoints ---

@router.post("/tracker", response_model=ProductivityTrackerResponse, status_code=status.HTTP_201_CREATED)
async def upsert_tracker_entry(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID,
    tracker_in: ProductivityTrackerUpsert
) -> ProductivityTrackerResponse:
    """Create or update a productivity tracker entry for a specific date."""
    crud = CRUDProductivityTracker(db)
    try:
        entry = await crud.upsert(user_id=user_id, obj_in=tracker_in)
        return ProductivityTrackerResponse.model_validate(entry)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/tracker", response_model=List[ProductivityTrackerResponse])
async def get_tracker_entries(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID,
    year: Optional[int] = Query(None, description="Year to fetch entries for"),
    start_date: Optional[date] = Query(None, description="Start date for range query"),
    end_date: Optional[date] = Query(None, description="End date for range query")
) -> List[ProductivityTrackerResponse]:
    """Get productivity tracker entries. Use year for full year view, or start_date/end_date for custom range."""
    crud = CRUDProductivityTracker(db)

    if year:
        entries = await crud.get_by_year(user_id=user_id, year=year)
    elif start_date and end_date:
        entries = await crud.get_by_date_range(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date
        )
    else:
        # Default to current year
        from datetime import datetime
        current_year = datetime.now().year
        entries = await crud.get_by_year(user_id=user_id, year=current_year)

    return [ProductivityTrackerResponse.model_validate(e) for e in entries]


@router.get("/tracker/{entry_date}", response_model=ProductivityTrackerResponse)
async def get_tracker_entry_by_date(
    *,
    db: AsyncSession = Depends(get_db),
    entry_date: date,
    user_id: UUID
) -> ProductivityTrackerResponse:
    """Get a productivity tracker entry by date."""
    crud = CRUDProductivityTracker(db)
    entry = await crud.get_by_date(user_id=user_id, entry_date=entry_date)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Productivity tracker entry not found for this date"
        )
    return ProductivityTrackerResponse.model_validate(entry)


@router.put("/tracker/{entry_date}", response_model=ProductivityTrackerResponse)
async def update_tracker_entry(
    *,
    db: AsyncSession = Depends(get_db),
    entry_date: date,
    user_id: UUID,
    tracker_in: ProductivityTrackerUpdate
) -> ProductivityTrackerResponse:
    """Update a productivity tracker entry by date."""
    crud = CRUDProductivityTracker(db)
    entry = await crud.get_by_date(user_id=user_id, entry_date=entry_date)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Productivity tracker entry not found for this date"
        )
    try:
        updated_entry = await crud.update(db_obj=entry, obj_in=tracker_in)
        return ProductivityTrackerResponse.model_validate(updated_entry)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/tracker/{entry_date}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tracker_entry(
    *,
    db: AsyncSession = Depends(get_db),
    entry_date: date,
    user_id: UUID
) -> None:
    """Delete a productivity tracker entry by date."""
    crud = CRUDProductivityTracker(db)
    entry = await crud.get_by_date(user_id=user_id, entry_date=entry_date)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Productivity tracker entry not found for this date"
        )
    await crud.remove_by_date(user_id=user_id, entry_date=entry_date)


# --- Stats Endpoints ---

@router.get("/stats/hours-distribution", response_model=List[HoursDistributionItem])
async def get_hours_distribution(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID
) -> List[HoursDistributionItem]:
    """Get the distribution of hours by legend for a user (all-time stats)."""
    crud = CRUDProductivityTracker(db)
    return await crud.get_hours_distribution(user_id=user_id)
