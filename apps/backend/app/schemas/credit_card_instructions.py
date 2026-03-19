from typing import Optional
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime

class CreditCardInstructionsBase(BaseModel):
    card_name: str = Field(..., description="Name of the credit card.")
    payment_day: int = Field(..., ge=1, le=31, description="Day of the month the payment is due.")
    description: Optional[str] = Field(None, description="Description of the credit card instruction.")
    instruction: Optional[str] = Field(None, description="Detailed instruction for the credit card payment.")
    is_paid: Optional[bool] = Field(False, description="Payment status of the instruction.")

class CreditCardInstructionsCreate(CreditCardInstructionsBase):
    user_id: UUID = Field(..., description="ID of the user who owns this credit card instruction.")

class CreditCardInstructionsUpdate(BaseModel):
    card_name: Optional[str] = Field(None, description="Name of the credit card.")
    payment_day: Optional[int] = Field(None, ge=1, le=31, description="Day of the month the payment is due.")
    description: Optional[str] = Field(None, description="Description of the credit card instruction.")
    instruction: Optional[str] = Field(None, description="Detailed instruction for the credit card payment.")
    is_paid: Optional[bool] = Field(None, description="Payment status of the instruction.")

class CreditCardInstructionsResponse(CreditCardInstructionsBase):
    id: UUID = Field(..., description="Unique identifier for the credit card instruction.")
    user_id: UUID = Field(..., description="ID of the user who owns this credit card instruction.")
    created_at: datetime = Field(..., description="Timestamp when the record was created.")
    updated_at: datetime = Field(..., description="Timestamp when the record was last updated.")
