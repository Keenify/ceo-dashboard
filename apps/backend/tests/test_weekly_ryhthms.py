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
from typing import AsyncGenerator, List, Optional, Dict, Any
from unittest.mock import AsyncMock
import json

# --- Add project root to sys.path --- 
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
# -------------------------------------

# Load environment variables from .env file
load_dotenv()

# Import app and schemas
from app.main import app
from app.schemas.weekly_ryhthms import (
    WeeklyRhythmCreate,
    WeeklyRhythmUpdate,
    WeeklyRhythmResponse
)
from app.api import weekly_ryhthms as weekly_ryhthms_api

# --- Test User ID --- 
TEST_USER_ID_STR = os.getenv("TEST_USER_ID")
if not TEST_USER_ID_STR:
    raise ValueError("TEST_USER_ID environment variable not set or empty")
try:
    TEST_USER_ID = UUID(TEST_USER_ID_STR)
except ValueError:
    raise ValueError(f"Invalid UUID format for TEST_USER_ID: {TEST_USER_ID_STR}")
# --------------------

BASE_URL = "/weekly-rhythms"

# --- Fixture for API Client ---
@pytest_asyncio.fixture(scope="function")
async def client():
    """Provide a test client for making API requests to the app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

# --- Helper Functions ---
def create_mock_weekly_rhythm_data(id: UUID, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat()
    base_data = {
        "id": id,
        "user_id": TEST_USER_ID,
        "week_start_date": week_start,
        "most_significant_moment": "Test moment",
        "goals": [
            {"goal": "Goal 1", "target_completion_by": "Friday"},
            {"goal": "Goal 2", "target_completion_by": "Saturday"}
        ],
        "actions": [
            {"action_item": "Action 1", "outcome": "Success"},
            {"action_item": "Action 2", "outcome": "Partial"}
        ],
        "challenges": [
            {"challenge": "Challenge 1", "note": "Note 1"},
            {"challenge": "Challenge 2", "note": "Note 2"}
        ],
        "next_goals": [
            {"goal": "Next Goal 1", "help_needed": "None"},
            {"goal": "Next Goal 2", "help_needed": "Assistance"}
        ],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    if overrides:
        base_data.update(overrides)
    return base_data

# --- Test Cases ---

@pytest.mark.asyncio
async def test_create_weekly_rhythm(client: AsyncClient, monkeypatch):
    """Test POST /weekly-rhythms/ for creating a new weekly rhythm."""
    rhythm_id = uuid4()
    rhythm_data = {
        "user_id": str(TEST_USER_ID),
        "week_start_date": (date.today() - timedelta(days=date.today().weekday())).isoformat(),
        "most_significant_moment": "Test moment",
        "goals": [
            {"goal": "Goal 1", "target_completion_by": "Friday"},
            {"goal": "Goal 2", "target_completion_by": "Saturday"}
        ],
        "actions": [
            {"action_item": "Action 1", "outcome": "Success"},
            {"action_item": "Action 2", "outcome": "Partial"}
        ],
        "challenges": [
            {"challenge": "Challenge 1", "note": "Note 1"},
            {"challenge": "Challenge 2", "note": "Note 2"}
        ],
        "next_goals": [
            {"goal": "Next Goal 1", "help_needed": "None"},
            {"goal": "Next Goal 2", "help_needed": "Assistance"}
        ]
    }
    mock_db_data = create_mock_weekly_rhythm_data(id=rhythm_id, overrides=rhythm_data)
    mock_create = AsyncMock(return_value=type('MockDBWeeklyRhythm', (), mock_db_data)())
    monkeypatch.setattr(weekly_ryhthms_api.CRUDWeeklyRhythm, "create", mock_create)

    response = await client.post(BASE_URL + "/", json=rhythm_data)

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    assert response_data["id"] == str(rhythm_id)
    assert response_data["user_id"] == str(TEST_USER_ID)
    assert response_data["goals"][0]["goal"] == "Goal 1"
    mock_create.assert_awaited_once()

@pytest.mark.asyncio
async def test_get_weekly_rhythm(client: AsyncClient, monkeypatch):
    """Test GET /weekly-rhythms/{weekly_rhythm_id}."""
    rhythm_id = uuid4()
    mock_db_data = create_mock_weekly_rhythm_data(id=rhythm_id)
    mock_get = AsyncMock(return_value=type('MockDBWeeklyRhythm', (), mock_db_data)())
    monkeypatch.setattr(weekly_ryhthms_api.CRUDWeeklyRhythm, "get", mock_get)

    response = await client.get(f"{BASE_URL}/{rhythm_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(rhythm_id)
    assert response_data["user_id"] == str(TEST_USER_ID)
    mock_get.assert_awaited_once_with(id=rhythm_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_get_weekly_rhythms(client: AsyncClient, monkeypatch):
    """Test GET /weekly-rhythms/ for listing all weekly rhythms."""
    rhythm_id1 = uuid4()
    rhythm_id2 = uuid4()
    mock_db_list = [
        type('MockDBWeeklyRhythm', (), create_mock_weekly_rhythm_data(id=rhythm_id1))(),
        type('MockDBWeeklyRhythm', (), create_mock_weekly_rhythm_data(id=rhythm_id2, overrides={"most_significant_moment": "Another moment"}))()
    ]
    mock_get_multi = AsyncMock(return_value=mock_db_list)
    monkeypatch.setattr(weekly_ryhthms_api.CRUDWeeklyRhythm, "get_multi_by_user", mock_get_multi)

    response = await client.get(f"{BASE_URL}/?user_id={TEST_USER_ID}&limit=10")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 2
    assert response_data[0]["id"] == str(rhythm_id1)
    assert response_data[1]["most_significant_moment"] == "Another moment"
    mock_get_multi.assert_awaited_once_with(user_id=TEST_USER_ID, skip=0, limit=10)

@pytest.mark.asyncio
async def test_update_weekly_rhythm(client: AsyncClient, monkeypatch):
    """Test PUT /weekly-rhythms/{weekly_rhythm_id}."""
    rhythm_id = uuid4()
    update_data = {
        "most_significant_moment": "Updated moment"
    }
    # Mock get to return existing rhythm
    mock_db_data = create_mock_weekly_rhythm_data(id=rhythm_id)
    mock_get = AsyncMock(return_value=type('MockDBWeeklyRhythm', (), mock_db_data)())
    monkeypatch.setattr(weekly_ryhthms_api.CRUDWeeklyRhythm, "get", mock_get)
    # Mock update to return updated rhythm
    updated_data = {**mock_db_data, **update_data}
    mock_update = AsyncMock(return_value=type('MockDBWeeklyRhythm', (), updated_data)())
    monkeypatch.setattr(weekly_ryhthms_api.CRUDWeeklyRhythm, "update", mock_update)

    response = await client.put(
        f"{BASE_URL}/{rhythm_id}?user_id={TEST_USER_ID}",
        json=update_data
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["most_significant_moment"] == update_data["most_significant_moment"]
    mock_get.assert_awaited_once_with(id=rhythm_id, user_id=TEST_USER_ID)
    mock_update.assert_awaited_once()

@pytest.mark.asyncio
async def test_delete_weekly_rhythm(client: AsyncClient, monkeypatch):
    """Test DELETE /weekly-rhythms/{weekly_rhythm_id}."""
    rhythm_id = uuid4()
    mock_db_data = create_mock_weekly_rhythm_data(id=rhythm_id)
    # Mock get to return existing rhythm
    mock_get = AsyncMock(return_value=type('MockDBWeeklyRhythm', (), mock_db_data)())
    monkeypatch.setattr(weekly_ryhthms_api.CRUDWeeklyRhythm, "get", mock_get)
    # Mock remove
    mock_remove = AsyncMock()
    monkeypatch.setattr(weekly_ryhthms_api.CRUDWeeklyRhythm, "remove", mock_remove)

    response = await client.delete(f"{BASE_URL}/{rhythm_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_204_NO_CONTENT
    mock_get.assert_awaited_once_with(id=rhythm_id, user_id=TEST_USER_ID)
    mock_remove.assert_awaited_once_with(id=rhythm_id, user_id=TEST_USER_ID)
