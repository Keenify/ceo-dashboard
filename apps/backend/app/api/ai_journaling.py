from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from datetime import datetime, timedelta, timezone

from app.database.database import get_db
from app.crud.ai_journaling import (
    CRUDAIJournalSession,
    CRUDAIJournalMessage,
    CRUDAIJournalAnalysis,
    CRUDAIJournalArtwork,
    websocket_manager
)
from app.schemas.ai_journaling import (
    AIJournalSessionCreate,
    AIJournalSessionUpdate,
    AIJournalSessionResponse,
    AIJournalMessageCreate,
    AIJournalMessageCreatePayload,
    AIJournalMessageResponse,
    AIJournalAnalysisCreate,
    AIJournalAnalysisCreatePayload,
    AIJournalAnalysisUpdate,
    AIJournalAnalysisResponse,
    AIJournalArtworkCreate,
    AIJournalArtworkUpdate,
    AIJournalArtworkResponse,
    AIJournalSessionSummary,
    AIJournalDashboard
)

router = APIRouter()

# ================================
# SESSION ENDPOINTS
# ================================

@router.post("/sessions", response_model=AIJournalSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    *,
    db: AsyncSession = Depends(get_db),
    session_in: AIJournalSessionCreate
) -> AIJournalSessionResponse:
    """Create a new AI journaling session."""
    crud = CRUDAIJournalSession(db)
    try:
        session = await crud.create(obj_in=session_in)
        return AIJournalSessionResponse.model_validate(session)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/sessions/today", response_model=AIJournalSessionResponse)
async def get_today_session(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID
) -> AIJournalSessionResponse:
    """Get or create today's journaling session for a user."""
    crud = CRUDAIJournalSession(db)
    try:
        session = await crud.get_today_session(user_id=user_id)
        return AIJournalSessionResponse.model_validate(session)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/sessions/{session_id}", response_model=AIJournalSessionResponse)
async def get_session(
    *,
    db: AsyncSession = Depends(get_db),
    session_id: UUID,
    user_id: UUID
) -> AIJournalSessionResponse:
    """Get a specific AI journaling session."""
    crud = CRUDAIJournalSession(db)
    session = await crud.get(id=session_id, user_id=user_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI journaling session not found"
        )
    return AIJournalSessionResponse.model_validate(session)

@router.get("/sessions", response_model=List[AIJournalSessionSummary])
async def get_user_sessions(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID,
    skip: int = 0,
    limit: int = 20
) -> List[AIJournalSessionSummary]:
    """Get all AI journaling sessions for a user."""
    crud = CRUDAIJournalSession(db)
    sessions = await crud.get_multi_by_user(user_id=user_id, skip=skip, limit=limit)
    
    # Convert to summary format
    summaries = []
    for session in sessions:
        summaries.append(AIJournalSessionSummary(
            id=session.id,
            started_at=session.started_at,
            ended_at=session.ended_at,
            message_count=len(session.messages) if session.messages else 0,
            has_analysis=session.analysis is not None,
            has_artworks=len(session.artworks) > 0 if session.artworks else False
        ))
    
    return summaries

@router.put("/sessions/{session_id}", response_model=AIJournalSessionResponse)
async def update_session(
    *,
    db: AsyncSession = Depends(get_db),
    session_id: UUID,
    user_id: UUID,
    session_in: AIJournalSessionUpdate
) -> AIJournalSessionResponse:
    """Update an AI journaling session."""
    crud = CRUDAIJournalSession(db)
    session = await crud.get(id=session_id, user_id=user_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI journaling session not found"
        )
    try:
        updated_session = await crud.update(db_obj=session, obj_in=session_in)
        return AIJournalSessionResponse.model_validate(updated_session)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/sessions/{session_id}/end", response_model=AIJournalSessionResponse)
