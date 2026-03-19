from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import date, datetime

class WeeklyGoal(BaseModel):
    goal: str = Field(..., description="Goal for the week")
    target_completion_by: Optional[str] = Field(None, description="Target completion date or milestone")

class WeeklyAction(BaseModel):
    action_item: str = Field(..., description="Action item taken during the week")
    outcome: Optional[str] = Field(None, description="Outcome of the action item")

class WeeklyChallenge(BaseModel):
    challenge: str = Field(..., description="Challenge faced during the week")
    note: Optional[str] = Field(None, description="Additional notes about the challenge")

class WeeklyNextGoal(BaseModel):
    goal: str = Field(..., description="Goal for the next week")
    help_needed: Optional[str] = Field(None, description="Help needed to achieve the goal")

class WeeklyRhythmBase(BaseModel):
    week_start_date: date = Field(..., description="Start date of the week (Monday)")
    most_significant_moment: Optional[str] = Field(None, description="Most significant moment of the week")
    goals: Optional[List[WeeklyGoal]] = Field(None, description="List of goals for the week")
    actions: Optional[List[WeeklyAction]] = Field(None, description="List of actions taken during the week")
    challenges: Optional[List[WeeklyChallenge]] = Field(None, description="List of challenges faced during the week")
    next_goals: Optional[List[WeeklyNextGoal]] = Field(None, description="Goals for the next week")

class WeeklyRhythmCreate(WeeklyRhythmBase):
    user_id: UUID = Field(..., description="ID of the user who owns this weekly rhythm")

class WeeklyRhythmUpdate(BaseModel):
    week_start_date: Optional[date] = Field(None, description="Start date of the week (Monday)")
    most_significant_moment: Optional[str] = Field(None, description="Most significant moment of the week")
    goals: Optional[List[WeeklyGoal]] = Field(None, description="List of goals for the week")
    actions: Optional[List[WeeklyAction]] = Field(None, description="List of actions taken during the week")
    challenges: Optional[List[WeeklyChallenge]] = Field(None, description="List of challenges faced during the week")
    next_goals: Optional[List[WeeklyNextGoal]] = Field(None, description="Goals for the next week")

class WeeklyRhythmResponse(WeeklyRhythmBase):
    id: UUID = Field(..., description="Unique identifier for the weekly rhythm")
    user_id: UUID = Field(..., description="ID of the user who owns this weekly rhythm")
    created_at: datetime = Field(..., description="Timestamp when the record was created")
    updated_at: datetime = Field(..., description="Timestamp when the record was last updated")

    model_config = ConfigDict(from_attributes=True) 