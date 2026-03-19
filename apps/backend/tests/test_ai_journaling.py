import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from fastapi import status
import os
import sys
from pathlib import Path
from uuid import UUID, uuid4
from datetime import date, datetime, timezone, timedelta
from dotenv import load_dotenv
from typing import AsyncGenerator, List, Optional, Dict, Any, AsyncIterator, cast
from unittest.mock import AsyncMock, Mock, ANY, patch
import json

# --- Add project root to sys.path --- 
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
# -------------------------------------

# Load environment variables from .env file
load_dotenv()

# Import app and schemas
from app.main import app
from app.schemas.ai_journaling import (
    AIJournalSessionCreate,
    AIJournalSessionUpdate,
    AIJournalSessionResponse,
    AIJournalMessageCreate,
    AIJournalMessageCreatePayload,
    AIJournalMessageResponse,
    AIJournalAnalysisCreate,
    AIJournalAnalysisUpdate,
    AIJournalAnalysisResponse,
    AIJournalArtworkCreate,
    AIJournalArtworkUpdate,
    AIJournalArtworkResponse,
    AIJournalSessionSummary,
    AIJournalDashboard
)
from app.api import ai_journaling as ai_journaling_api

# --- Test User ID --- 
TEST_USER_ID_STR = os.getenv("TEST_USER_ID")
if not TEST_USER_ID_STR:
    raise ValueError("TEST_USER_ID environment variable not set or empty")
try:
    TEST_USER_ID = UUID(TEST_USER_ID_STR)
except ValueError:
    raise ValueError(f"Invalid UUID format for TEST_USER_ID: {TEST_USER_ID_STR}")
# --------------------

BASE_URL = "/ai-journaling"

# --- Fixture for API Client ---
@pytest_asyncio.fixture(scope="function")
async def client():
    """Provide a test client for making API requests to the app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

# --- Helper Functions ---
def create_mock_session_data(id: UUID, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates a dictionary mimicking attributes of an AIJournalSession DB model object."""
    base_data = {
        "id": id,
        "user_id": TEST_USER_ID,
        "started_at": datetime.now(timezone.utc),
        "ended_at": None,
        "messages": [],
        "analysis": None,
        "artworks": []
    }
    if overrides:
        base_data.update(overrides)
    return base_data