async def end_session(
    *,
    db: AsyncSession = Depends(get_db),
    session_id: UUID,
    user_id: UUID
) -> AIJournalSessionResponse:
    """End an AI journaling session and generate analysis."""
    print(f"🔚 API: Starting end_session for session {session_id}, user {user_id}")
    crud = CRUDAIJournalSession(db)
    try:
        print(f"📞 API: Calling crud.end_session...")
        ended_session = await crud.end_session(session_id=session_id, user_id=user_id)
        
        if not ended_session:
            print(f"❌ API: No session returned from crud.end_session")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="AI journaling session not found"
            )
        
        print(f"✅ API: Session returned from crud, validating with Pydantic...")
        print(f"📊 API: Session type: {type(ended_session)}")
        print(f"📊 API: Session id: {ended_session.id}")
        print(f"📊 API: Session ended_at: {ended_session.ended_at}")
        print(f"📊 API: Session has analysis: {hasattr(ended_session, 'analysis') and ended_session.analysis is not None}")
        
        try:
            response = AIJournalSessionResponse.model_validate(ended_session)
            print(f"✅ API: Pydantic validation successful")
            return response
        except Exception as validation_error:
            print(f"❌ API: Pydantic validation failed: {validation_error}")
            print(f"❌ API: Validation error type: {type(validation_error).__name__}")
            import traceback
            print(f"❌ API: Validation traceback: {traceback.format_exc()}")
            raise validation_error
            
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        print(f"❌ API: Unexpected error in end_session: {e}")
        print(f"❌ API: Error type: {type(e).__name__}")
        import traceback
        print(f"❌ API: Full traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    *,
    db: AsyncSession = Depends(get_db),
    session_id: UUID,
    user_id: UUID
) -> None:
    """Delete an AI journaling session."""
    crud = CRUDAIJournalSession(db)
    session = await crud.get(id=session_id, user_id=user_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI journaling session not found"
        )
    await crud.remove(id=session_id, user_id=user_id)

@router.post("/sessions/start-new", response_model=AIJournalSessionResponse, status_code=status.HTTP_201_CREATED)
async def start_new_session(
    *,
    db: AsyncSession = Depends(get_db),
    session_in: AIJournalSessionCreate
) -> AIJournalSessionResponse:
    """Start a new AI journaling session, ending any active session first."""
    crud = CRUDAIJournalSession(db)
    try:
        print(f"🚀 Starting new session for user: {session_in.user_id}")
        
        # Check for existing active session
        print(f"🔍 Checking for active sessions...")
        active_session = await crud.get_active_session_for_user(user_id=session_in.user_id)
        print(f"📊 Active session found: {active_session.id if active_session else 'None'}")
        
        if active_session:
            print(f"🔚 Ending existing session: {active_session.id}")
            # End the existing session (this will save messages and generate analysis)
            await crud.end_session(session_id=active_session.id, user_id=session_in.user_id)
            print(f"✅ Existing session ended successfully")
        
        # Create new session
        print(f"🆕 Creating new session...")
        new_session = await crud.create(obj_in=session_in)
        print(f"✅ New session created: {new_session.id}")
        return AIJournalSessionResponse.model_validate(new_session)
    except Exception as e:
        print(f"❌ Error in start_new_session: {e}")
        print(f"❌ Exception type: {type(e).__name__}")
        import traceback
        print(f"❌ Full traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error starting new session: {str(e)}"
        )

# ================================
# MESSAGE ENDPOINTS
# ================================

@router.get("/sessions/{session_id}/messages", response_model=List[AIJournalMessageResponse])
async def get_session_messages(
    *,
    db: AsyncSession = Depends(get_db),
    session_id: UUID,
    skip: int = 0,
    limit: int = 100
) -> List[AIJournalMessageResponse]:
    """Get all messages for a specific session."""
    crud = CRUDAIJournalMessage(db)
    messages = await crud.get_session_messages(session_id=session_id, skip=skip, limit=limit)
    return [AIJournalMessageResponse.model_validate(m) for m in messages]

