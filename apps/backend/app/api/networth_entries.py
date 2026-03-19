from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List, Optional
from datetime import date

from app.database.database import get_db
from app.schemas.networth_entries import (
    NetworthEntryCreate,
    NetworthEntryUpdate,
    NetworthEntryResponse,
    NetworthSectionRename,
    NetworthType,      # For query param type hinting
    NetworthCategory   # For query param type hinting
)
from app.crud.networth_entries import CRUDNetworthEntry
# from app.models.user import User # Example: if you have a User model for auth
# from app.api.deps import get_current_active_user # Example: if you have auth dependency

router = APIRouter()

@router.post(
    "/",
    response_model=NetworthEntryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Networth Entry",
    description="Create a new net worth entry for the specified user. Ensure `user_id` in payload is authorized.",
)
async def create_networth_entry(
    *,
    db: AsyncSession = Depends(get_db),
    entry_in: NetworthEntryCreate,
    # current_user: User = Depends(get_current_active_user) # Placeholder for auth
) -> NetworthEntryResponse:
    """
    Create a new net worth entry.
    Ensure the `user_id` in `entry_in` payload matches the authenticated user
    or the authenticated user has administrative privileges.
    """
    # Example Authorization (replace with your actual auth logic):
    # if entry_in.user_id != current_user.id and not current_user.is_superuser:
    #     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to create entry for this user")

    crud = CRUDNetworthEntry(db)
    try:
        created_entry = await crud.create(obj_in=entry_in)
        # Return validated response data
        return NetworthEntryResponse.model_validate(created_entry)
    except HTTPException as http_exc:
        raise http_exc # Re-raise HTTPExceptions from CRUD layer (e.g., 400 for bad data)
    except Exception as e:
        await db.rollback() # Ensure rollback if not handled in CRUD
        # In a production app, log the error `e` here
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}" # Avoid exposing too much detail in prod
        )

@router.get(
    "/",
    response_model=List[NetworthEntryResponse],
    summary="Read Networth Entries for a User",
    description="Retrieve net worth entries for a user with optional filters and pagination. Requires `user_id` query parameter.",
)
async def read_networth_entries(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Query(..., description="The ID of the user whose entries to retrieve."),
    skip: int = Query(0, ge=0, description="Number of entries to skip for pagination."),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of entries to return."),
    entry_type: Optional[NetworthType] = Query(None, alias="type", description="Filter by net worth type: 'personal' or 'business'."),
    category: Optional[NetworthCategory] = Query(None, description="Filter by category: 'asset' or 'liability'."),
    section: Optional[str] = Query(None, description="Filter by section name (case-insensitive, partial match). Min length 1 if provided.", min_length=1),
    start_date: Optional[date] = Query(None, description="Filter by snapshot start date (inclusive)."),
    end_date: Optional[date] = Query(None, description="Filter by snapshot end date (inclusive)."),
    return_all: Optional[bool] = Query(False, description="If true, ignore skip/limit and return all entries for the user (respects other filters)."),
    # current_user: User = Depends(get_current_active_user) # Placeholder for auth
) -> List[NetworthEntryResponse]:
    """
    Retrieves a list of net worth entries for a given user.
    `user_id` query parameter is mandatory.
    Ensure the authenticated user is authorized to view entries for the given `user_id`.
    """
    # Example Authorization:
    # if user_id != current_user.id and not current_user.is_superuser:
    #     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view entries for this user")

    crud = CRUDNetworthEntry(db)
    try:
        entries_db = await crud.get_multi_by_user(
            user_id=user_id, skip=skip, limit=limit,
            entry_type=entry_type, category=category, section=section,
            start_date=start_date, end_date=end_date, return_all=return_all
        )
        return [NetworthEntryResponse.model_validate(entry) for entry in entries_db]
    except Exception as e:
        # In a production app, log the error `e` here
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve net worth entries: {str(e)}"
        )

