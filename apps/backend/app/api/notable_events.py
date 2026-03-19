from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database.database import get_db
from app.crud.notable_events import CRUDNotableEvent
from app.schemas.notable_events import (
    NotableEventCreate,
    NotableEventUpdate,
    NotableEventResponse
)

router = APIRouter()


@router.post("", response_model=NotableEventResponse, status_code=status.HTTP_201_CREATED)
async def create_notable_event(
    *,
    db: AsyncSession = Depends(get_db),
    event_in: NotableEventCreate
) -> NotableEventResponse:
    """Create a new notable event."""
    crud = CRUDNotableEvent(db)
    try:
        event = await crud.create(obj_in=event_in)
        return NotableEventResponse.model_validate(event)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("", response_model=List[NotableEventResponse])
async def get_notable_events(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID
) -> List[NotableEventResponse]:
    """Get all notable events for a user."""
    crud = CRUDNotableEvent(db)
    events = await crud.get_by_user(user_id=user_id)
    return [NotableEventResponse.model_validate(e) for e in events]


@router.get("/{event_id}", response_model=NotableEventResponse)
async def get_notable_event(
    *,
    db: AsyncSession = Depends(get_db),
    event_id: UUID,
    user_id: UUID
) -> NotableEventResponse:
    """Get a notable event by ID."""
    crud = CRUDNotableEvent(db)
    event = await crud.get(id=event_id, user_id=user_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notable event not found"
        )
    return NotableEventResponse.model_validate(event)


@router.put("/{event_id}", response_model=NotableEventResponse)
async def update_notable_event(
    *,
    db: AsyncSession = Depends(get_db),
    event_id: UUID,
    user_id: UUID,
    event_in: NotableEventUpdate
) -> NotableEventResponse:
    """Update a notable event."""
    crud = CRUDNotableEvent(db)
    event = await crud.get(id=event_id, user_id=user_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notable event not found"
        )
    try:
        updated_event = await crud.update(db_obj=event, obj_in=event_in)
        return NotableEventResponse.model_validate(updated_event)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notable_event(
    *,
    db: AsyncSession = Depends(get_db),
    event_id: UUID,
    user_id: UUID
) -> None:
    """Delete a notable event."""
    crud = CRUDNotableEvent(db)
    event = await crud.get(id=event_id, user_id=user_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notable event not found"
        )
    await crud.remove(id=event_id, user_id=user_id)