def create_mock_message_data(id: UUID, session_id: UUID, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates a dictionary mimicking attributes of an AIJournalMessage DB model object."""
    base_data = {
        "id": id,
        "session_id": session_id,
        "sender": "user",
        "content": f"Test message content {id}",
        "seq": 1,
        "created_at": datetime.now(timezone.utc)
    }
    if overrides:
        base_data.update(overrides)
    return base_data

def create_mock_analysis_data(session_id: UUID, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates a dictionary mimicking attributes of an AIJournalAnalysis DB model object."""
    base_data = {
        "session_id": session_id,
        "summary_md": "# Test Analysis\nThis is a test summary of the journaling session.",
        "emotions": {
            "curiosity": 0.8,
            "reflection": 0.7,
            "growth": 0.6
        },
        "model": "gpt-3.5-turbo",
        "created_at": datetime.now(timezone.utc)
    }
    if overrides:
        base_data.update(overrides)
    return base_data

def create_mock_artwork_data(id: UUID, session_id: UUID, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates a dictionary mimicking attributes of an AIJournalArtwork DB model object."""
    base_data = {
        "id": id,
        "session_id": session_id,
        "image_path": f"/path/to/artwork/{id}.png",
        "style": "abstract",
        "created_at": datetime.now(timezone.utc)
    }
    if overrides:
        base_data.update(overrides)
    return base_data

def print_dict_structure(name, obj):
    """Pretty-print a dict or list to debug its structure"""
    print(f"\n--- {name} ---")
    if isinstance(obj, (dict, list)):
        print(json.dumps(obj, indent=2, default=str))
    else:
        print(f"Type: {type(obj)}")
        print(str(obj))
    print("-------------------\n")

# ================================
# SESSION ENDPOINT TESTS
# ================================

@pytest.mark.asyncio
async def test_create_session(client: AsyncClient, monkeypatch):
    """Test POST /ai-journaling/sessions for creating a new session."""
    session_id = uuid4()
    session_data = {
        "user_id": str(TEST_USER_ID)
    }
    
    mock_db_data = create_mock_session_data(id=session_id, overrides=session_data)
    mock_create = AsyncMock(return_value=type('MockDBSession', (), mock_db_data)())
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalSession, "create", mock_create)

    response = await client.post(BASE_URL + "/sessions", json=session_data)

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    assert response_data["id"] == str(session_id)
    assert response_data["user_id"] == str(TEST_USER_ID)
    mock_create.assert_awaited_once()

@pytest.mark.asyncio
async def test_get_today_session(client: AsyncClient, monkeypatch):
    """Test GET /ai-journaling/sessions/today for getting today's session."""
    session_id = uuid4()
    mock_db_data = create_mock_session_data(id=session_id)
    mock_get_today = AsyncMock(return_value=type('MockDBSession', (), mock_db_data)())
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalSession, "get_today_session", mock_get_today)

    response = await client.get(f"{BASE_URL}/sessions/today?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(session_id)
    assert response_data["user_id"] == str(TEST_USER_ID)
    mock_get_today.assert_awaited_once_with(user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_get_session(client: AsyncClient, monkeypatch):
    """Test GET /ai-journaling/sessions/{session_id}."""
    session_id = uuid4()
    mock_db_data = create_mock_session_data(id=session_id)
    mock_get = AsyncMock(return_value=type('MockDBSession', (), mock_db_data)())
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalSession, "get", mock_get)

    response = await client.get(f"{BASE_URL}/sessions/{session_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(session_id)
    mock_get.assert_awaited_once_with(id=session_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_get_session_not_found(client: AsyncClient, monkeypatch):
    """Test GET /ai-journaling/sessions/{session_id} when session not found."""
    session_id = uuid4()
    mock_get = AsyncMock(return_value=None)
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalSession, "get", mock_get)

    response = await client.get(f"{BASE_URL}/sessions/{session_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert "not found" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_get_user_sessions(client: AsyncClient, monkeypatch):
    """Test GET /ai-journaling/sessions for listing all user sessions."""
    session_id1 = uuid4()
    session_id2 = uuid4()
    
    # Create mock sessions with messages and analysis
    mock_session1 = create_mock_session_data(id=session_id1, overrides={
        "messages": [{"id": uuid4(), "content": "Test"}],
        "analysis": {"summary": "Test analysis"},
        "artworks": []
    })
    mock_session2 = create_mock_session_data(id=session_id2, overrides={
        "messages": [{"id": uuid4(), "content": "Test 2"}],
        "analysis": None,
        "artworks": [{"id": uuid4(), "path": "/test.png"}]
    })
    
    mock_db_list = [
        type('MockDBSession', (), mock_session1)(),
        type('MockDBSession', (), mock_session2)()
    ]
    mock_get_multi = AsyncMock(return_value=mock_db_list)
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalSession, "get_multi_by_user", mock_get_multi)

    response = await client.get(f"{BASE_URL}/sessions?user_id={TEST_USER_ID}&limit=10")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 2
    assert response_data[0]["id"] == str(session_id1)
    assert response_data[0]["message_count"] == 1
    assert response_data[0]["has_analysis"] == True
    assert response_data[0]["has_artworks"] == False
    mock_get_multi.assert_awaited_once_with(user_id=TEST_USER_ID, skip=0, limit=10)

@pytest.mark.asyncio
async def test_update_session(client: AsyncClient, monkeypatch):
    """Test PUT /ai-journaling/sessions/{session_id}."""
    session_id = uuid4()
    update_data = {
        "ended_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Mock get to return existing session
    mock_db_data = create_mock_session_data(id=session_id)
    mock_get = AsyncMock(return_value=type('MockDBSession', (), mock_db_data)())
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalSession, "get", mock_get)
    
    # Mock update to return updated session
    updated_data = {**mock_db_data, **update_data}
    mock_update = AsyncMock(return_value=type('MockDBSession', (), updated_data)())
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalSession, "update", mock_update)

    response = await client.put(
        f"{BASE_URL}/sessions/{session_id}?user_id={TEST_USER_ID}",
        json=update_data
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(session_id)
    mock_get.assert_awaited_once_with(id=session_id, user_id=TEST_USER_ID)
    mock_update.assert_awaited_once()

@pytest.mark.asyncio
async def test_end_session(client: AsyncClient, monkeypatch):
    """Test POST /ai-journaling/sessions/{session_id}/end."""
    session_id = uuid4()
    mock_db_data = create_mock_session_data(id=session_id, overrides={
        "ended_at": datetime.now(timezone.utc)
    })
    mock_end_session = AsyncMock(return_value=type('MockDBSession', (), mock_db_data)())
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalSession, "end_session", mock_end_session)

    response = await client.post(f"{BASE_URL}/sessions/{session_id}/end?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(session_id)
    assert response_data["ended_at"] is not None
    mock_end_session.assert_awaited_once_with(session_id=session_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_delete_session(client: AsyncClient, monkeypatch):
    """Test DELETE /ai-journaling/sessions/{session_id}."""
    session_id = uuid4()
    mock_db_data = create_mock_session_data(id=session_id)
    
    # Mock get to return existing session
    mock_get = AsyncMock(return_value=type('MockDBSession', (), mock_db_data)())
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalSession, "get", mock_get)
    
    # Mock remove
    mock_remove = AsyncMock()
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalSession, "remove", mock_remove)

    response = await client.delete(f"{BASE_URL}/sessions/{session_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_204_NO_CONTENT
    mock_get.assert_awaited_once_with(id=session_id, user_id=TEST_USER_ID)
    mock_remove.assert_awaited_once_with(id=session_id, user_id=TEST_USER_ID)

# ================================
# MESSAGE ENDPOINT TESTS
# ================================

@pytest.mark.asyncio
async def test_get_session_messages(client: AsyncClient, monkeypatch):
    """Test GET /ai-journaling/sessions/{session_id}/messages."""
    session_id = uuid4()
    message_id1 = uuid4()
    message_id2 = uuid4()
    
    mock_db_list = [
        type('MockDBMessage', (), create_mock_message_data(id=message_id1, session_id=session_id))(),
        type('MockDBMessage', (), create_mock_message_data(id=message_id2, session_id=session_id, overrides={"sender": "ai", "seq": 2}))()
    ]
    mock_get_messages = AsyncMock(return_value=mock_db_list)
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalMessage, "get_session_messages", mock_get_messages)

    response = await client.get(f"{BASE_URL}/sessions/{session_id}/messages?limit=10")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 2
    assert response_data[0]["id"] == str(message_id1)
    assert response_data[0]["sender"] == "user"
    assert response_data[1]["sender"] == "ai"
    mock_get_messages.assert_awaited_once_with(session_id=session_id, skip=0, limit=10)

@pytest.mark.asyncio
async def test_create_message(client: AsyncClient, monkeypatch):
    """Test POST /ai-journaling/sessions/{session_id}/messages."""
    session_id = uuid4()
    message_id = uuid4()
    message_data = {
        "sender": "user",
        "content": "Hello, I'd like to journal today about my feelings.",
        "seq": 1
    }
    
    mock_db_data = create_mock_message_data(id=message_id, session_id=session_id, overrides=message_data)
    mock_create = AsyncMock(return_value=type('MockDBMessage', (), mock_db_data)())
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalMessage, "create", mock_create)

    response = await client.post(f"{BASE_URL}/sessions/{session_id}/messages", json=message_data)

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    assert response_data["id"] == str(message_id)
    assert response_data["content"] == message_data["content"]
    assert response_data["sender"] == message_data["sender"]
    mock_create.assert_awaited_once()

@pytest.mark.asyncio
async def test_generate_ai_response(client: AsyncClient, monkeypatch):
    """Test POST /ai-journaling/sessions/{session_id}/ai-response."""
    session_id = uuid4()
    message_id = uuid4()
    user_message = "I'm feeling anxious about my upcoming presentation."
    
    mock_db_data = create_mock_message_data(id=message_id, session_id=session_id, overrides={
        "sender": "ai",
        "content": "I understand that presentations can be nerve-wracking. What specific aspects are making you feel most anxious?",
        "seq": 2
    })
    mock_generate = AsyncMock(return_value=type('MockDBMessage', (), mock_db_data)())
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalMessage, "generate_ai_response", mock_generate)

    response = await client.post(
        f"{BASE_URL}/sessions/{session_id}/ai-response",
        params={"user_message": user_message}
    )

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    assert response_data["id"] == str(message_id)
    assert response_data["sender"] == "ai"
    assert "anxious" in response_data["content"] or "presentations" in response_data["content"]
    mock_generate.assert_awaited_once_with(session_id=session_id, user_message=user_message)

