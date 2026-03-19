from typing import Optional, Dict, Any, List, Literal
from pydantic import BaseModel, Field, field_validator, ConfigDict
from uuid import UUID
from datetime import datetime

# Type alias for message senders
MessageSender = Literal["user", "ai"]

# ================================
# AI Journal Session Schemas
# ================================

class AIJournalSessionBase(BaseModel):
    """Base model for AI journal session data."""
    prompt_text: Optional[str] = Field(None, description="Initial prompt text for the session")

class AIJournalSessionCreate(BaseModel):
    """Model for creating a new AI journal session."""
    user_id: UUID = Field(..., description="ID of the user who owns the session")
    prompt_text: Optional[str] = Field(None, description="Initial prompt text for the session")

class AIJournalSessionUpdate(BaseModel):
    """Model for updating an existing AI journal session."""
    prompt_text: Optional[str] = Field(None, description="Updated prompt text for the session")
    ended_at: Optional[datetime] = Field(None, description="Timestamp when the session ended")

class AIJournalSessionResponse(AIJournalSessionBase):
    """Model for AI journal session response."""
    id: UUID = Field(..., description="Unique identifier for the session")
    user_id: UUID = Field(..., description="ID of the user who owns the session")
    started_at: datetime = Field(..., description="Timestamp when the session started")
    ended_at: Optional[datetime] = Field(None, description="Timestamp when the session ended")
    
    # Optional nested relationships
    messages: Optional[List["AIJournalMessageResponse"]] = Field(None, description="Messages in this session")
    analysis: Optional["AIJournalAnalysisResponse"] = Field(None, description="Analysis of this session")
    artworks: Optional[List["AIJournalArtworkResponse"]] = Field(None, description="Artworks for this session")

    model_config = ConfigDict(from_attributes=True)

# ================================
# AI Journal Message Schemas  
# ================================

class AIJournalMessageBase(BaseModel):
    """Base model for AI journal message data."""
    sender: MessageSender = Field(..., description="Who sent the message: user or ai")
    content: str = Field(..., description="Content of the message")
    seq: Optional[int] = Field(None, description="Sequence number of the message in the session")

    @field_validator("sender")
    @classmethod
    def validate_sender(cls, v: str) -> str:
        """Validate that sender is either 'user' or 'ai'."""
        if v not in ["user", "ai"]:
            raise ValueError("sender must be either 'user' or 'ai'")
        return v

class AIJournalMessageCreate(AIJournalMessageBase):
    """Model for creating a new AI journal message."""
    session_id: UUID = Field(..., description="ID of the session this message belongs to")

class AIJournalMessageCreatePayload(BaseModel):
    """Model for the payload when creating a new message via API."""
    content: str = Field(..., description="Content of the message")
    sender: MessageSender = Field(..., description="Who sent the message: user or ai")

    @field_validator("sender")
    @classmethod
    def validate_sender(cls, v: str) -> str:
        """Validate that sender is either 'user' or 'ai'."""
        if v not in ["user", "ai"]:
            raise ValueError("sender must be either 'user' or 'ai'")
        return v

class AIJournalMessageUpdate(BaseModel):
    """Model for updating an existing AI journal message."""
    content: Optional[str] = Field(None, description="Updated content of the message")
    seq: Optional[int] = Field(None, description="Updated sequence number")

class AIJournalMessageResponse(AIJournalMessageBase):
    """Model for AI journal message response."""
    id: UUID = Field(..., description="Unique identifier for the message")
    session_id: UUID = Field(..., description="ID of the session this message belongs to")
    created_at: datetime = Field(..., description="Timestamp when the message was created")

    model_config = ConfigDict(from_attributes=True)

# ================================
# AI Journal Analysis Schemas
# ================================

class AIJournalAnalysisBase(BaseModel):
    """Base model for AI journal analysis data."""
    summary_md: Optional[str] = Field(None, description="Summary of the session in markdown format")
    emotions: Optional[Dict[str, Any]] = Field(None, description="Emotional analysis with confidence scores")
    model: Optional[str] = Field(None, description="AI model used for analysis")

class AIJournalAnalysisCreate(AIJournalAnalysisBase):
    """Model for creating a new AI journal analysis."""
    session_id: UUID = Field(..., description="ID of the session this analysis belongs to")