@router.post("/sessions/{session_id}/messages", response_model=AIJournalMessageResponse, status_code=status.HTTP_201_CREATED)
async def create_message(
    *,
    db: AsyncSession = Depends(get_db),
    session_id: UUID,
    message_payload: AIJournalMessageCreatePayload
) -> AIJournalMessageResponse:
    """Create a new message in a session."""
    message_in = AIJournalMessageCreate(
        session_id=session_id,
        **message_payload.model_dump()
    )
    
    crud = CRUDAIJournalMessage(db)
    try:
        message = await crud.create(obj_in=message_in)
        return AIJournalMessageResponse.model_validate(message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/sessions/{session_id}/ai-response", response_model=AIJournalMessageResponse, status_code=status.HTTP_201_CREATED)
async def generate_ai_response(
    *,
    db: AsyncSession = Depends(get_db),
    session_id: UUID,
    user_message: str
) -> AIJournalMessageResponse:
    """Generate an AI response to a user message."""
    crud = CRUDAIJournalMessage(db)
    try:
        ai_message = await crud.generate_ai_response(
            session_id=session_id,
            user_message=user_message
        )
        return AIJournalMessageResponse.model_validate(ai_message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/sessions/{session_id}/messages/{message_id}/refresh", response_model=AIJournalMessageResponse)
async def refresh_message(
    *,
    db: AsyncSession = Depends(get_db),
    session_id: UUID,
    message_id: UUID
) -> AIJournalMessageResponse:
    """Refresh a specific AI message by regenerating the response."""
    crud = CRUDAIJournalMessage(db)
    try:
        refreshed_message = await crud.refresh_message(
            message_id=message_id,
            session_id=session_id
        )
        if not refreshed_message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found or not an AI message"
            )
        return AIJournalMessageResponse.model_validate(refreshed_message)
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

# ================================
# ANALYSIS ENDPOINTS
# ================================

@router.get("/sessions/{session_id}/analysis", response_model=AIJournalAnalysisResponse)
async def get_session_analysis(
    *,
    db: AsyncSession = Depends(get_db),
    session_id: UUID
) -> AIJournalAnalysisResponse:
    """Get analysis for a specific session."""
    crud = CRUDAIJournalAnalysis(db)
    analysis = await crud.get_by_session(session_id=session_id)
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found for this session"
        )
    return AIJournalAnalysisResponse.model_validate(analysis)