# ================================
# ANALYSIS ENDPOINT TESTS
# ================================

@pytest.mark.asyncio
async def test_get_session_analysis(client: AsyncClient, monkeypatch):
    """Test GET /ai-journaling/sessions/{session_id}/analysis."""
    session_id = uuid4()
    mock_db_data = create_mock_analysis_data(session_id=session_id)
    mock_get = AsyncMock(return_value=type('MockDBAnalysis', (), mock_db_data)())
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalAnalysis, "get_by_session", mock_get)

    response = await client.get(f"{BASE_URL}/sessions/{session_id}/analysis")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["session_id"] == str(session_id)
    assert "Test Analysis" in response_data["summary_md"]
    assert response_data["emotions"]["curiosity"] == 0.8
    mock_get.assert_awaited_once_with(session_id=session_id)

@pytest.mark.asyncio
async def test_get_session_analysis_not_found(client: AsyncClient, monkeypatch):
    """Test GET /ai-journaling/sessions/{session_id}/analysis when analysis not found."""
    session_id = uuid4()
    mock_get = AsyncMock(return_value=None)
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalAnalysis, "get_by_session", mock_get)

    response = await client.get(f"{BASE_URL}/sessions/{session_id}/analysis")

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert "not found" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_create_or_refresh_analysis_auto(client: AsyncClient, monkeypatch):
    """Test POST /ai-journaling/sessions/{session_id}/analysis with auto-generation."""
    session_id = uuid4()
    mock_db_data = create_mock_analysis_data(session_id=session_id, overrides={"model": "auto-generated"})
    mock_upsert = AsyncMock(return_value=type('MockDBAnalysis', (), mock_db_data)())
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalAnalysis, "upsert", mock_upsert)

    response = await client.post(f"{BASE_URL}/sessions/{session_id}/analysis")

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    assert response_data["session_id"] == str(session_id)
    assert response_data["model"] == "auto-generated"
    mock_upsert.assert_awaited_once()

