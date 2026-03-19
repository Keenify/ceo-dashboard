from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict
from uuid import UUID

from app.database.database import get_db # Corrected import path
from app.service.module_status_service import get_today_module_updates

router = APIRouter()

@router.get(
    "/today",
    response_model=Dict[str, bool],
    summary="Get Today's Module Completion Status for a User",
    description="Checks if the specified user has completed key actions for today/this week across modules (Weekly Rhythm, Daily Journal, Habits). Requires user_id query parameter."
)
async def read_today_module_status(
    user_id: UUID, # Require user_id as a query parameter (no default)
    db: AsyncSession = Depends(get_db) # Default argument
) -> Dict[str, bool]:
    """
    Retrieves the completion status for tracked modules for the specified user for today/this week (SGT).
    """
    status = await get_today_module_updates(db=db, user_id=user_id)
    return status 