@router.post("/sessions/{session_id}/analysis", response_model=AIJournalAnalysisResponse, status_code=status.HTTP_201_CREATED)
async def create_or_refresh_analysis(
    *,
    db: AsyncSession = Depends(get_db),
    session_id: UUID,
    analysis_in: Optional[AIJournalAnalysisCreatePayload] = None
) -> AIJournalAnalysisResponse:
    """Create or refresh analysis for a session."""
    crud = CRUDAIJournalAnalysis(db)
    
    try:
        # Check if we should use AI generation
        should_use_ai = True
        
        if analysis_in:
            # Check if the request body contains meaningful data (not dummy values)
            has_meaningful_summary = (
                analysis_in.summary_md and 
                analysis_in.summary_md.strip() not in ["", "string", "summary", "test"]
            )
            has_meaningful_emotions = (
                analysis_in.emotions and 
                len(analysis_in.emotions) > 0 and
                analysis_in.emotions != {}
            )
            has_meaningful_model = (
                analysis_in.model and 
                analysis_in.model.strip() not in ["", "string", "model", "test"]
            )
            
            # Only use manual data if it contains meaningful content
            if has_meaningful_summary or has_meaningful_emotions or has_meaningful_model:
                should_use_ai = False
        
        if should_use_ai:
            # Auto-generate analysis using AI
            analysis = await crud.regenerate_analysis(session_id=session_id)
            if not analysis:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Unable to generate analysis - session not found or no messages"
                )
        else:
            # Manual analysis creation - create full object with session_id from URL
            analysis_data = AIJournalAnalysisCreate(
                session_id=session_id,
                **analysis_in.model_dump()
            )
            analysis = await crud.upsert(obj_in=analysis_data)
        
        return AIJournalAnalysisResponse.model_validate(analysis)
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/sessions/{session_id}/analysis/regenerate", response_model=AIJournalAnalysisResponse)
async def regenerate_analysis(
    *,
    db: AsyncSession = Depends(get_db),
    session_id: UUID
) -> AIJournalAnalysisResponse:
    """Regenerate analysis for a session using AI."""
    print(f"🔄 Regenerate analysis endpoint called for session: {session_id}")
    
    crud = CRUDAIJournalAnalysis(db)
    try:
        print(f"📋 Starting analysis regeneration process...")
        analysis = await crud.regenerate_analysis(session_id=session_id)
        
        if not analysis:
            print(f"❌ No analysis generated - session not found or no messages")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Unable to regenerate analysis - session not found or no messages"
            )
        
        print(f"✅ Analysis regenerated successfully")
        return AIJournalAnalysisResponse.model_validate(analysis)
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        print(f"❌ Error in regenerate analysis endpoint: {e}")
        print(f"❌ Exception type: {type(e).__name__}")
        import traceback
        print(f"❌ Full traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.delete("/sessions/{session_id}/analysis", status_code=status.HTTP_204_NO_CONTENT)
async def delete_analysis(
    *,
    db: AsyncSession = Depends(get_db),
    session_id: UUID
) -> None:
    """Delete analysis for a session."""
    crud = CRUDAIJournalAnalysis(db)
    analysis = await crud.get_by_session(session_id=session_id)
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found for this session"
        )
    await crud.remove(session_id=session_id)

# ================================
# ARTWORK ENDPOINTS
# ================================

@router.get("/sessions/{session_id}/artworks", response_model=List[AIJournalArtworkResponse])
async def get_session_artworks(
    *,
    db: AsyncSession = Depends(get_db),
    session_id: UUID
) -> List[AIJournalArtworkResponse]:
    """Get all artworks for a specific session."""
    crud = CRUDAIJournalArtwork(db)
    artworks = await crud.get_session_artworks(session_id=session_id)
    return [AIJournalArtworkResponse.model_validate(a) for a in artworks]

@router.post("/sessions/{session_id}/artworks", response_model=AIJournalArtworkResponse, status_code=status.HTTP_201_CREATED)
async def create_artwork(
    *,
    db: AsyncSession = Depends(get_db),
    session_id: UUID,
    artwork_in: AIJournalArtworkCreate
) -> AIJournalArtworkResponse:
    """Create artwork for a session."""
    # Ensure session_id matches
    artwork_in.session_id = session_id
    
    crud = CRUDAIJournalArtwork(db)
    try:
        artwork = await crud.create(obj_in=artwork_in)
        return AIJournalArtworkResponse.model_validate(artwork)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

# ================================
# WEBSOCKET ENDPOINT
# ================================

