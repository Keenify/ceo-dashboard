from typing import Optional, Any, List
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator, ValidationError
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal

class TravelTransactionBase(BaseModel):
    booking_date: Optional[date] = Field(None, description="Date the travel item was booked.")
    payment_date: date = Field(..., description="Date the payment was made.")
    description: Optional[str] = Field(None, description="Optional description of the transaction.")
    item: str = Field(..., description="Specific item purchased (e.g., flight, hotel, meal).")
    city: str = Field(..., description="City where the transaction occurred.")
    country: str = Field(..., description="Country where the transaction occurred.")
    trip_name: Optional[str] = Field(None, description="Name of the trip this transaction belongs to.")
    category: str = Field(..., description="Category of the transaction (e.g., 'expense', 'income').")

    # Option 1: Local Currency Input
    local_currency: Optional[str] = Field(None, description="Currency code of the local currency (e.g., EUR, USD). Required if amount_sgd is not provided.")
    amount_local_currency: Optional[Decimal] = Field(None, max_digits=12, decimal_places=2, description="Amount in local currency. Required if amount_sgd is not provided.")
    exchange_rate_to_sgd: Optional[Decimal] = Field(None, max_digits=12, decimal_places=6, description="Exchange rate to SGD. Required if amount_sgd is not provided.")

    # Option 2: Direct SGD Input
    amount_sgd: Optional[Decimal] = Field(None, max_digits=12, decimal_places=2, description="Amount directly in SGD. Provide this OR local currency details.")

    @field_validator('category')
    @classmethod
    def category_must_be_valid(cls, v: str) -> str:
        if v not in ('expense', 'income'):
            raise ValueError('category must be either "expense" or "income"')
        return v

    # Use root_validator in Pydantic v1 or model_validator in Pydantic v2
    @model_validator(mode='before') # Use 'before' to potentially calculate amount_sgd
    @classmethod
    def check_amount_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            amount_sgd = data.get('amount_sgd')
            local_currency = data.get('local_currency')
            amount_local = data.get('amount_local_currency')
            rate_sgd = data.get('exchange_rate_to_sgd')

            has_sgd = amount_sgd is not None
            has_local_group = all(v is not None for v in [local_currency, amount_local, rate_sgd])
            has_partial_local = any(v is not None for v in [local_currency, amount_local, rate_sgd]) and not has_local_group

            if has_sgd and has_partial_local:
                raise ValueError("Cannot provide both amount_sgd and partial local currency details.")
            if has_sgd and has_local_group:
                 raise ValueError("Provide amount_sgd OR the full set of local currency details (local_currency, amount_local_currency, exchange_rate_to_sgd), not both.")
            if not has_sgd and not has_local_group:
                 raise ValueError("Must provide either amount_sgd OR the full set of local currency details (local_currency, amount_local_currency, exchange_rate_to_sgd).")

            # If only local group is provided, calculate amount_sgd
            if has_local_group and not has_sgd:
                 try:
                     # Ensure values are Decimal for calculation
                     dec_amount_local = Decimal(amount_local)
                     dec_rate_sgd = Decimal(rate_sgd)
                     calculated_sgd = (dec_amount_local * dec_rate_sgd).quantize(Decimal("0.00"))
                     data['amount_sgd'] = calculated_sgd # Add calculated value to data
                     # Optionally clear local fields if only SGD should be stored? No, keep them for record.
                 except Exception as e:
                     raise ValueError(f"Error calculating amount_sgd from local currency: {e}")

        return data

class TravelTransactionCreate(TravelTransactionBase):
    user_id: UUID = Field(..., description="ID of the user who owns this transaction.")

