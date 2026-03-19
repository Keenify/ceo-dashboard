from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database.database import get_db
from app.schemas.flywheel import (
    FlywheelCreate, FlywheelUpdate, FlywheelResponse
)
from app.crud.flywheel import CRUDFlywheel
# from app.auth.dependencies import get_current_user # Example: Import your auth dependency

router = APIRouter()

# --- Flywheel Endpoints ---
@router.post("/", response_model=FlywheelResponse, status_code=status.HTTP_201_CREATED)
async def create_flywheel(
    *,
    db: AsyncSession = Depends(get_db),
    flywheel_in: FlywheelCreate,
    # Example: Get user ID from dependency
    # current_user: User = Depends(get_current_user), # Assuming you have a User model from auth
) -> FlywheelResponse:
    """Create a new flywheel for the current user."""
    crud = CRUDFlywheel(db)
    # Ensure the user_id in the input matches the authenticated user, or overwrite it.
    # For security, it's often better to ignore user_id from input and use the authenticated user's ID.
    # Example: flywheel_create_data = flywheel_in.model_dump()
    # Example: flywheel_create_data['user_id'] = current_user.id
    # Example: flywheel_create_obj = FlywheelCreate(**flywheel_create_data)

    # Assuming flywheel_in already contains the correct user_id validated elsewhere or passed correctly.
    # If user_id comes from auth dependency, use that instead:
    # flywheel_in_with_user = flywheel_in.model_copy(update={"user_id": current_user.id})
    try:
        flywheel = await crud.create(obj_in=flywheel_in) # Pass the object containing user_id
        return FlywheelResponse.model_validate(flywheel)
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Unexpected error creating flywheel: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {e}"
        )

@router.get("/{flywheel_id}", response_model=FlywheelResponse)
async def get_flywheel(
    *,
    db: AsyncSession = Depends(get_db),
    flywheel_id: UUID, # Changed type hint to UUID
    user_id: UUID # Require user_id (e.g., from query param or auth dependency)
    # Example: current_user: User = Depends(get_current_user),
) -> FlywheelResponse:
    """Get a specific flywheel by ID for the given user."""
    crud = CRUDFlywheel(db)
    # Use current_user.id if using auth dependency
    flywheel = await crud.get(id=flywheel_id, user_id=user_id)
    if not flywheel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flywheel not found"
        )
    return FlywheelResponse.model_validate(flywheel)

@router.get("/", response_model=List[FlywheelResponse])
async def get_flywheels(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID, # Require user_id (e.g., from query param or auth dependency)
    # Example: current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
) -> List[FlywheelResponse]:
    """Get all flywheels for the specified user."""
    crud = CRUDFlywheel(db)
    # Use current_user.id if using auth dependency
    flywheels = await crud.get_multi_by_user(user_id=user_id, skip=skip, limit=limit)
    return [FlywheelResponse.model_validate(fw) for fw in flywheels]

@router.put("/{flywheel_id}", response_model=FlywheelResponse)
async def update_flywheel(
    *,
    db: AsyncSession = Depends(get_db),
    flywheel_id: UUID, # Changed type hint to UUID
    flywheel_in: FlywheelUpdate,
    user_id: UUID # Require user_id (e.g., from query param or auth dependency)
    # Example: current_user: User = Depends(get_current_user),
) -> FlywheelResponse:
    """Update a specific flywheel for the given user."""
    crud = CRUDFlywheel(db)
    # Use current_user.id if using auth dependency
    flywheel = await crud.get(id=flywheel_id, user_id=user_id)
    if not flywheel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flywheel not found"
        )
    try:
        # crud.update assumes the flywheel object already verified ownership
        updated = await crud.update(db_obj=flywheel, obj_in=flywheel_in)
        return FlywheelResponse.model_validate(updated)
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Unexpected error updating flywheel {flywheel_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {e}"
        )

@router.delete("/{flywheel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_flywheel(
    *,
    db: AsyncSession = Depends(get_db),
    flywheel_id: UUID, # Changed type hint to UUID
    user_id: UUID # Require user_id (e.g., from query param or auth dependency)
    # Example: current_user: User = Depends(get_current_user),
) -> None:
    """Delete a specific flywheel for the given user."""
    crud = CRUDFlywheel(db)
    # Use current_user.id if using auth dependency
    # Check existence for the specific user first (done by crud.remove now)
    # flywheel = await crud.get(id=flywheel_id, user_id=user_id)
    # if not flywheel:
    #     raise HTTPException(
    #         status_code=status.HTTP_404_NOT_FOUND,
    #         detail="Flywheel not found"
    #     )
    try:
        deleted_flywheel = await crud.remove(id=flywheel_id, user_id=user_id)
        if deleted_flywheel is None:
             # This means the get inside remove didn't find it for this user
             raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Flywheel not found for this user."
            )
        return None
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Unexpected error deleting flywheel {flywheel_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {e}"
        ) 