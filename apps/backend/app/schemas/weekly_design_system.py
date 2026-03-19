from typing import Dict, List, Optional, Union, Any
from datetime import datetime, date
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict

class NextGoal(BaseModel):
    goal: str = Field(..., description="Goal description")

class PersonalGoal(BaseModel):
    goal: str = Field(..., description="Personal goal description")

class WeeklyDesignSystemBase(BaseModel):
    week_start_date: date = Field(..., description="Start date of the week")
    next_goals: List[NextGoal] = Field(default_factory=list, description="Goals for the next 7 days")
    personal_goals: List[PersonalGoal] = Field(default_factory=list, description="Personal goals for the week")
    time_blocks: Union[
        Dict[str, Dict[str, str]],           # New format: {"monday": {"08:00": "Meeting"}}
        Dict[str, Any]                       # Old format: flexible for backward compatibility
    ] = Field(..., description="Daily time blocks")
    daily_checklists: Union[
        Dict[str, Dict[str, List[str]]],     # New format: {"monday": {"gratitude": ["Family"]}}
        Dict[str, Any]                       # Old format: flexible for backward compatibility
    ] = Field(..., description="Daily checklists")

    model_config = ConfigDict(
        from_attributes=True,
        arbitrary_types_allowed=True,
        json_schema_extra={
            "example": {
                "week_start_date": "2024-03-18",
                "next_goals": [
                    {"goal": "Complete project proposal"},
                    {"goal": "Schedule team meeting"},
                    {"goal": "Review quarterly reports"}
                ],
                "personal_goals": [
                    {"goal": "Exercise 3 times this week"},
                    {"goal": "Read 1 book chapter"}
                ],
                "time_blocks": {
                    "Monday": {"9:00": "Meeting"}
                },
                "daily_checklists": {
                    "Monday": {
                        "gratitude": ["Family"],
                        "habits": ["Exercise"]
                    }
                }
            }
        }
    )

class WeeklyDesignSystemCreate(WeeklyDesignSystemBase):
    pass

class WeeklyDesignSystemUpdate(BaseModel):
    week_start_date: Optional[date] = None
    next_goals: Optional[List[NextGoal]] = None
    personal_goals: Optional[List[PersonalGoal]] = None
    time_blocks: Optional[Union[
        Dict[str, Dict[str, str]],           # New format
        Dict[str, Any]                       # Old format: flexible for backward compatibility
    ]] = None
    daily_checklists: Optional[Union[
        Dict[str, Dict[str, List[str]]],     # New format
        Dict[str, Any]                       # Old format: flexible for backward compatibility
    ]] = None

    model_config = ConfigDict(
        from_attributes=True,
        arbitrary_types_allowed=True
    )

class WeeklyDesignSystemInDB(WeeklyDesignSystemBase):
    id: UUID
    user_id: UUID
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    model_config = ConfigDict(
        from_attributes=True,
        arbitrary_types_allowed=True
    )

class WeeklyDesignSystem(WeeklyDesignSystemInDB):
    pass 