@router.websocket("/sessions/{session_id}/chat")
async def websocket_chat(
    websocket: WebSocket,
    session_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """WebSocket endpoint for real-time AI journaling chat with word-by-word streaming."""
    print(f"🎯 WebSocket endpoint called for session {session_id}, user {user_id}")
    crud = CRUDAIJournalMessage(db)
    
    try:
        print(f"🔄 Starting WebSocket conversation handler...")
        await crud.handle_websocket_conversation(
            websocket=websocket,
            session_id=session_id,
            user_id=user_id
        )
    except WebSocketDisconnect as e:
        print(f"🔌 WebSocket disconnected for session {session_id}: {e}")
        print(f"🔌 Disconnect code: {e.code if hasattr(e, 'code') else 'Unknown'}")
        websocket_manager.disconnect(str(session_id))
    except Exception as e:
        print(f"❌ WebSocket error for session {session_id}: {e}")
        print(f"❌ Exception type: {type(e).__name__}")
        import traceback
        print(f"❌ Full traceback:")
        print(traceback.format_exc())
        websocket_manager.disconnect(str(session_id))
        try:
            await websocket.close()
        except:
            pass

# ================================
# DASHBOARD ENDPOINT
# ================================

@router.get("/dashboard", response_model=AIJournalDashboard)
async def get_dashboard(
    *,
    db: AsyncSession = Depends(get_db),
    user_id: UUID
) -> AIJournalDashboard:
    """Get dashboard data for AI journaling."""
    session_crud = CRUDAIJournalSession(db)
    
    try:
        # Get all sessions for the user
        all_sessions = await session_crud.get_multi_by_user(user_id=user_id, limit=1000)
        
        # Calculate statistics
        total_sessions = len(all_sessions)
        
        # Calculate sessions this week and month
        now = datetime.now(timezone.utc)
        week_start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=now.weekday())
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        sessions_this_week = len([s for s in all_sessions if s.started_at >= week_start])
        sessions_this_month = len([s for s in all_sessions if s.started_at >= month_start])
        
        # Get recent sessions (convert to summary)
        recent_sessions = []
        for session in all_sessions[:5]:  # Last 5 sessions
            recent_sessions.append(AIJournalSessionSummary(
                id=session.id,
                started_at=session.started_at,
                ended_at=session.ended_at,
                message_count=len(session.messages) if session.messages else 0,
                has_analysis=session.analysis is not None,
                has_artworks=len(session.artworks) > 0 if session.artworks else False
            ))
        
        # Aggregate common emotions (simplified - you might want to implement this more sophisticatedly)
        common_emotions = {
            "curiosity": 0.8,
            "reflection": 0.7,
            "growth": 0.6,
            "peace": 0.5
        }
        
        return AIJournalDashboard(
            total_sessions=total_sessions,
            sessions_this_week=sessions_this_week,
            sessions_this_month=sessions_this_month,
            recent_sessions=recent_sessions,
            common_emotions=common_emotions
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        ) 

@router.get("/users/{user_id}/streak")
async def get_user_streak(
    user_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Calculate the user's journaling streak based on their session history.
    Returns the number of consecutive days they've journaled.
    """
    try:
        # Get all user sessions ordered by date
        sessions = await CRUDAIJournalSession(db).get_multi_by_user(user_id=user_id, limit=1000)
        
        if not sessions:
            return {"streak": 0, "total_sessions": 0}
        
        # Group sessions by date
        session_dates = set()
        for session in sessions:
            session_date = session.started_at.date()
            session_dates.add(session_date)
        
        # Sort dates in descending order
        sorted_dates = sorted(session_dates, reverse=True)
        
        if not sorted_dates:
            return {"streak": 0, "total_sessions": len(sessions)}
        
        # Calculate streak
        streak = 0
        current_date = datetime.now(timezone.utc).date()
        
        # Check if they journaled today or yesterday (allow for timezone differences)
        if sorted_dates[0] >= current_date - timedelta(days=1):
            streak = 1
            
            # Count consecutive days
            for i in range(1, len(sorted_dates)):
                if sorted_dates[i] == sorted_dates[i-1] - timedelta(days=1):
                    streak += 1
                else:
                    break
        
        return {
            "streak": streak,
            "total_sessions": len(sessions),
            "last_session_date": sorted_dates[0].isoformat() if sorted_dates else None
        }
        
    except Exception as e:
        # Assuming logger is available, otherwise replace with print
        # logger.error(f"Error calculating streak for user {user_id}: {str(e)}")
        print(f"Error calculating streak for user {user_id}: {str(e)}")
        # Return default streak of 1 if there's an error
        return {"streak": 1, "total_sessions": 0} 