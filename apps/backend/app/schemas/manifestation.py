from typing import List, Literal, Optional, Any, Union
from pydantic import BaseModel, Field, ConfigDict, field_validator
from uuid import UUID
from datetime import datetime

ManifestationCategory = Literal['personal', 'business']


class TargetItem(BaseModel):
    """Schema for a target item with completion status"""
    text: str = Field(..., description="The target text")
    completed: bool = Field(default=False, description="Whether the target is completed")


class CourageItem(BaseModel):
    """Schema for a courage list item with completion status"""
    text: str = Field(..., description="The courage item text")
    completed: bool = Field(default=False, description="Whether the courage item is completed")


class ManifestationBase(BaseModel):
    """
    Base schema for the Manifestation model.
    """
    strong_life_changes: List[str] = Field(..., description="List of 5 strong life changes")
    big_targets: List[Union[str, TargetItem]] = Field(..., description="List of 5 big targets with completion status")
    top_values: List[str] = Field(..., description="List of 5 top values")
    non_negotiables: List[str] = Field(..., description="List of 5 main non-negotiables")
    life_rules: List[str] = Field(..., description="List of 5 key life rules")
    rituals: List[str] = Field(..., description="List of 5 best rituals")
    courage_list: Optional[List[Union[str, CourageItem]]] = Field(None, description="List describing moments of courage with completion status.")
    year: Optional[int] = Field(None, description="The specific year this manifestation applies to (optional, 1000-9999).")
    theme: Optional[str] = Field(None, description="Optional theme for the manifestation/year.")
    category: ManifestationCategory = Field('personal', description="Category: personal or business.")

    @field_validator('year')
    def validate_year(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not (1000 <= v <= 9999):
            raise ValueError('Year must be between 1000 and 9999')
        return v


class ManifestationCreate(ManifestationBase):
    user_id: UUID = Field(..., description="ID of the user who owns this manifestation")


class ManifestationUpdate(BaseModel):
    """
    Schema for updating a Manifestation; all fields are optional.
    """
    strong_life_changes: Optional[List[str]] = Field(None, description="List of 5 strong life changes")
    big_targets: Optional[List[Union[str, TargetItem]]] = Field(None, description="List of 5 big targets with completion status")
    top_values: Optional[List[str]] = Field(None, description="List of 5 top values")
    non_negotiables: Optional[List[str]] = Field(None, description="List of 5 main non-negotiables")
    life_rules: Optional[List[str]] = Field(None, description="List of 5 key life rules")
    rituals: Optional[List[str]] = Field(None, description="List of 5 best rituals")
    courage_list: Optional[List[Union[str, CourageItem]]] = Field(None, description="List describing moments of courage with completion status.")
    year: Optional[int] = Field(None, description="The specific year this manifestation applies to (optional, 1000-9999).")
    theme: Optional[str] = Field(None, description="Optional theme for the manifestation/year.")
    category: Optional[ManifestationCategory] = Field(None, description="Category: personal or business.")

    @field_validator('year')
    def validate_year_update(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not (1000 <= v <= 9999):
            raise ValueError('Year must be between 1000 and 9999')
        return v


class ManifestationResponse(ManifestationBase):
    id: UUID = Field(..., description="Unique identifier for the manifestation")
    user_id: UUID = Field(..., description="ID of the user who owns this manifestation")
    courage_list: List[Union[str, CourageItem]] = Field(..., description="List describing moments of courage with completion status.")
    created_at: datetime = Field(..., description="Timestamp when the record was created")
    updated_at: datetime = Field(..., description="Timestamp when the record was last updated")

    model_config = ConfigDict(from_attributes=True) 