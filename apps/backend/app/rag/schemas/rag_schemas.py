from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime

class RAGQueryRequest(BaseModel):
    """Request schema for RAG queries."""
    user_id: UUID = Field(..., description="User UUID for data isolation")
    question: str = Field(..., min_length=1, max_length=500, description="User's question about their weekly design")
    top_k: Optional[int] = Field(5, ge=1, le=20, description="Number of similar documents to retrieve")
    similarity_threshold: Optional[float] = Field(0.5, ge=0.0, le=1.0, description="Minimum similarity score to consider")

class RAGSource(BaseModel):
    """Schema for RAG response sources."""
    component_type: str = Field(..., description="Type of weekly design component")
    week_start_date: Optional[str] = Field(None, description="Week start date in YYYY-MM-DD format")
    similarity_score: float = Field(..., description="Similarity score between 0 and 1")
    content_preview: str = Field(..., description="Preview of the retrieved content")

class RAGQueryResponse(BaseModel):
    """Response schema for RAG queries."""
    response: str = Field(..., description="Generated response to the user's question")
    sources: List[RAGSource] = Field(..., description="List of sources used to generate the response")
    retrieved_count: int = Field(..., description="Number of documents retrieved")
    processing_time_ms: Optional[int] = Field(None, description="Query processing time in milliseconds")

class RefreshEmbeddingsRequest(BaseModel):
    """Request schema for manual embedding refresh."""
    user_id: UUID = Field(..., description="User UUID to refresh embeddings for")

class RefreshEmbeddingsResponse(BaseModel):
    """Response schema for embedding refresh operations."""
    success: bool = Field(..., description="Whether the refresh was successful")
    message: str = Field(..., description="Human-readable status message")
    stats: Dict[str, Any] = Field(..., description="Refresh statistics")
    processing_time_ms: int = Field(..., description="Refresh processing time in milliseconds")

class StatsRequest(BaseModel):
    """Request schema for user embedding statistics."""
    user_id: UUID = Field(..., description="User UUID to get stats for")

class EmbeddingStats(BaseModel):
    """Schema for embedding statistics."""
    user_id: UUID = Field(..., description="User UUID")
    total_embeddings: int = Field(..., description="Total number of embeddings for user")
    component_breakdown: Dict[str, int] = Field(..., description="Count by component type")
    last_updated: Optional[datetime] = Field(None, description="Last update timestamp")

class HealthCheckResponse(BaseModel):
    """Schema for RAG system health check."""
    status: str = Field(..., description="System status (healthy/degraded/unhealthy)")
    services: Dict[str, bool] = Field(..., description="Individual service status")
    total_embeddings: int = Field(..., description="Total embeddings in system")
    embedding_dimension: int = Field(..., description="Embedding vector dimension")
    last_refresh: Optional[datetime] = Field(None, description="Last bulk refresh timestamp")

# Error response schemas
class RAGErrorResponse(BaseModel):
    """Schema for RAG error responses."""
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")

# Configuration schemas
class RAGConfig(BaseModel):
    """Schema for RAG system configuration."""
    embedding_model: str = Field("text-embedding-3-large", description="OpenAI embedding model")
    llm_model: str = Field("gpt-4o-mini", description="OpenAI LLM model for responses")
    chunk_size: int = Field(768, description="Text chunk size for documents")
    top_k_default: int = Field(5, description="Default number of documents to retrieve")
    similarity_threshold_default: float = Field(0.7, description="Default similarity threshold")