@pytest.mark.asyncio
async def test_create_or_refresh_analysis_manual(client: AsyncClient, monkeypatch):
    """Test POST /ai-journaling/sessions/{session_id}/analysis with manual data."""
    session_id = uuid4()
    analysis_data = {
        "session_id": str(session_id),
        "summary_md": "# Custom Analysis\nThis is a manually created analysis.",
        "emotions": {"happiness": 0.9, "gratitude": 0.8},
        "model": "manual"
    }
    
    mock_db_data = create_mock_analysis_data(session_id=session_id, overrides=analysis_data)
    mock_upsert = AsyncMock(return_value=type('MockDBAnalysis', (), mock_db_data)())
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalAnalysis, "upsert", mock_upsert)

    response = await client.post(f"{BASE_URL}/sessions/{session_id}/analysis", json=analysis_data)

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    assert response_data["session_id"] == str(session_id)
    assert "Custom Analysis" in response_data["summary_md"]
    assert response_data["emotions"]["happiness"] == 0.9
    mock_upsert.assert_awaited_once()

@pytest.mark.asyncio
async def test_regenerate_analysis(client: AsyncClient, monkeypatch):
    """Test POST /ai-journaling/sessions/{session_id}/analysis/regenerate."""
    session_id = uuid4()
    mock_db_data = create_mock_analysis_data(session_id=session_id, overrides={
        "summary_md": "# Regenerated Analysis\nThis analysis was regenerated using AI.",
        "model": "gpt-3.5-turbo"
    })
    mock_regenerate = AsyncMock(return_value=type('MockDBAnalysis', (), mock_db_data)())
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalAnalysis, "regenerate_analysis", mock_regenerate)

    response = await client.post(f"{BASE_URL}/sessions/{session_id}/analysis/regenerate")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["session_id"] == str(session_id)
    assert "Regenerated Analysis" in response_data["summary_md"]
    mock_regenerate.assert_awaited_once_with(session_id=session_id)

