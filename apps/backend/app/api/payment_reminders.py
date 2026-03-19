from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.crud.payment_reminders import CRUDPaymentReminder
from app.schemas.payment_reminders import (
    PaymentReminderCreate, 
    PaymentReminderUpdate, 
    PaymentReminderResponse,
    TestEmailRequest,
    ConsolidatedReminderRequest,
    ConsolidatedReminderResponse
)
from app.database.database import get_db
from uuid import UUID
from typing import List, Optional
from datetime import date

router = APIRouter()

@router.post("/", response_model=PaymentReminderResponse, status_code=status.HTTP_201_CREATED)
async def create_payment_reminder(
    *,
    db: AsyncSession = Depends(get_db),
    reminder_in: PaymentReminderCreate
):
    """Create a new payment reminder."""
    crud = CRUDPaymentReminder(db)
    return await crud.create(obj_in=reminder_in)

@router.get("/", response_model=List[PaymentReminderResponse])
async def get_payment_reminders(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID,
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[str] = Query(None, alias="status"),
    return_all: bool = False
):
    """Get all payment reminders for a user."""
    crud = CRUDPaymentReminder(db)
    return await crud.get_multi_by_user(
        user_id=user_id,
        skip=skip,
        limit=limit,
        status=status_filter,
        return_all=return_all
    )

@router.get("/card/{card_id}", response_model=List[PaymentReminderResponse])
async def get_payment_reminders_by_card(
    *,
    db: AsyncSession = Depends(get_db),
    card_id: UUID,
    user_id: UUID,
    status_filter: Optional[str] = Query(None, alias="status")
):
    """Get all payment reminders for a specific credit card."""
    crud = CRUDPaymentReminder(db)
    return await crud.get_multi_by_card(
        card_id=card_id,
        user_id=user_id,
        status=status_filter
    )

@router.get("/due-today", response_model=List[PaymentReminderResponse])
async def get_reminders_due_today(
    *,
    db: AsyncSession = Depends(get_db),
    target_date: Optional[date] = Query(None, description="Date to check for due reminders (defaults to today)")
):
    """Get all payment reminders due on the specified date (used by scheduler)."""
    crud = CRUDPaymentReminder(db)
    return await crud.get_due_today(target_date=target_date)

@router.get("/{reminder_id}", response_model=PaymentReminderResponse)
async def get_payment_reminder(
    *,
    db: AsyncSession = Depends(get_db),
    reminder_id: UUID,
    user_id: UUID
):
    """Get a specific payment reminder by ID."""
    crud = CRUDPaymentReminder(db)
    reminder = await crud.get(id=reminder_id, user_id=user_id)
    if not reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment reminder not found"
        )
    return reminder

@router.put("/{reminder_id}", response_model=PaymentReminderResponse)
async def update_payment_reminder(
    *,
    db: AsyncSession = Depends(get_db),
    reminder_id: UUID,
    user_id: UUID,
    reminder_in: PaymentReminderUpdate
):
    """Update a specific payment reminder."""
    crud = CRUDPaymentReminder(db)
    db_obj = await crud.get(id=reminder_id, user_id=user_id)
    if not db_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment reminder not found"
        )
    return await crud.update(db_obj=db_obj, obj_in=reminder_in)

@router.put("/{reminder_id}/mark-sent", response_model=PaymentReminderResponse)
async def mark_reminder_as_sent(
    *,
    db: AsyncSession = Depends(get_db),
    reminder_id: UUID,
    user_id: UUID
):
    """Mark a payment reminder as sent (used by scheduler)."""
    crud = CRUDPaymentReminder(db)
    updated_reminder = await crud.mark_as_sent(reminder_id=reminder_id, user_id=user_id)
    if not updated_reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment reminder not found"
        )
    return updated_reminder

