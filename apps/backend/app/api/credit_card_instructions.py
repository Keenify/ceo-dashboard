from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.crud.credit_card_instructions import CRUDCreditCardInstructions
from app.schemas.credit_card_instructions import CreditCardInstructionsCreate, CreditCardInstructionsUpdate, CreditCardInstructionsResponse
from app.database.database import get_db
from uuid import UUID
from typing import List

router = APIRouter()

@router.post("/", response_model=CreditCardInstructionsResponse, status_code=status.HTTP_201_CREATED)
async def create_credit_card_instruction(
    *,
    db: AsyncSession = Depends(get_db),
    instruction_in: CreditCardInstructionsCreate
):
    """Create a new credit card instruction."""
    crud = CRUDCreditCardInstructions(db)
    return await crud.create(obj_in=instruction_in)

@router.get("/", response_model=List[CreditCardInstructionsResponse])
async def get_credit_card_instructions(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID,
    skip: int = 0,
    limit: int = 100,
    return_all: bool = False
):
    """Get all credit card instructions for a user."""
    crud = CRUDCreditCardInstructions(db)
    return await crud.get_multi_by_user(
        user_id=user_id,
        skip=skip,
        limit=limit,
        return_all=return_all
    )

@router.get("/{instruction_id}", response_model=CreditCardInstructionsResponse)
async def get_credit_card_instruction(
    *,
    db: AsyncSession = Depends(get_db),
    instruction_id: UUID,
    user_id: UUID
):
    """Get a specific credit card instruction by ID."""
    crud = CRUDCreditCardInstructions(db)
    instruction = await crud.get(id=instruction_id, user_id=user_id)
    if not instruction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credit card instruction not found"
        )
    return instruction

@router.put("/{instruction_id}", response_model=CreditCardInstructionsResponse)
async def update_credit_card_instruction(
    *,
    db: AsyncSession = Depends(get_db),
    instruction_id: UUID,
    user_id: UUID,
    instruction_in: CreditCardInstructionsUpdate
):
    """Update a specific credit card instruction."""
    crud = CRUDCreditCardInstructions(db)
    db_obj = await crud.get(id=instruction_id, user_id=user_id)
    if not db_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credit card instruction not found"
        )
    return await crud.update(db_obj=db_obj, obj_in=instruction_in)

@router.delete("/{instruction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_credit_card_instruction(
    *,
    db: AsyncSession = Depends(get_db),
    instruction_id: UUID,
    user_id: UUID
):
    """Delete a specific credit card instruction."""
    crud = CRUDCreditCardInstructions(db)
    db_obj = await crud.get(id=instruction_id, user_id=user_id)
    if not db_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credit card instruction not found"
        )
    await crud.remove(id=instruction_id, user_id=user_id)
    return None