@pytest.mark.asyncio
async def test_regenerate_analysis_not_found(client: AsyncClient, monkeypatch):
    """Test POST /ai-journaling/sessions/{session_id}/analysis/regenerate when session not found."""
    session_id = uuid4()
    mock_regenerate = AsyncMock(return_value=None)
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalAnalysis, "regenerate_analysis", mock_regenerate)

    response = await client.post(f"{BASE_URL}/sessions/{session_id}/analysis/regenerate")

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert "unable to regenerate" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_delete_analysis(client: AsyncClient, monkeypatch):
    """Test DELETE /ai-journaling/sessions/{session_id}/analysis."""
    session_id = uuid4()
    mock_db_data = create_mock_analysis_data(session_id=session_id)
    
    # Mock get to return existing analysis
    mock_get = AsyncMock(return_value=type('MockDBAnalysis', (), mock_db_data)())
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalAnalysis, "get_by_session", mock_get)
    
    # Mock remove
    mock_remove = AsyncMock()
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalAnalysis, "remove", mock_remove)

    response = await client.delete(f"{BASE_URL}/sessions/{session_id}/analysis")

    assert response.status_code == status.HTTP_204_NO_CONTENT
    mock_get.assert_awaited_once_with(session_id=session_id)
    mock_remove.assert_awaited_once_with(session_id=session_id)

# ================================
# ARTWORK ENDPOINT TESTS
# ================================

@pytest.mark.asyncio
async def test_get_session_artworks(client: AsyncClient, monkeypatch):
    """Test GET /ai-journaling/sessions/{session_id}/artworks."""
    session_id = uuid4()
    artwork_id1 = uuid4()
    artwork_id2 = uuid4()
    
    mock_db_list = [
        type('MockDBArtwork', (), create_mock_artwork_data(id=artwork_id1, session_id=session_id))(),
        type('MockDBArtwork', (), create_mock_artwork_data(id=artwork_id2, session_id=session_id, overrides={"style": "realistic"}))()
    ]
    mock_get_artworks = AsyncMock(return_value=mock_db_list)
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalArtwork, "get_session_artworks", mock_get_artworks)

    response = await client.get(f"{BASE_URL}/sessions/{session_id}/artworks")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 2
    assert response_data[0]["id"] == str(artwork_id1)
    assert response_data[0]["style"] == "abstract"
    assert response_data[1]["style"] == "realistic"
    mock_get_artworks.assert_awaited_once_with(session_id=session_id)