class TravelTransactionUpdate(BaseModel):
    booking_date: Optional[date] = Field(None, description="Date the travel item was booked.")
    payment_date: Optional[date] = Field(None, description="Date the payment was made.")
    description: Optional[str] = Field(None, description="Optional description of the transaction.")
    item: Optional[str] = Field(None, description="Specific item purchased (e.g., flight, hotel, meal).")
    city: Optional[str] = Field(None, description="City where the transaction occurred.")
    country: Optional[str] = Field(None, description="Country where the transaction occurred.")
    trip_name: Optional[str] = Field(None, description="Name of the trip this transaction belongs to.")
    category: Optional[str] = Field(None, description="Category of the transaction (e.g., 'expense', 'income').")

    # Allow updating either local currency fields OR direct SGD amount
    local_currency: Optional[str] = Field(None, description="Currency code of the local currency (e.g., EUR, USD).")
    amount_local_currency: Optional[Decimal] = Field(None, max_digits=12, decimal_places=2, description="Amount of the transaction in local currency.")
    exchange_rate_to_sgd: Optional[Decimal] = Field(None, max_digits=12, decimal_places=6, description="Exchange rate used to convert the local currency amount to SGD.")
    amount_sgd: Optional[Decimal] = Field(None, max_digits=12, decimal_places=2, description="Amount directly in SGD.")

    @field_validator('category')
    @classmethod
    def category_must_be_valid_optional(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ('expense', 'income'):
            raise ValueError('category must be either "expense" or "income"')
        return v

    # Validator to ensure consistency on update
    @model_validator(mode='before')
    @classmethod
    def check_update_amount_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Check which fields are present in the update payload
            provided_keys = {k for k, v in data.items() if v is not None}
            local_keys = {'local_currency', 'amount_local_currency', 'exchange_rate_to_sgd'}
            sgd_key = 'amount_sgd'

            provided_local = local_keys.intersection(provided_keys)
            provided_sgd = sgd_key in provided_keys

            # If attempting to update both direct SGD and local fields simultaneously
            if provided_sgd and provided_local:
                 raise ValueError("Cannot update both amount_sgd and local currency fields in the same request. Choose one method.")

            # If attempting to update only *part* of the local currency group
            if provided_local and len(provided_local) < 3:
                 # This is tricky. To update local currency, all three fields must be provided in the update.
                 raise ValueError("To update using local currency, provide all three fields: local_currency, amount_local_currency, exchange_rate_to_sgd.")

            # If updating via local currency, calculate the corresponding amount_sgd
            if len(provided_local) == 3 and not provided_sgd:
                 try:
                     dec_amount_local = Decimal(data['amount_local_currency'])
                     dec_rate_sgd = Decimal(data['exchange_rate_to_sgd'])
                     calculated_sgd = (dec_amount_local * dec_rate_sgd).quantize(Decimal("0.00"))
                     data['amount_sgd'] = calculated_sgd # Ensure amount_sgd is calculated and included in update data
                 except Exception as e:
                     raise ValueError(f"Error calculating amount_sgd for update: {e}")

            # If updating amount_sgd directly, we might need to clear local fields in the CRUD layer later

        return data # Return the potentially modified data dictionary

class TravelTransactionBulkRenameTrip(BaseModel):
    user_id: UUID = Field(..., description="ID of the user who owns these transactions.")
    old_trip_name: str = Field(..., description="Current trip name to match.")
    old_city: str = Field(..., description="Current city to match.")
    old_country: str = Field(..., description="Current country to match.")
    new_trip_name: str = Field(..., description="New trip name to set.")
    new_city: str = Field(..., description="New city to set.")
    new_country: str = Field(..., description="New country to set.")

class TravelTransactionBulkRenameResponse(BaseModel):
    updated_count: int = Field(..., description="Number of transactions updated.")
    updated_transaction_ids: List[UUID] = Field(..., description="List of transaction IDs that were updated.")

class TravelTransactionResponse(TravelTransactionBase):
    id: UUID = Field(..., description="Unique identifier for the travel transaction.")
    user_id: UUID = Field(..., description="ID of the user who owns this transaction.")
    # amount_sgd is inherited from Base, now optional
    created_at: datetime = Field(..., description="Timestamp when the record was created.")
    updated_at: datetime = Field(..., description="Timestamp when the record was last updated.")

    model_config = ConfigDict(from_attributes=True)