class AIJournalAnalysisCreatePayload(AIJournalAnalysisBase):
    """Model for the payload when creating analysis via API (without session_id)."""
    pass

class AIJournalAnalysisUpdate(BaseModel):
    """Model for updating an existing AI journal analysis."""
    summary_md: Optional[str] = Field(None, description="Updated summary in markdown format")
    emotions: Optional[Dict[str, Any]] = Field(None, description="Updated emotional analysis")
    model: Optional[str] = Field(None, description="Updated AI model information")

class AIJournalAnalysisResponse(AIJournalAnalysisBase):
    """Model for AI journal analysis response."""
    session_id: UUID = Field(..., description="ID of the session this analysis belongs to")
    created_at: datetime = Field(..., description="Timestamp when the analysis was created")

    model_config = ConfigDict(from_attributes=True)

# ================================
# AI Journal Artwork Schemas
# ================================

class AIJournalArtworkBase(BaseModel):
    """Base model for AI journal artwork data."""
    image_path: Optional[str] = Field(None, description="Path to the generated image")
    style: Optional[str] = Field(None, description="Style of the generated artwork")

class AIJournalArtworkCreate(AIJournalArtworkBase):
    """Model for creating a new AI journal artwork."""
    session_id: UUID = Field(..., description="ID of the session this artwork belongs to")

class AIJournalArtworkUpdate(BaseModel):
    """Model for updating an existing AI journal artwork."""
    image_path: Optional[str] = Field(None, description="Updated image path")
    style: Optional[str] = Field(None, description="Updated artwork style")

class AIJournalArtworkResponse(AIJournalArtworkBase):
    """Model for AI journal artwork response."""
    id: UUID = Field(..., description="Unique identifier for the artwork")
    session_id: UUID = Field(..., description="ID of the session this artwork belongs to")
    created_at: datetime = Field(..., description="Timestamp when the artwork was created")

    model_config = ConfigDict(from_attributes=True)

# ================================
# WebSocket Message Schemas
# ================================

class WebSocketMessage(BaseModel):
    """Base model for WebSocket messages."""
    type: str = Field(..., description="Type of the WebSocket message")
    content: Optional[str] = Field(None, description="Content of the message")
    timestamp: Optional[str] = Field(None, description="Timestamp of the message")

class WebSocketUserMessage(WebSocketMessage):
    """Model for user messages sent via WebSocket."""
    type: Literal["user_message"] = "user_message"
    content: str = Field(..., description="User message content")

class WebSocketAIResponse(WebSocketMessage):
    """Model for AI responses sent via WebSocket."""
    type: Literal["ai_response"] = "ai_response"
    content: str = Field(..., description="AI response content")
    timestamp: str = Field(..., description="Timestamp of the AI response")

class WebSocketSystemMessage(WebSocketMessage):
    """Model for system messages sent via WebSocket."""
    type: Literal["system"] = "system"
    message: str = Field(..., description="System message content")

class WebSocketEndSession(BaseModel):
    """Model for ending a session via WebSocket."""
    type: Literal["end_session"] = "end_session"

class WebSocketSessionEnded(BaseModel):
    """Model for session ended notification via WebSocket."""
    type: Literal["session_ended"] = "session_ended"
    message: str = Field(..., description="Session ended notification message")

# ================================
# Bulk Operations Schemas
# ================================

class AIJournalSessionSummary(BaseModel):
    """Model for AI journal session summary."""
    id: UUID = Field(..., description="Session ID")
    started_at: datetime = Field(..., description="When the session started")
    ended_at: Optional[datetime] = Field(None, description="When the session ended")
    message_count: int = Field(..., description="Number of messages in the session")
    has_analysis: bool = Field(..., description="Whether the session has analysis")
    has_artworks: bool = Field(..., description="Whether the session has artworks")

class AIJournalDashboard(BaseModel):
    """Model for AI journal dashboard data."""
    total_sessions: int = Field(..., description="Total number of sessions")
    sessions_this_week: int = Field(..., description="Number of sessions this week")
    sessions_this_month: int = Field(..., description="Number of sessions this month")
    recent_sessions: List[AIJournalSessionSummary] = Field(..., description="Recent sessions")
    common_emotions: Dict[str, float] = Field(..., description="Most common emotions detected")

# Update forward references
AIJournalSessionResponse.model_rebuild() 