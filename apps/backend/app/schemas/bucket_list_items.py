from typing import Dict, List, Optional, Any
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict, field_validator

class BucketListItem(BaseModel):
    """Individual bucket list item with completion status."""
    text: str = Field(..., description="The bucket list item text")
    completed: bool = Field(default=False, description="Whether the item is completed")

class BucketListItemsBase(BaseModel):
    category: str = Field(..., description="Category of the bucket list items")
    items: List[BucketListItem] = Field(default_factory=list, description="List of bucket list items with completion status")
    sort_order: int = Field(default=0, description="Position order for bucket category display")

    @field_validator('items', mode='before')
    @classmethod
    def validate_items_structure(cls, v):
        """Convert old format or dict to new BucketListItem format."""
        if isinstance(v, dict):
            # Handle old format: {"items": ["text1", "text2"], "completed": ["text1"]}
            if 'items' in v and 'completed' in v:
                items_list = v.get('items', [])
                completed_list = v.get('completed', [])
                return [
                    BucketListItem(text=item, completed=item in completed_list)
                    for item in items_list
                ]
            # Handle direct dict format
            return [BucketListItem(**item) if isinstance(item, dict) else BucketListItem(text=str(item)) for item in v]
        elif isinstance(v, list):
            # Handle list of dicts or strings
            return [
                BucketListItem(**item) if isinstance(item, dict) 
                else BucketListItem(text=str(item)) 
                for item in v
            ]
        return v

    model_config = ConfigDict(
        from_attributes=True,
        arbitrary_types_allowed=True,
        json_schema_extra={
            "example": {
                "category": "Travel",
                "items": [
                    {"text": "Visit Japan", "completed": False},
                    {"text": "See Northern Lights in Iceland", "completed": True},
                    {"text": "Explore New Zealand", "completed": False}
                ],
                "sort_order": 0
            }
        }
    )

class BucketListItemsCreate(BucketListItemsBase):
    pass

class BucketListItemsUpdate(BaseModel):
    category: Optional[str] = None
    items: Optional[List[BucketListItem]] = None
    sort_order: Optional[int] = None

    @field_validator('items', mode='before')
    @classmethod
    def validate_items_structure(cls, v):
        """Convert old format or dict to new BucketListItem format."""
        if v is None:
            return v
        if isinstance(v, dict):
            # Handle old format: {"items": ["text1", "text2"], "completed": ["text1"]}
            if 'items' in v and 'completed' in v:
                items_list = v.get('items', [])
                completed_list = v.get('completed', [])
                return [
                    BucketListItem(text=item, completed=item in completed_list)
                    for item in items_list
                ]
            # Handle direct dict format
            return [BucketListItem(**item) if isinstance(item, dict) else BucketListItem(text=str(item)) for item in v]
        elif isinstance(v, list):
            # Handle list of dicts or strings
            return [
                BucketListItem(**item) if isinstance(item, dict) 
                else BucketListItem(text=str(item)) 
                for item in v
            ]
        return v

    model_config = ConfigDict(
        from_attributes=True,
        arbitrary_types_allowed=True
    )

class BucketListItemsInDB(BucketListItemsBase):
    id: UUID
    user_id: UUID
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    model_config = ConfigDict(
        from_attributes=True,
        arbitrary_types_allowed=True
    )

class BucketListItems(BucketListItemsInDB):
    pass

class BucketPositionUpdate(BaseModel):
    """Schema for updating bucket position in reorder operation."""
    bucket_id: UUID = Field(..., description="ID of the bucket to reorder")
    sort_order: int = Field(..., description="New position for the bucket")

class BucketReorderRequest(BaseModel):
    """Schema for bucket reorder API request."""
    bucket_positions: List[BucketPositionUpdate] = Field(
        ..., 
        description="List of bucket positions to update"
    )
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "bucket_positions": [
                    {"bucket_id": "550e8400-e29b-41d4-a716-446655440000", "sort_order": 0},
                    {"bucket_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8", "sort_order": 1},
                    {"bucket_id": "6ba7b811-9dad-11d1-80b4-00c04fd430c8", "sort_order": 2}
                ]
            }
        }
    ) 