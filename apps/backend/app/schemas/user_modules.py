from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime


class UserModulesBase(BaseModel):
    """
    Base schema for the UserModules model.
    Contains the core fields for user module subscriptions.
    """
    stripe_customer_id: str = Field(..., description="Stripe Customer ID associated with the user")
    stripe_subscription_item_id: str = Field(..., description="Stripe Subscription Item ID for this module")
    product_id: str = Field(..., description="Stripe Product ID for the module")
    price_id: str = Field(..., description="Stripe Price ID for the module subscription")
    status: str = Field(..., description="Subscription status: 'active', 'cancelled', or 'paused'")
    start_date: datetime = Field(..., description="Timestamp when the subscription started")
    end_date: Optional[datetime] = Field(None, description="Timestamp when the subscription ends (nullable for ongoing subscriptions)")


class UserModulesCreate(UserModulesBase):
    """
    Schema for creating a new UserModules record.
    """
    user_id: UUID = Field(..., description="ID of the user who owns this subscription")


class UserModulesUpdate(BaseModel):
    """
    Schema for updating a UserModules record.
    All fields are optional for partial updates.
    """
    stripe_customer_id: Optional[str] = Field(None, description="Updated Stripe Customer ID")
    stripe_subscription_item_id: Optional[str] = Field(None, description="Updated Stripe Subscription Item ID")
    product_id: Optional[str] = Field(None, description="Updated Stripe Product ID")
    price_id: Optional[str] = Field(None, description="Updated Stripe Price ID")
    status: Optional[str] = Field(None, description="Updated subscription status")
    start_date: Optional[datetime] = Field(None, description="Updated subscription start date")
    end_date: Optional[datetime] = Field(None, description="Updated subscription end date")


class UserModulesResponse(UserModulesBase):
    """
    Schema for UserModules response data.
    """
    id: UUID = Field(..., description="Unique identifier for the user modules record")
    user_id: UUID = Field(..., description="ID of the user who owns this subscription")
    updated_at: datetime = Field(..., description="Timestamp when the record was last updated")

    model_config = ConfigDict(from_attributes=True)