@router.put("/{reminder_id}/mark-failed", response_model=PaymentReminderResponse)
async def mark_reminder_as_failed(
    *,
    db: AsyncSession = Depends(get_db),
    reminder_id: UUID,
    user_id: UUID
):
    """Mark a payment reminder as failed (used by scheduler)."""
    crud = CRUDPaymentReminder(db)
    updated_reminder = await crud.mark_as_failed(
        reminder_id=reminder_id, 
        user_id=user_id
    )
    if not updated_reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment reminder not found"
        )
    return updated_reminder

@router.delete("/card/{card_id}/cancel", status_code=status.HTTP_200_OK)
async def cancel_reminders_for_card(
    *,
    db: AsyncSession = Depends(get_db),
    card_id: UUID,
    user_id: UUID
):
    """Cancel all pending reminders for a specific credit card."""
    crud = CRUDPaymentReminder(db)
    cancelled_count = await crud.cancel_reminders_for_card(card_id=card_id, user_id=user_id)
    return {"message": f"Cancelled {cancelled_count} reminder(s)", "cancelled_count": cancelled_count}

@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment_reminder(
    *,
    db: AsyncSession = Depends(get_db),
    reminder_id: UUID,
    user_id: UUID
):
    """Delete a specific payment reminder."""
    crud = CRUDPaymentReminder(db)
    db_obj = await crud.get(id=reminder_id, user_id=user_id)
    if not db_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment reminder not found"
        )
    await crud.remove(id=reminder_id, user_id=user_id)
    return None

@router.post("/send-due-reminders", status_code=status.HTTP_200_OK)
async def send_due_reminders(
    *,
    db: AsyncSession = Depends(get_db),
    target_date: Optional[date] = Query(None, description="Date to check for due reminders (defaults to today)")
):
    """Manually trigger sending of payment reminders due today (used for testing)."""
    from app.service.payment_reminders_email_manager import PaymentRemindersEmailManager
    
    manager = PaymentRemindersEmailManager()
    result = await manager.send_payment_reminders(db=db, target_date=target_date)
    
    return {
        "message": f"Processed {result.get('emails_sent', 0)} reminders",
        "emails_sent": result.get('emails_sent', 0),
        "errors": result.get('errors', 0),
        "details": result.get('details', [])
    }

@router.post("/send-test-email", status_code=status.HTTP_200_OK)
async def send_test_email(
    *,
    db: AsyncSession = Depends(get_db),
    request: TestEmailRequest
):
    """Send test email with user's actual cards using production email logic."""
    from app.service.payment_reminders_email_manager import PaymentRemindersEmailManager
    from uuid import UUID
    
    try:
        # Convert string user_id to UUID
        user_uuid = UUID(request.user_id)
        
        manager = PaymentRemindersEmailManager()
        result = await manager.send_test_email(
            db=db,
            user_id=user_uuid,
            email=request.email,
            reminder_days_before=request.reminder_days_before
        )
        
        if result["success"]:
            return {
                "success": True,
                "message": result["message"],
                "cards_included": result.get("cards_included", 0),
                "subject": result.get("subject", "")
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["error"]
            )
            
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid user ID format: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send test email: {str(e)}"
        )

@router.post("/create-consolidated", response_model=ConsolidatedReminderResponse, status_code=status.HTTP_201_CREATED)
async def create_consolidated_reminders(
    *,
    db: AsyncSession = Depends(get_db),
    request: ConsolidatedReminderRequest
):
    """Create consolidated monthly reminders for all user's unpaid cards."""
    from app.service.payment_reminders_email_manager import PaymentRemindersEmailManager
    from uuid import UUID
    
    try:
        # Convert string user_id to UUID
        user_uuid = UUID(request.user_id)
        
        manager = PaymentRemindersEmailManager()
        result = await manager.create_consolidated_reminders(
            db=db,
            user_id=user_uuid,
            email=request.email,
            reminder_days_before=request.reminder_days_before
        )
        
        if result["success"]:
            return ConsolidatedReminderResponse(
                success=True,
                reminders_created=result["reminders_created"],
                scheduled_date=result["scheduled_date"],
                cards_included=result["cards_included"],
                message=result["message"]
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["error"]
            )
            
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid user ID format: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create consolidated reminders: {str(e)}"
        )