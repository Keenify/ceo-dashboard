import time
import logging
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.database import get_db
# TODO: Implement centralized authentication system
# from app.auth.dependencies import get_current_user
from app.rag.schemas.rag_schemas import (
    RAGQueryRequest, 
    RAGQueryResponse, 
    RefreshEmbeddingsRequest,
    RefreshEmbeddingsResponse,
    HealthCheckResponse,
    RAGErrorResponse,
    StatsRequest
)
from app.rag.engines.query_engine import WeeklyDesignQueryEngine
from app.rag.services.modules.weekly_design_manager import WeeklyDesignRAGManager

logger = logging.getLogger(__name__)

# Create router for Weekly Design RAG endpoints
router = APIRouter(prefix="/rag/weekly-design", tags=["Weekly Design RAG"])

@router.post("/chat", response_model=RAGQueryResponse)
async def chat_with_weekly_design(
    request: RAGQueryRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Chat with your weekly design data using natural language queries.
    
    Ask questions like:
    - "What's my schedule for Monday?"
    - "What are my goals this week?"
    - "When do I have focus time scheduled?"
    - "What habits am I tracking?"
    
    Request body should include:
    - user_id: UUID of the user
    - question: Your question about weekly design data
    - top_k: (optional) Number of results to retrieve
    - similarity_threshold: (optional) Minimum similarity score
    """
    start_time = time.time()
    
    try:
        user_id = request.user_id
        
        # Initialize query engine
        query_engine = WeeklyDesignQueryEngine()
        
        # Process the query
        result = await query_engine.query(
            question=request.question,
            user_id=user_id,
            db=db,
            top_k=request.top_k,
            similarity_threshold=request.similarity_threshold
        )
        
        processing_time = int((time.time() - start_time) * 1000)
        
        return RAGQueryResponse(
            response=result["response"],
            sources=result["sources"],
            retrieved_count=result["retrieved_count"],
            processing_time_ms=processing_time
        )
        
    except Exception as e:
        logger.error(f"Chat query failed for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process your question: {str(e)}"
        )

@router.post("/refresh", response_model=RefreshEmbeddingsResponse)
async def refresh_embeddings(
    request: RefreshEmbeddingsRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Manually refresh your weekly design embeddings.
    This will re-process all your weekly designs and update the RAG system.
    
    Request body should include:
    - user_id: UUID of the user to refresh embeddings for
    """
    start_time = time.time()
    
    try:
        user_id = request.user_id
        
        # Initialize RAG manager
        rag_manager = WeeklyDesignRAGManager()
        
        # Refresh embeddings for the current user
        stats = await rag_manager.refresh_user_embeddings(user_id, db)
        
        processing_time = int((time.time() - start_time) * 1000)
        
        message = f"Successfully refreshed embeddings: {stats['embeddings_created']} embeddings created from {stats['processed']} weekly designs"
        
        return RefreshEmbeddingsResponse(
            success=True,
            message=message,
            stats=stats,
            processing_time_ms=processing_time
        )
        
    except Exception as e:
        logger.error(f"Embedding refresh failed for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to refresh embeddings: {str(e)}"
        )

@router.post("/refresh-all", response_model=RefreshEmbeddingsResponse)
async def refresh_all_embeddings():
    """
    Refresh embeddings for ALL users with weekly design data.
    This discovers all users automatically and processes their data.
    """
    start_time = time.time()
    
    try:
        # Initialize RAG manager
        rag_manager = WeeklyDesignRAGManager()
        
        # Refresh embeddings for all users (uses existing method)
        stats = await rag_manager.refresh_all_users_embeddings()
        
        processing_time = int((time.time() - start_time) * 1000)
        
        users_processed = stats.get('users_processed', 0)
        total_users = stats.get('total_users', 0)
        total_embeddings = stats.get('total_embeddings', 0)
        
        message = f"Successfully processed {users_processed}/{total_users} users, created {total_embeddings} embeddings"
        
        return RefreshEmbeddingsResponse(
            success=True,
            message=message,
            stats=stats,
            processing_time_ms=processing_time
        )
        
    except Exception as e:
        logger.error(f"All-users embedding refresh failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to refresh embeddings for all users: {str(e)}"
        )

@router.get("/health", response_model=HealthCheckResponse)
async def health_check(
    db: AsyncSession = Depends(get_db)
):
    """
    Check the health of the Weekly Design RAG system.
    This endpoint doesn't require user authentication - it's a system health check.
    """
    try:
        # Initialize query engine for testing
        query_engine = WeeklyDesignQueryEngine()
        
        # Run connection tests
        test_results = await query_engine.test_connection(db)
        
        if "error" in test_results:
            status_val = "unhealthy"
        elif all(test_results.get(key, False) for key in ["embedding_service", "database_connection", "llm_connection"]):
            status_val = "healthy"
        else:
            status_val = "degraded"
        
        return HealthCheckResponse(
            status=status_val,
            services={
                "embedding_service": test_results.get("embedding_service", False),
                "database_connection": test_results.get("database_connection", False),
                "llm_connection": test_results.get("llm_connection", False)
            },
            total_embeddings=test_results.get("total_embeddings", 0),
            embedding_dimension=test_results.get("embedding_dimension", 3072)
        )
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Health check failed: {str(e)}"
        )

@router.post("/stats")
async def get_user_stats(
    request: StatsRequest,
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get embedding statistics for the specified user.
    
    Request body should include:
    - user_id: UUID of the user to get stats for
    """
    try:
        from sqlalchemy import select, func
        from app.rag.models.embeddings import DashboardEmbedding
        
        user_id = request.user_id
        
        # Get total count for weekly_design module
        total_query = select(func.count(DashboardEmbedding.id)).where(
            (DashboardEmbedding.user_id == user_id) &
            (DashboardEmbedding.module_type == 'weekly_design')
        )
        total_result = await db.execute(total_query)
        total_embeddings = total_result.scalar()
        
        # Get breakdown by component type
        component_query = select(
            DashboardEmbedding.component_type,
            func.count(DashboardEmbedding.id)
        ).where(
            (DashboardEmbedding.user_id == user_id) &
            (DashboardEmbedding.module_type == 'weekly_design')
        ).group_by(DashboardEmbedding.component_type)
        
        component_result = await db.execute(component_query)
        component_breakdown = dict(component_result.fetchall())
        
        # Get last updated
        last_updated_query = select(
            func.max(DashboardEmbedding.updated_at)
        ).where(
            (DashboardEmbedding.user_id == user_id) &
            (DashboardEmbedding.module_type == 'weekly_design')
        )
        
        last_updated_result = await db.execute(last_updated_query)
        last_updated = last_updated_result.scalar()
        
        return {
            "user_id": user_id,
            "total_embeddings": total_embeddings,
            "component_breakdown": component_breakdown,
            "last_updated": last_updated.isoformat() if last_updated else None,
            "has_data": total_embeddings > 0
        }
        
    except Exception as e:
        logger.error(f"Stats query failed for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user stats: {str(e)}"
        )