@pytest.mark.asyncio
async def test_create_artwork(client: AsyncClient, monkeypatch):
    """Test POST /ai-journaling/sessions/{session_id}/artworks."""
    session_id = uuid4()
    artwork_id = uuid4()
    artwork_data = {
        "session_id": str(session_id),
        "image_path": "/path/to/new/artwork.png",
        "style": "surreal"
    }
    
    mock_db_data = create_mock_artwork_data(id=artwork_id, session_id=session_id, overrides=artwork_data)
    mock_create = AsyncMock(return_value=type('MockDBArtwork', (), mock_db_data)())
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalArtwork, "create", mock_create)

    response = await client.post(f"{BASE_URL}/sessions/{session_id}/artworks", json=artwork_data)

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    assert response_data["id"] == str(artwork_id)
    assert response_data["session_id"] == str(session_id)
    assert response_data["style"] == "surreal"
    mock_create.assert_awaited_once()

# ================================
# DASHBOARD ENDPOINT TESTS
# ================================

@pytest.mark.asyncio
async def test_get_dashboard(client: AsyncClient, monkeypatch):
    """Test GET /ai-journaling/dashboard."""
    session_id1 = uuid4()
    session_id2 = uuid4()
    session_id3 = uuid4()
    
    # Create mock sessions spanning different time periods
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=5)
    month_ago = now - timedelta(days=20)
    
    mock_sessions = [
        type('MockDBSession', (), create_mock_session_data(id=session_id1, overrides={
            "started_at": now,
            "ended_at": now + timedelta(hours=1),
            "messages": [{"id": uuid4()}],
            "analysis": {"summary": "Recent"},
            "artworks": []
        }))(),
        type('MockDBSession', (), create_mock_session_data(id=session_id2, overrides={
            "started_at": week_ago,
            "ended_at": week_ago + timedelta(hours=1),
            "messages": [{"id": uuid4()}, {"id": uuid4()}],
            "analysis": None,
            "artworks": [{"id": uuid4()}]
        }))(),
        type('MockDBSession', (), create_mock_session_data(id=session_id3, overrides={
            "started_at": month_ago,
            "ended_at": month_ago + timedelta(hours=1),
            "messages": [],
            "analysis": None,
            "artworks": []
        }))()
    ]
    
    mock_get_multi = AsyncMock(return_value=mock_sessions)
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalSession, "get_multi_by_user", mock_get_multi)

    response = await client.get(f"{BASE_URL}/dashboard?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["total_sessions"] == 3
    assert response_data["sessions_this_week"] == 2  # Current session + week ago session
    assert response_data["sessions_this_month"] == 3  # All sessions are within a month
    assert len(response_data["recent_sessions"]) == 3
    assert "common_emotions" in response_data
    mock_get_multi.assert_awaited_once_with(user_id=TEST_USER_ID, limit=1000)

# ================================
# ERROR HANDLING TESTS
# ================================

@pytest.mark.asyncio
async def test_create_session_error(client: AsyncClient, monkeypatch):
    """Test POST /ai-journaling/sessions with database error."""
    session_data = {
        "user_id": str(TEST_USER_ID)
    }
    
    mock_create = AsyncMock(side_effect=Exception("Database connection error"))
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalSession, "create", mock_create)

    response = await client.post(BASE_URL + "/sessions", json=session_data)

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "Database connection error" in response.json()["detail"]

@pytest.mark.asyncio
async def test_end_session_error(client: AsyncClient, monkeypatch):
    """Test POST /ai-journaling/sessions/{session_id}/end with error."""
    session_id = uuid4()
    
    mock_end_session = AsyncMock(side_effect=Exception("Analysis generation failed"))
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalSession, "end_session", mock_end_session)

    response = await client.post(f"{BASE_URL}/sessions/{session_id}/end?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert "Analysis generation failed" in response.json()["detail"]

@pytest.mark.asyncio
async def test_generate_ai_response_error(client: AsyncClient, monkeypatch):
    """Test POST /ai-journaling/sessions/{session_id}/ai-response with error."""
    session_id = uuid4()
    user_message = "Test message"
    
    mock_generate = AsyncMock(side_effect=Exception("AI service unavailable"))
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalMessage, "generate_ai_response", mock_generate)

    response = await client.post(
        f"{BASE_URL}/sessions/{session_id}/ai-response",
        params={"user_message": user_message}
    )

    assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert "AI service unavailable" in response.json()["detail"]

