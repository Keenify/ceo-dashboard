from typing import Optional, Literal, Annotated
from pydantic import BaseModel, Field, ConfigDict, field_validator, constr
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal

# Literal type for allowed flow types
FlowType = Literal['inflow', 'outflow']

# Regex for hex color code (e.g., #RRGGBB or #RGB)
HexColorCode = Annotated[str, Field(pattern=r"^#(?:[0-9a-fA-F]{3}){1,2}$")]

class CashflowBase(BaseModel):
    flow_type: FlowType = Field(..., description="Type of cash flow: 'inflow' or 'outflow'.")
    amount: Decimal = Field(..., max_digits=12, decimal_places=2, description="Amount of the transaction.")
    description: Optional[str] = Field(None, description="Description of the transaction (e.g., source/destination).")
    flow_date: date = Field(..., description="Date the cashflow occurred.")
    category: Optional[str] = Field(None, description="Category of the cashflow (e.g., investment, salary, expense).")
    background_color_code: Optional[HexColorCode] = Field(None, description="Optional background color code in hex format (e.g., #RRGGBB).")
    font_color_code: Optional[HexColorCode] = Field(None, description="Optional font color code in hex format (e.g., #RRGGBB).")
    note: Optional[str] = Field(None, description="Additional notes for the transaction.")

    # Pydantic automatically validates against the Literal type for flow_type

class CashflowCreate(CashflowBase):
    user_id: UUID = Field(..., description="ID of the user who owns this cashflow record.")

class CashflowUpdate(BaseModel):
    # All fields are optional on update
    flow_type: Optional[FlowType] = Field(None, description="Type of cash flow: 'inflow' or 'outflow'.")
    amount: Optional[Decimal] = Field(None, max_digits=12, decimal_places=2, description="Amount of the transaction.")
    description: Optional[str] = Field(None, description="Description of the transaction (e.g., source/destination).")
    flow_date: Optional[date] = Field(None, description="Date the cashflow occurred.")
    category: Optional[str] = Field(None, description="Category of the cashflow (e.g., investment, salary, expense).")
    background_color_code: Optional[HexColorCode] = Field(None, description="Optional background color code in hex format (e.g., #RRGGBB).")
    font_color_code: Optional[HexColorCode] = Field(None, description="Optional font color code in hex format (e.g., #RRGGBB).")
    note: Optional[str] = Field(None, description="Additional notes for the transaction.")

class CashflowResponse(CashflowBase):
    id: UUID = Field(..., description="Unique identifier for the cashflow record.")
    user_id: UUID = Field(..., description="ID of the user who owns this cashflow record.")
    created_at: datetime = Field(..., description="Timestamp when the record was created.")
    updated_at: datetime = Field(..., description="Timestamp when the record was last updated.")
    # background_color_code and font_color_code are inherited from CashflowBase
    # note is inherited from CashflowBase

    model_config = ConfigDict(from_attributes=True) 