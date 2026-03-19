from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List, Optional

from app.database.database import get_db
from app.schemas.cashflow import (
    CashflowCreate,
    CashflowUpdate,
    CashflowResponse,
    FlowType # Import the Literal type
)
from app.crud.cashflow import CRUDCashflow

router = APIRouter()

@router.post(
    "/",
    response_model=CashflowResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Cashflow Record",
    description="Create a new cashflow record (inflow or outflow) for the specified user.",
)
async def create_cashflow(
    *,
    db: AsyncSession = Depends(get_db),
    cashflow_in: CashflowCreate,
) -> CashflowResponse:
    """
    Create a new cashflow record.
    """
    crud = CRUDCashflow(db)
    try:
        # user_id comes from the input schema
        created_cashflow = await crud.create(obj_in=cashflow_in)
        return CashflowResponse.model_validate(created_cashflow)
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create cashflow record: {str(e)}"
        )

@router.get(
    "/",
    response_model=List[CashflowResponse],
    summary="Read Cashflow Records",
    description="Retrieve cashflow records for a user with optional filters and pagination.",
)
async def read_cashflows(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Query(..., description="The ID of the user whose records to retrieve."),
    skip: int = Query(0, ge=0, description="Number of records to skip for pagination."),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of records to return."),
    flow_type: Optional[FlowType] = Query(None, description="Filter by flow type: 'inflow' or 'outflow'."),
    return_all: Optional[bool] = Query(False, description="If true, ignore skip/limit and return all records for the user (respects flow_type filter)."),
    # Add authorization checks here if needed
) -> List[CashflowResponse]:
    """
    Retrieves a list of cashflow records for a given user.
    Supports filtering by flow_type and option to return all records.
    """
    crud = CRUDCashflow(db)
    # Pass the query parameters to the CRUD method
    cashflows = await crud.get_multi_by_user(
        user_id=user_id,
        skip=skip,
        limit=limit,
        flow_type=flow_type,
        return_all=return_all,
    )
    # Validate each record in the response
    return [CashflowResponse.model_validate(cf) for cf in cashflows]

@router.get(
    "/{cashflow_id}",
    response_model=CashflowResponse,
    summary="Read Cashflow Record by ID",
    description="Retrieve a specific cashflow record by its ID.",
)
async def read_cashflow(
    *,
    db: AsyncSession = Depends(get_db),
    cashflow_id: UUID,
    user_id: UUID = Query(..., description="The ID of the user who owns the record."),
    # Add authorization checks here
) -> CashflowResponse:
    """
    Get a specific cashflow record by ID for a user.
    """
    crud = CRUDCashflow(db)
    cashflow = await crud.get(id=cashflow_id, user_id=user_id)
    if not cashflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cashflow record not found",
        )
    return CashflowResponse.model_validate(cashflow)

@router.put(
    "/{cashflow_id}",
    response_model=CashflowResponse,
    summary="Update Cashflow Record",
    description="Update an existing cashflow record.",
)
async def update_cashflow(
    *,
    db: AsyncSession = Depends(get_db),
    cashflow_id: UUID,
    cashflow_in: CashflowUpdate,
    user_id: UUID = Query(..., description="The ID of the user who owns the record."),
    # Add authorization checks here
) -> CashflowResponse:
    """
    Update a cashflow record.
    Only fields provided in the request body will be updated.
    """
    crud = CRUDCashflow(db)
    db_cashflow = await crud.get(id=cashflow_id, user_id=user_id)
    if not db_cashflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cashflow record not found",
        )
    try:
        updated_cashflow = await crud.update(db_obj=db_cashflow, obj_in=cashflow_in)
        return CashflowResponse.model_validate(updated_cashflow)
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to update cashflow record: {str(e)}"
        )

@router.delete(
    "/{cashflow_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Cashflow Record",
    description="Delete a specific cashflow record by its ID.",
)
async def delete_cashflow(
    *,
    db: AsyncSession = Depends(get_db),
    cashflow_id: UUID,
    user_id: UUID = Query(..., description="The ID of the user who owns the record."),
    # Add authorization checks here
):
    """
    Delete a cashflow record.
    """
    crud = CRUDCashflow(db)
    db_cashflow = await crud.get(id=cashflow_id, user_id=user_id)
    if not db_cashflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cashflow record not found",
        )
    try:
        await crud.remove(id=cashflow_id, user_id=user_id)
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        # Should be rare if get succeeded, but handle potential issues
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete cashflow record: {str(e)}"
        )
    return None # No content response 