@router.delete(
    "/bulk-delete-by-name-section",
    status_code=status.HTTP_200_OK,
    summary="Bulk Delete Networth Entries by Name and Section",
    description="Delete all net worth entries for a user with the specified item name and section. Returns the number of deleted entries.",
)
async def bulk_delete_networth_entries_by_name_and_section(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Query(..., description="The ID of the user whose entries to delete."),
    name: str = Query(..., min_length=1, description="The item name to match for deletion (exact match)."),
    section: str = Query(..., min_length=1, description="The section name to match for deletion (case-insensitive, exact match)."),
    # current_user: User = Depends(get_current_active_user) # Placeholder for auth
) -> dict:
    """
    Delete all net worth entries for a user with the specified item name and section.
    Returns the number of deleted entries.
    """
    # Example Authorization:
    # if user_id != current_user.id and not current_user.is_superuser:
    #     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete entries for this user")

    crud = CRUDNetworthEntry(db)
    deleted_count = await crud.remove_all_by_name_and_section(user_id=user_id, name=name, section=section)
    return {"deleted_count": deleted_count}

@router.delete(
    "/bulk-delete-by-section",
    status_code=status.HTTP_200_OK,
    summary="Bulk Delete All Networth Entries in Section",
    description="Delete all net worth entries for a user in the specified section, type, and category. Returns the number of deleted entries.",
)
async def bulk_delete_networth_entries_by_section(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Query(..., description="The ID of the user whose entries to delete."),
    section: str = Query(..., min_length=1, description="The section name to match for deletion (exact match)."),
    entry_type: str = Query(..., description="The entry type: 'personal' or 'business'."),
    entry_category: str = Query(..., description="The entry category: 'asset' or 'liability'."),
    # current_user: User = Depends(get_current_active_user) # Placeholder for auth
) -> dict:
    """
    Delete all net worth entries for a user in the specified section, type, and category.
    This will delete ALL entries in the section regardless of item name.
    Returns the number of deleted entries.
    """
    # Example Authorization:
    # if user_id != current_user.id and not current_user.is_superuser:
    #     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete entries for this user")

    crud = CRUDNetworthEntry(db)
    deleted_count = await crud.remove_all_by_section(
        user_id=user_id, 
        section=section, 
        entry_type=entry_type, 
        entry_category=entry_category
    )
    return {
        "deleted_count": deleted_count,
        "section": section,
        "entry_type": entry_type,
        "entry_category": entry_category
    }

@router.put(
    "/rename-section",
    status_code=status.HTTP_200_OK,
    summary="Rename Section for All Entries",
    description="Rename a section for all net worth entries matching the user, type, and category. Updates all items in that section.",
)
async def rename_section(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Query(..., description="The ID of the user whose section to rename."),
    rename_data: NetworthSectionRename,
    # current_user: User = Depends(get_current_active_user) # Placeholder for auth
) -> dict:
    """
    Rename a section for all net worth entries matching the specified criteria.
    This will update all entries in the old section to have the new section name.
    The operation is scoped by user_id, entry_type, and entry_category to prevent accidental cross-category renames.
    """
    # Example Authorization:
    # if user_id != current_user.id and not current_user.is_superuser:
    #     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to modify entries for this user")

    crud = CRUDNetworthEntry(db)
    try:
        updated_count = await crud.rename_section(
            user_id=user_id,
            old_section_name=rename_data.old_section_name,
            new_section_name=rename_data.new_section_name,
            entry_type=rename_data.entry_type,
            entry_category=rename_data.entry_category
        )
        return {
            "updated_count": updated_count,
            "old_section_name": rename_data.old_section_name,
            "new_section_name": rename_data.new_section_name,
            "entry_type": rename_data.entry_type,
            "entry_category": rename_data.entry_category
        }
    except HTTPException:
        raise  # Re-raise HTTPExceptions from CRUD layer
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to rename section: {str(e)}"
        )