# ================================
# EDGE CASE TESTS
# ================================

@pytest.mark.asyncio
async def test_get_user_sessions_empty(client: AsyncClient, monkeypatch):
    """Test GET /ai-journaling/sessions when user has no sessions."""
    mock_get_multi = AsyncMock(return_value=[])
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalSession, "get_multi_by_user", mock_get_multi)

    response = await client.get(f"{BASE_URL}/sessions?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 0

@pytest.mark.asyncio
async def test_get_session_messages_empty(client: AsyncClient, monkeypatch):
    """Test GET /ai-journaling/sessions/{session_id}/messages when session has no messages."""
    session_id = uuid4()
    
    mock_get_messages = AsyncMock(return_value=[])
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalMessage, "get_session_messages", mock_get_messages)

    response = await client.get(f"{BASE_URL}/sessions/{session_id}/messages")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 0

@pytest.mark.asyncio
async def test_get_session_artworks_empty(client: AsyncClient, monkeypatch):
    """Test GET /ai-journaling/sessions/{session_id}/artworks when session has no artworks."""
    session_id = uuid4()
    
    mock_get_artworks = AsyncMock(return_value=[])
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalArtwork, "get_session_artworks", mock_get_artworks)

    response = await client.get(f"{BASE_URL}/sessions/{session_id}/artworks")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 0

@pytest.mark.asyncio
async def test_dashboard_new_user(client: AsyncClient, monkeypatch):
    """Test GET /ai-journaling/dashboard for a new user with no sessions."""
    mock_get_multi = AsyncMock(return_value=[])
    monkeypatch.setattr(ai_journaling_api.CRUDAIJournalSession, "get_multi_by_user", mock_get_multi)

    response = await client.get(f"{BASE_URL}/dashboard?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["total_sessions"] == 0
    assert response_data["sessions_this_week"] == 0
    assert response_data["sessions_this_month"] == 0
    assert len(response_data["recent_sessions"]) == 0
    assert "common_emotions" in response_data

# ================================
# DATA VALIDATION TESTS
# ================================

@pytest.mark.asyncio
async def test_create_session_invalid_user_id(client: AsyncClient):
    """Test POST /ai-journaling/sessions with invalid user_id format."""
    session_data = {
        "user_id": "invalid-uuid"
    }

    response = await client.post(BASE_URL + "/sessions", json=session_data)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

@pytest.mark.asyncio
async def test_create_message_invalid_sender(client: AsyncClient, monkeypatch):
    """Test POST /ai-journaling/sessions/{session_id}/messages with invalid sender."""
    session_id = uuid4()
    message_data = {
        "sender": "invalid_sender",  # Should be "user" or "ai"
        "content": "Test message",
        "seq": 1
    }

    # This should be caught by Pydantic validation before reaching the CRUD layer
    response = await client.post(f"{BASE_URL}/sessions/{session_id}/messages", json=message_data)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

@pytest.mark.asyncio
async def test_create_analysis_with_invalid_emotions(client: AsyncClient, monkeypatch):
    """Test POST /ai-journaling/sessions/{session_id}/analysis with invalid emotions format."""
    session_id = uuid4()
    analysis_data = {
        "session_id": str(session_id),
        "summary_md": "Test summary",
        "emotions": "invalid_format",  # Should be a dictionary
        "model": "test"
    }

    response = await client.post(f"{BASE_URL}/sessions/{session_id}/analysis", json=analysis_data)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY