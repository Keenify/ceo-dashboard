from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List, Optional
from datetime import date

from app.database.database import get_db
from app.schemas.travel_transactions import (
    TravelTransactionCreate,
    TravelTransactionUpdate,
    TravelTransactionResponse,
    TravelTransactionBulkRenameTrip,
    TravelTransactionBulkRenameResponse,
)
from app.crud.travel_transactions import CRUDTravelTransaction

router = APIRouter()

@router.post(
    "/",
    response_model=TravelTransactionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Travel Transaction",
    description="Create a new travel transaction for the specified user.",
)
async def create_travel_transaction(
    *,
    db: AsyncSession = Depends(get_db),
    transaction_in: TravelTransactionCreate,
):
    """
    Create a new travel transaction.

    Provide EITHER `amount_sgd` directly OR the three local currency fields
    (`local_currency`, `amount_local_currency`, `exchange_rate_to_sgd`).
    """
    crud = CRUDTravelTransaction(db)
    try:
        # user_id is required in transaction_in (TravelTransactionCreate schema)
        created_transaction = await crud.create(obj_in=transaction_in)
        # Validate the response against the Pydantic model
        return TravelTransactionResponse.model_validate(created_transaction)
    except HTTPException as http_exc:
        # Re-raise HTTPException from CRUD layer
        raise http_exc
    except Exception as e:
        # Catch other potential errors during creation
        await db.rollback() # Ensure rollback on unexpected errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create travel transaction: {str(e)}"
        )


@router.get(
    "/",
    response_model=List[TravelTransactionResponse],
    summary="Read Travel Transactions",
    description="Retrieve travel transactions for a user with optional filters and pagination.",
)
async def read_travel_transactions(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Query(..., description="The ID of the user whose transactions to retrieve."),
    skip: int = Query(0, ge=0, description="Number of records to skip for pagination."),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of records to return."),
    start_date: Optional[date] = Query(None, description="Filter transactions on or after this payment date."),
    end_date: Optional[date] = Query(None, description="Filter transactions on or before this payment date."),
    city: Optional[str] = Query(None, description="Filter transactions by city (case-insensitive search)."),
    country: Optional[str] = Query(None, description="Filter transactions by country (case-insensitive search)."),
    # Add authorization checks here if needed
):
    """
    Retrieve travel transactions for a user. Supports filtering and pagination.
    """
    crud = CRUDTravelTransaction(db)
    transactions = await crud.get_multi_by_user(
        user_id=user_id,
        skip=skip,
        limit=limit,
        start_date=start_date,
        end_date=end_date,
        city=city,
        country=country,
    )
    # Validate each transaction in the list
    return [TravelTransactionResponse.model_validate(t) for t in transactions]


@router.get(
    "/{transaction_id}",
    response_model=TravelTransactionResponse,
    summary="Read Travel Transaction by ID",
    description="Retrieve a specific travel transaction by its ID.",
)
async def read_travel_transaction(
    *,
    db: AsyncSession = Depends(get_db),
    transaction_id: UUID,
    user_id: UUID = Query(..., description="The ID of the user who owns the transaction."),
    # Add authorization checks here
):
    """
    Get a specific travel transaction by ID for a user.
    """
    crud = CRUDTravelTransaction(db)
    transaction = await crud.get(id=transaction_id, user_id=user_id)
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Travel transaction not found",
        )
    # Validate the response
    return TravelTransactionResponse.model_validate(transaction)


@router.put(
    "/{transaction_id}",
    response_model=TravelTransactionResponse,
    summary="Update Travel Transaction",
    description="Update an existing travel transaction.",
)
async def update_travel_transaction(
    *,
    db: AsyncSession = Depends(get_db),
    transaction_id: UUID,
    transaction_in: TravelTransactionUpdate,
    user_id: UUID = Query(..., description="The ID of the user who owns the transaction."),
    # Add authorization checks here
):
    """
    Update a travel transaction.

    When updating amount fields, provide EITHER `amount_sgd` OR the full
    set of (`local_currency`, `amount_local_currency`, `exchange_rate_to_sgd`).
    Providing only `amount_sgd` will clear the local currency fields.
    Providing the local currency fields will recalculate and set `amount_sgd`.
    """
    crud = CRUDTravelTransaction(db)
    db_transaction = await crud.get(id=transaction_id, user_id=user_id)
    if not db_transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Travel transaction not found",
        )
    try:
        updated_transaction = await crud.update(db_obj=db_transaction, obj_in=transaction_in)
        # Validate the response
        return TravelTransactionResponse.model_validate(updated_transaction)
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to update travel transaction: {str(e)}"
        )


@router.post(
    "/bulk-rename-trip",
    response_model=TravelTransactionBulkRenameResponse,
    status_code=status.HTTP_200_OK,
    summary="Bulk Rename Trip Details",
    description="Rename trip name, city, and country for all transactions matching the old trip details.",
)
async def bulk_rename_trip(
    *,
    db: AsyncSession = Depends(get_db),
    rename_data: TravelTransactionBulkRenameTrip,
):
    """
    Bulk rename trip details for all transactions belonging to the same trip.
    
    This endpoint will find all transactions with the specified old trip name, city, and country
    and update them with the new trip details.
    """
    crud = CRUDTravelTransaction(db)
    try:
        updated_count, updated_ids = await crud.bulk_rename_trip(
            user_id=rename_data.user_id,
            old_trip_name=rename_data.old_trip_name,
            old_city=rename_data.old_city,
            old_country=rename_data.old_country,
            new_trip_name=rename_data.new_trip_name,
            new_city=rename_data.new_city,
            new_country=rename_data.new_country,
        )
        
        return TravelTransactionBulkRenameResponse(
            updated_count=updated_count,
            updated_transaction_ids=updated_ids
        )
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to bulk rename trip: {str(e)}"
        )


@router.delete(
    "/{transaction_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Travel Transaction",
    description="Delete a specific travel transaction by its ID.",
)
async def delete_travel_transaction(
    *,
    db: AsyncSession = Depends(get_db),
    transaction_id: UUID,
    user_id: UUID = Query(..., description="The ID of the user who owns the transaction."),
    # Add authorization checks here
):
    """
    Delete a travel transaction.
    """
    crud = CRUDTravelTransaction(db)
    db_transaction = await crud.get(id=transaction_id, user_id=user_id)
    if not db_transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Travel transaction not found",
        )
    try:
        await crud.remove(id=transaction_id, user_id=user_id)
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        # Catch potential errors during delete, though less common if get succeeded
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete travel transaction: {str(e)}"
        )
    return None 