@router.get(
    "/{entry_id}",
    response_model=NetworthEntryResponse,
    summary="Read Networth Entry by ID",
    description="Retrieve a specific net worth entry by its ID. Requires `user_id` query parameter for authorization context.",
)
async def read_networth_entry(
    *,
    db: AsyncSession = Depends(get_db),
    entry_id: UUID,
    user_id: UUID = Query(..., description="The ID of the user who owns the entry. Used for authorization."),
    # current_user: User = Depends(get_current_active_user) # Placeholder for auth
) -> NetworthEntryResponse:
    """
    Get a specific net worth entry by ID for a user.
    The `user_id` query parameter ensures that the lookup is scoped to the correct user,
    and should be checked against the authenticated user's identity.
    """
    # Example Authorization:
    # if user_id != current_user.id and not current_user.is_superuser:
    #     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this entry")

    crud = CRUDNetworthEntry(db)
    entry = await crud.get(id=entry_id, user_id=user_id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Networth entry not found or not owned by the specified user.",
        )
    return NetworthEntryResponse.model_validate(entry)

@router.put(
    "/{entry_id}",
    response_model=NetworthEntryResponse,
    summary="Update Networth Entry",
    description="Update an existing net worth entry. Only provided fields are updated. Requires `user_id` for authorization.",
)
async def update_networth_entry(
    *,
    db: AsyncSession = Depends(get_db),
    entry_id: UUID,
    entry_in: NetworthEntryUpdate,
    user_id: UUID = Query(..., description="The ID of the user who owns the entry. Used for authorization."),
    # current_user: User = Depends(get_current_active_user) # Placeholder for auth
) -> NetworthEntryResponse:
    """
    Update a net worth entry.
    Only fields provided in the request body will be updated.
    The `user_id` query parameter is used to fetch the correct entry and for authorization.
    """
    # Example Authorization:
    # if user_id != current_user.id and not current_user.is_superuser:
    #     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this entry")

    crud = CRUDNetworthEntry(db)
    db_entry = await crud.get(id=entry_id, user_id=user_id) # Ensure entry exists and belongs to user
    if not db_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Networth entry not found or not owned by user for update.",
        )
    try:
        updated_entry = await crud.update(db_obj=db_entry, obj_in=entry_in)
        return NetworthEntryResponse.model_validate(updated_entry)
    except HTTPException as http_exc:
        raise http_exc # Re-raise from CRUD
    except Exception as e:
        await db.rollback()
        # In a production app, log the error `e` here
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update net worth entry: {str(e)}"
        )

@router.delete(
    "/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Networth Entry",
    description="Delete a specific net worth entry by its ID. Requires `user_id` for authorization.",
)
async def delete_networth_entry(
    *,
    db: AsyncSession = Depends(get_db),
    entry_id: UUID,
    user_id: UUID = Query(..., description="The ID of the user who owns the entry. Used for authorization."),
    # current_user: User = Depends(get_current_active_user) # Placeholder for auth
):
    """
    Delete a net worth entry.
    The `user_id` query parameter ensures that the deletion is authorized.
    """
    # Example Authorization:
    # if user_id != current_user.id and not current_user.is_superuser:
    #     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this entry")

    crud = CRUDNetworthEntry(db)
    # First, verify the entry exists and belongs to the user before attempting deletion.
    db_entry_to_delete = await crud.get(id=entry_id, user_id=user_id)
    if not db_entry_to_delete:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Networth entry not found or not owned by user for deletion.",
        )
    try:
        deleted_entry = await crud.remove(id=entry_id, user_id=user_id) # remove() also calls get()
        if deleted_entry is None: # Should ideally be caught by the get() above
             raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Networth entry could not be deleted or was already gone.",
            )
    except HTTPException as http_exc:
        raise http_exc # Re-raise from CRUD
    except Exception as e:
        await db.rollback()
        # In a production app, log the error `e` here
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete net worth entry: {str(e)}"
        )
    # Return No Content status (HTTP 204)
    return None
