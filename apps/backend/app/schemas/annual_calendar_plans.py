from pydantic import BaseModel, Field, ConfigDict, field_validator
from datetime import date, datetime
from typing import Optional, Literal
from uuid import UUID

# Define allowed colors as per database constraint
AllowedColor = Literal['red', 'yellow', 'orange', 'blue', 'green', 'black', 'white', 'purple', 'pink']

# Shared properties
class AnnualCalendarPlanBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500, description="Title of the annual calendar plan")
    description: Optional[str] = Field(None, description="Optional description of the plan")
    start_date: date = Field(..., description="Start date of the plan")
    end_date: date = Field(..., description="End date of the plan")
    color: AllowedColor = Field(default='blue', description="Color of the plan")
    
    @field_validator('end_date')
    def validate_end_date(cls, v, info):
        if info.data and 'start_date' in info.data and v < info.data['start_date']:
            raise ValueError('end_date must be greater than or equal to start_date')
        return v

# Properties to receive via API for creation
class AnnualCalendarPlanCreate(AnnualCalendarPlanBase):
    user_id: UUID = Field(..., description="User ID who owns this plan")

# Properties to receive via API for updates
class AnnualCalendarPlanUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500, description="Updated title")
    description: Optional[str] = Field(None, description="Updated description")
    start_date: Optional[date] = Field(None, description="Updated start date")
    end_date: Optional[date] = Field(None, description="Updated end date")
    color: Optional[AllowedColor] = Field(None, description="Updated color")
    
    @field_validator('end_date')
    def validate_end_date(cls, v, info):
        if v is not None and info.data and 'start_date' in info.data and info.data['start_date'] is not None:
            if v < info.data['start_date']:
                raise ValueError('end_date must be greater than or equal to start_date')
        return v

# Properties shared by models stored in DB
class AnnualCalendarPlanInDBBase(AnnualCalendarPlanBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True # Replaces orm_mode=True
    )

# Properties to return to client
class AnnualCalendarPlan(AnnualCalendarPlanInDBBase):
    pass

# Properties stored in DB
class AnnualCalendarPlanInDB(AnnualCalendarPlanInDBBase):
    pass

# For color-only updates
class AnnualCalendarPlanColorUpdate(BaseModel):
    color: AllowedColor = Field(..., description="New color for the plan")

# For bulk operations or filtering
class AnnualCalendarPlanFilter(BaseModel):
    user_id: Optional[UUID] = Field(None, description="Filter by user ID")
    start_date_from: Optional[date] = Field(None, description="Filter plans starting from this date")
    start_date_to: Optional[date] = Field(None, description="Filter plans starting up to this date")
    end_date_from: Optional[date] = Field(None, description="Filter plans ending from this date")
    end_date_to: Optional[date] = Field(None, description="Filter plans ending up to this date")
    title_contains: Optional[str] = Field(None, description="Filter by title containing this text")
