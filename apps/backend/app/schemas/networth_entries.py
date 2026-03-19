from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal

NetworthType = Literal['personal', 'business']
NetworthCategory = Literal['asset', 'liability']

class NetworthEntryBase(BaseModel):
    type: NetworthType = Field(..., description="Type of net worth: 'personal' or 'business'.")
    category: NetworthCategory = Field(..., description="Category: 'asset' or 'liability'.")
    snapshot_date: date = Field(..., description="Date of the net worth snapshot.")
    section: str = Field(..., min_length=1, description="User-defined section for grouping entries (e.g., 'Real Estate').")
    name: Optional[str] = Field(None, min_length=1, description="Specific name of the asset or liability (e.g., 'Primary Residence').")
    value: Optional[Decimal] = Field(None, max_digits=12, decimal_places=2, description="Value of the asset or liability at the snapshot_date.")

    model_config = ConfigDict(extra='forbid') # Forbid unspecified fields

class NetworthEntryCreate(NetworthEntryBase):
    user_id: UUID = Field(..., description="ID of the user who owns this net worth entry.")
    # 'name' and 'value' are optional as inherited from NetworthEntryBase,
    # allowing creation of an entry with just section, type, category, and date.

class NetworthEntryUpdate(BaseModel):
    type: Optional[NetworthType] = Field(None, description="Type of net worth: 'personal' or 'business'.")
    category: Optional[NetworthCategory] = Field(None, description="Category: 'asset' or 'liability'.")
    snapshot_date: Optional[date] = Field(None, description="Date of the net worth snapshot.")
    section: Optional[str] = Field(None, min_length=1, description="User-defined section for grouping entries.")
    name: Optional[str] = Field(None, min_length=1, description="Specific name of the asset or liability.")
    value: Optional[Decimal] = Field(None, max_digits=12, decimal_places=2, description="Value of the asset or liability.")

    # Allow partial updates: if a field is not provided, it's not updated.
    # model_config = ConfigDict(exclude_unset=True) # This is behavior of model_dump, not config for model itself
    model_config = ConfigDict(extra='forbid')

class NetworthEntryResponse(NetworthEntryBase):
    id: UUID = Field(..., description="Unique identifier for the net worth entry.")
    user_id: UUID = Field(..., description="ID of the user who owns this net worth entry.")
    created_at: datetime = Field(..., description="Timestamp when the record was created.")
    updated_at: datetime = Field(..., description="Timestamp when the record was last updated.")

    model_config = ConfigDict(from_attributes=True) # Enable ORM mode

class NetworthSectionRename(BaseModel):
    old_section_name: str = Field(..., min_length=1, description="Current section name to be renamed.")
    new_section_name: str = Field(..., min_length=1, description="New section name.")
    entry_type: NetworthType = Field(..., description="Type of net worth: 'personal' or 'business'.")
    entry_category: NetworthCategory = Field(..., description="Category: 'asset' or 'liability'.")

    model_config = ConfigDict(extra='forbid')
