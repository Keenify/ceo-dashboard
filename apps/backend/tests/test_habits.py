import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from fastapi import status
import os
import sys
from pathlib import Path
from uuid import UUID, uuid4
from datetime import date, datetime, timezone
from dotenv import load_dotenv
from typing import AsyncGenerator, List, Optional, Dict, Any, AsyncIterator, cast
from unittest.mock import AsyncMock, Mock, ANY
import json

# --- Add project root to sys.path --- 
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
# -------------------------------------

# Load environment variables from .env file
load_dotenv()

# Import app and schemas
from app.main import app
from app.schemas.habits import (
    HabitCreate,
    HabitUpdate,
    HabitResponse,
    HabitEntryCreate,
    HabitEntryUpdate,
    HabitEntryResponse,
    HabitStreakCreate,
    HabitStreakUpdate,
    HabitStreakResponse,
    HabitBuddyCreate,
    HabitBuddyUpdate,
    HabitBuddyResponse
)
from app.api import habits as habits_api

# --- Test User ID --- 
TEST_USER_ID_STR = os.getenv("TEST_USER_ID")
if not TEST_USER_ID_STR:
    raise ValueError("TEST_USER_ID environment variable not set or empty")
try:
    TEST_USER_ID = UUID(TEST_USER_ID_STR)
except ValueError:
    raise ValueError(f"Invalid UUID format for TEST_USER_ID: {TEST_USER_ID_STR}")
# --------------------

BASE_URL = "/habits"

# --- Fixture for API Client ---
@pytest_asyncio.fixture(scope="function")
async def client():
    """Provide a test client for making API requests to the app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

# --- Helper Functions ---
def create_mock_habit_data(id: UUID, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates a dictionary mimicking attributes of a Habit DB model object."""
    base_data = {
        "id": id,
        "user_id": TEST_USER_ID,
        "name": f"Test Habit {id}",
        "description": f"Test Description {id}",
        "habit_type": "build",
        "color_code": "#FF0000",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    if overrides:
        base_data.update(overrides)
    return base_data

def create_mock_habit_entry_data(id: UUID, habit_id: UUID, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates a dictionary mimicking attributes of a HabitEntry DB model object."""
    base_data = {
        "id": id,
        "habit_id": habit_id,
        "entry_date": date.today(),
        "status": "completed",
        "note": f"Test Note {id}",
        "value": "5.0",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    if overrides:
        base_data.update(overrides)
    return base_data

def create_mock_habit_streak_data(id: UUID, habit_id: UUID, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates a dictionary mimicking attributes of a HabitStreak DB model object."""
    base_data = {
        "habit_id": habit_id,
        "current_streak": 5,
        "longest_streak": 10,
        "total_streak": 15,
        "last_entry_date": date.today(),
        "last_value": "5.0"
    }
    if overrides:
        base_data.update(overrides)
    return base_data

def create_mock_habit_buddy_data(id: UUID, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates a dictionary mimicking attributes of a HabitBuddy DB model object."""
    base_data = {
        "id": id,
        "user_id": TEST_USER_ID,
        "buddy_email": f"buddy{id}@example.com",
        "censor_habits": False,
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

# --- Test Cases ---

@pytest.mark.asyncio
async def test_create_habit(client: AsyncClient, monkeypatch):
    """Test POST /habits/ for creating a new habit."""
    habit_id = uuid4()
    habit_data = {
        "user_id": str(TEST_USER_ID),
        "name": "Test Habit",
        "description": "Test Description",
        "habit_type": "build",
        "color_code": "#FF0000"
    }
    
    mock_db_data = create_mock_habit_data(id=habit_id, overrides=habit_data)
    mock_create = AsyncMock(return_value=type('MockDBHabit', (), mock_db_data)())
    monkeypatch.setattr(habits_api.CRUDHabit, "create", mock_create)

    response = await client.post(BASE_URL + "/", json=habit_data)

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    assert response_data["id"] == str(habit_id)
    assert response_data["name"] == habit_data["name"]
    assert response_data["habit_type"] == habit_data["habit_type"]
    mock_create.assert_awaited_once()

@pytest.mark.asyncio
async def test_get_habit(client: AsyncClient, monkeypatch):
    """Test GET /habits/{habit_id}."""
    habit_id = uuid4()
    mock_db_data = create_mock_habit_data(id=habit_id)
    mock_get = AsyncMock(return_value=type('MockDBHabit', (), mock_db_data)())
    monkeypatch.setattr(habits_api.CRUDHabit, "get", mock_get)

    response = await client.get(f"{BASE_URL}/{habit_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(habit_id)
    assert response_data["name"] == mock_db_data["name"]
    mock_get.assert_awaited_once_with(id=habit_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_get_habits(client: AsyncClient, monkeypatch):
    """Test GET /habits/ for listing all habits."""
    habit_id1 = uuid4()
    habit_id2 = uuid4()
    mock_db_list = [
        type('MockDBHabit', (), create_mock_habit_data(id=habit_id1))(),
        type('MockDBHabit', (), create_mock_habit_data(id=habit_id2, overrides={"habit_type": "break"}))()
    ]
    mock_get_multi = AsyncMock(return_value=mock_db_list)
    monkeypatch.setattr(habits_api.CRUDHabit, "get_multi_by_user", mock_get_multi)

    response = await client.get(f"{BASE_URL}/?user_id={TEST_USER_ID}&limit=10")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 2
    assert response_data[0]["id"] == str(habit_id1)
    assert response_data[1]["habit_type"] == "break"
    mock_get_multi.assert_awaited_once_with(user_id=TEST_USER_ID, skip=0, limit=10)

@pytest.mark.asyncio
async def test_update_habit(client: AsyncClient, monkeypatch):
    """Test PUT /habits/{habit_id}."""
    habit_id = uuid4()
    update_data = {
        "name": "Updated Habit",
        "habit_type": "break"
    }
    
    # Mock get to return existing habit
    mock_db_data = create_mock_habit_data(id=habit_id)
    mock_get = AsyncMock(return_value=type('MockDBHabit', (), mock_db_data)())
    monkeypatch.setattr(habits_api.CRUDHabit, "get", mock_get)
    
    # Mock update to return updated habit
    updated_data = {**mock_db_data, **update_data}
    mock_update = AsyncMock(return_value=type('MockDBHabit', (), updated_data)())
    monkeypatch.setattr(habits_api.CRUDHabit, "update", mock_update)

    response = await client.put(
        f"{BASE_URL}/{habit_id}?user_id={TEST_USER_ID}",
        json=update_data
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["name"] == update_data["name"]
    assert response_data["habit_type"] == update_data["habit_type"]
    mock_get.assert_awaited_once_with(id=habit_id, user_id=TEST_USER_ID)
    mock_update.assert_awaited_once()

@pytest.mark.asyncio
async def test_delete_habit(client: AsyncClient, monkeypatch):
    """Test DELETE /habits/{habit_id}."""
    habit_id = uuid4()
    mock_db_data = create_mock_habit_data(id=habit_id)
    
    # Mock get to return existing habit
    mock_get = AsyncMock(return_value=type('MockDBHabit', (), mock_db_data)())
    monkeypatch.setattr(habits_api.CRUDHabit, "get", mock_get)
    
    # Mock remove
    mock_remove = AsyncMock()
    monkeypatch.setattr(habits_api.CRUDHabit, "remove", mock_remove)

    response = await client.delete(f"{BASE_URL}/{habit_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_204_NO_CONTENT
    mock_get.assert_awaited_once_with(id=habit_id, user_id=TEST_USER_ID)
    mock_remove.assert_awaited_once_with(id=habit_id, user_id=TEST_USER_ID)

# --- Habit Entry Tests ---

@pytest.mark.asyncio
async def test_create_habit_entry(client: AsyncClient, monkeypatch):
    """Test POST /habits/{habit_id}/entries."""
    habit_id = uuid4()
    entry_id = uuid4()
    # Test with arbitrary string value
    entry_data = {
        "habit_id": str(habit_id),
        "entry_date": date.today().isoformat(),
        "status": "completed",
        "note": "Test Note",
        "value": "arbitrary string value"
    }
    mock_db_data = create_mock_habit_entry_data(id=entry_id, habit_id=habit_id, overrides=entry_data)
    mock_create = AsyncMock(return_value=type('MockDBHabitEntry', (), mock_db_data)())
    monkeypatch.setattr(habits_api.CRUDHabitEntry, "create", mock_create)
    response = await client.post(f"{BASE_URL}/{habit_id}/entries", json=entry_data)
    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    assert response_data["value"] == "arbitrary string value"

    # Test with numeric string value
    entry_data = {
        "habit_id": str(habit_id),
        "entry_date": date.today().isoformat(),
        "status": "completed",
        "note": "Test Note",
        "value": "5.0"
    }
    
    mock_db_data = create_mock_habit_entry_data(id=entry_id, habit_id=habit_id, overrides=entry_data)
    mock_create = AsyncMock(return_value=type('MockDBHabitEntry', (), mock_db_data)())
    monkeypatch.setattr(habits_api.CRUDHabitEntry, "create", mock_create)

    response = await client.post(f"{BASE_URL}/{habit_id}/entries", json=entry_data)

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    assert response_data["id"] == str(entry_id)
    assert response_data["status"] == entry_data["status"]
    mock_create.assert_awaited_once()

@pytest.mark.asyncio
async def test_get_habit_entries(client: AsyncClient, monkeypatch):
    """Test GET /habits/{habit_id}/entries."""
    habit_id = uuid4()
    entry_id1 = uuid4()
    entry_id2 = uuid4()
    mock_db_list = [
        type('MockDBHabitEntry', (), create_mock_habit_entry_data(id=entry_id1, habit_id=habit_id))(),
        type('MockDBHabitEntry', (), create_mock_habit_entry_data(id=entry_id2, habit_id=habit_id, overrides={"status": "skipped"}))()
    ]
    mock_get_multi = AsyncMock(return_value=mock_db_list)
    monkeypatch.setattr(habits_api.CRUDHabitEntry, "get_multi_by_habit", mock_get_multi)

    response = await client.get(f"{BASE_URL}/{habit_id}/entries?limit=10")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 2
    assert response_data[0]["id"] == str(entry_id1)
    assert response_data[1]["status"] == "skipped"
    mock_get_multi.assert_awaited_once_with(
        habit_id=habit_id,
        skip=0,
        limit=10,
        start_date=None,
        end_date=None
    )

# --- Habit Streak Tests ---

@pytest.mark.asyncio
async def test_create_habit_streak(client: AsyncClient, monkeypatch):
    """Test POST /habits/{habit_id}/streak."""
    habit_id = uuid4()
    streak_id = uuid4()
    streak_data = {
        "habit_id": str(habit_id),
        "current_streak": 5,
        "longest_streak": 10,
        "total_streak": 15,
        "last_entry_date": date.today().isoformat(),
        "last_value": "5.0"
    }
    
    mock_db_data = create_mock_habit_streak_data(id=streak_id, habit_id=habit_id, overrides=streak_data)
    mock_create = AsyncMock(return_value=type('MockDBHabitStreak', (), mock_db_data)())
    monkeypatch.setattr(habits_api.CRUDHabitStreak, "create", mock_create)

    response = await client.post(f"{BASE_URL}/{habit_id}/streak", json=streak_data)

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    assert response_data["habit_id"] == str(habit_id)
    assert response_data["current_streak"] == streak_data["current_streak"]
    assert response_data["total_streak"] == streak_data["total_streak"]
    mock_create.assert_awaited_once()

@pytest.mark.asyncio
async def test_get_habit_streak(client: AsyncClient, monkeypatch):
    """Test GET /habits/{habit_id}/streak."""
    habit_id = uuid4()
    streak_id = uuid4()
    mock_db_data = create_mock_habit_streak_data(id=streak_id, habit_id=habit_id)
    if 'id' in mock_db_data:
        del mock_db_data['id']

    mock_get = AsyncMock(return_value=type('MockDBHabitStreak', (), mock_db_data)())
    monkeypatch.setattr(habits_api.CRUDHabitStreak, "get", mock_get)

    response = await client.get(f"{BASE_URL}/{habit_id}/streak")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["habit_id"] == str(habit_id)
    assert response_data["current_streak"] == mock_db_data["current_streak"]
    assert response_data["total_streak"] == mock_db_data["total_streak"]
    mock_get.assert_awaited_once_with(habit_id=habit_id)

@pytest.mark.asyncio
async def test_update_habit_streak(client: AsyncClient, monkeypatch):
    """Test PUT /habits/{habit_id}/streak."""
    habit_id = uuid4()
    streak_id = uuid4()
    update_data = {
        "current_streak": 6,
        "longest_streak": 11,
        "total_streak": 16
    }
    
    # Mock get to return existing streak
    mock_db_data = create_mock_habit_streak_data(id=streak_id, habit_id=habit_id)
    mock_get = AsyncMock(return_value=type('MockDBHabitStreak', (), mock_db_data)())
    monkeypatch.setattr(habits_api.CRUDHabitStreak, "get", mock_get)
    
    # Mock update to return updated streak
    updated_data = {**mock_db_data, **update_data}
    mock_update = AsyncMock(return_value=type('MockDBHabitStreak', (), updated_data)())
    monkeypatch.setattr(habits_api.CRUDHabitStreak, "update", mock_update)

    response = await client.put(
        f"{BASE_URL}/{habit_id}/streak",
        json=update_data
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["current_streak"] == update_data["current_streak"]
    assert response_data["longest_streak"] == update_data["longest_streak"]
    assert response_data["total_streak"] == update_data["total_streak"]
    mock_get.assert_awaited_once_with(habit_id=habit_id)
    mock_update.assert_awaited_once()

@pytest.mark.asyncio
async def test_delete_habit_streak(client: AsyncClient, monkeypatch):
    """Test DELETE /habits/{habit_id}/streak."""
    habit_id = uuid4()
    streak_id = uuid4()
    mock_db_data = create_mock_habit_streak_data(id=streak_id, habit_id=habit_id)
    
    # Mock get to return existing streak
    mock_get = AsyncMock(return_value=type('MockDBHabitStreak', (), mock_db_data)())
    monkeypatch.setattr(habits_api.CRUDHabitStreak, "get", mock_get)
    
    # Mock remove
    mock_remove = AsyncMock()
    monkeypatch.setattr(habits_api.CRUDHabitStreak, "remove", mock_remove)

    response = await client.delete(f"{BASE_URL}/{habit_id}/streak")

    assert response.status_code == status.HTTP_204_NO_CONTENT
    mock_get.assert_awaited_once_with(habit_id=habit_id)
    mock_remove.assert_awaited_once_with(habit_id=habit_id)

# --- Habit Buddy Tests ---

@pytest.mark.asyncio
async def test_create_habit_buddy(client: AsyncClient, monkeypatch):
    """Test POST /habits/buddies for creating a new habit buddy."""
    buddy_id = uuid4()
    buddy_data = {
        "user_id": str(TEST_USER_ID),
        "buddy_email": "test.buddy@example.com"
    }
    
    mock_db_data = create_mock_habit_buddy_data(id=buddy_id, overrides=buddy_data)
    mock_create = AsyncMock(return_value=type('MockDBHabitBuddy', (), mock_db_data)())
    monkeypatch.setattr(habits_api.CRUDHabitBuddy, "create", mock_create)

    response = await client.post(f"{BASE_URL}/buddies", json=buddy_data)

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    assert response_data["id"] == str(buddy_id)
    assert response_data["buddy_email"] == buddy_data["buddy_email"]
    assert response_data["user_id"] == buddy_data["user_id"]
    mock_create.assert_awaited_once()

@pytest.mark.asyncio
async def test_get_habit_buddy(client: AsyncClient, monkeypatch):
    """Test GET /habits/buddies/{buddy_id}."""
    buddy_id = uuid4()
    mock_db_data = create_mock_habit_buddy_data(id=buddy_id)
    mock_get = AsyncMock(return_value=type('MockDBHabitBuddy', (), mock_db_data)())
    monkeypatch.setattr(habits_api.CRUDHabitBuddy, "get", mock_get)

    response = await client.get(f"{BASE_URL}/buddies/{buddy_id}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(buddy_id)
    assert response_data["buddy_email"] == mock_db_data["buddy_email"]
    mock_get.assert_awaited_once_with(id=buddy_id)

@pytest.mark.asyncio
async def test_get_habit_buddies(client: AsyncClient, monkeypatch):
    """Test GET /habits/buddies for listing all habit buddies."""
    buddy_id1 = uuid4()
    buddy_id2 = uuid4()
    mock_db_list = [
        type('MockDBHabitBuddy', (), create_mock_habit_buddy_data(id=buddy_id1))(),
        type('MockDBHabitBuddy', (), create_mock_habit_buddy_data(id=buddy_id2, overrides={"buddy_email": "buddy2@example.com"}))()
    ]
    mock_get_by_user = AsyncMock(return_value=mock_db_list)
    monkeypatch.setattr(habits_api.CRUDHabitBuddy, "get_by_user", mock_get_by_user)

    response = await client.get(f"{BASE_URL}/buddies?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 2
    assert response_data[0]["id"] == str(buddy_id1)
    assert response_data[1]["buddy_email"] == "buddy2@example.com"
    mock_get_by_user.assert_awaited_once_with(user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_update_habit_buddy(client: AsyncClient, monkeypatch):
    """Test PUT /habits/buddies/{buddy_id}."""
    buddy_id = uuid4()
    update_data = {
        "buddy_email": "updated.buddy@example.com"
    }
    
    # Mock get to return existing buddy
    mock_db_data = create_mock_habit_buddy_data(id=buddy_id)
    mock_get = AsyncMock(return_value=type('MockDBHabitBuddy', (), mock_db_data)())
    monkeypatch.setattr(habits_api.CRUDHabitBuddy, "get", mock_get)
    
    # Mock update to return updated buddy
    updated_data = {**mock_db_data, **update_data}
    mock_update = AsyncMock(return_value=type('MockDBHabitBuddy', (), updated_data)())
    monkeypatch.setattr(habits_api.CRUDHabitBuddy, "update", mock_update)

    response = await client.put(
        f"{BASE_URL}/buddies/{buddy_id}",
        json=update_data
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["buddy_email"] == update_data["buddy_email"]
    mock_get.assert_awaited_once_with(id=buddy_id)
    mock_update.assert_awaited_once()

@pytest.mark.asyncio
async def test_delete_habit_buddy(client: AsyncClient, monkeypatch):
    """Test DELETE /habits/buddies/{buddy_id}."""
    buddy_id = uuid4()
    mock_db_data = create_mock_habit_buddy_data(id=buddy_id)
    
    # Mock get to return existing buddy
    mock_get = AsyncMock(return_value=type('MockDBHabitBuddy', (), mock_db_data)())
    monkeypatch.setattr(habits_api.CRUDHabitBuddy, "get", mock_get)
    
    # Mock remove
    mock_remove = AsyncMock()
    monkeypatch.setattr(habits_api.CRUDHabitBuddy, "remove", mock_remove)

    response = await client.delete(f"{BASE_URL}/buddies/{buddy_id}")

    assert response.status_code == status.HTTP_204_NO_CONTENT
    mock_get.assert_awaited_once_with(id=buddy_id)
    mock_remove.assert_awaited_once_with(id=buddy_id)

@pytest.mark.asyncio
async def test_send_accountability_email_success(client: AsyncClient, monkeypatch):
    """Test POST /habits/buddies/{buddy_id}/send-email for successful email sending."""
    buddy_id = uuid4()
    
    # Mock buddy data
    mock_buddy_data = create_mock_habit_buddy_data(
        id=buddy_id, 
        overrides={"buddy_email": "accountability@example.com", "user_id": TEST_USER_ID}
    )
    mock_buddy_get = AsyncMock(return_value=type('MockDBHabitBuddy', (), mock_buddy_data)())
    monkeypatch.setattr(habits_api.CRUDHabitBuddy, "get", mock_buddy_get)
    
    # Mock the email manager
    mock_email_response = {"id": "test-email-id", "message": "Queued. Thank you."}
    mock_email_manager = Mock()
    mock_email_manager.is_configured.return_value = True
    mock_email_manager.send_accountability_email = AsyncMock(return_value=mock_email_response)
    
    # Mock the email manager class
    def mock_email_manager_init():
        return mock_email_manager
    
    monkeypatch.setattr("app.api.habits.HabitBuddiesEmailManager", mock_email_manager_init)

    response = await client.post(f"{BASE_URL}/buddies/{buddy_id}/send-email?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    
    # Verify response structure
    assert "message" in response_data
    assert "buddy_email" in response_data
    assert "email_sent" in response_data
    assert "mailgun_response" in response_data
    assert response_data["buddy_email"] == "accountability@example.com"
    assert response_data["message"] == "Accountability email sent successfully"
    assert response_data["email_sent"] is True
    
    # Verify mocks were called
    mock_buddy_get.assert_awaited_once_with(id=buddy_id)
    mock_email_manager.send_accountability_email.assert_awaited_once_with(
        db=ANY,
        user_id=TEST_USER_ID,
        buddy_email="accountability@example.com",
        days_back=7,
        censor_habits=False
    )

@pytest.mark.asyncio
async def test_send_accountability_email_buddy_not_found(client: AsyncClient, monkeypatch):
    """Test POST /habits/buddies/{buddy_id}/send-email when buddy doesn't exist."""
    buddy_id = uuid4()
    
    # Mock buddy not found
    mock_buddy_get = AsyncMock(return_value=None)
    monkeypatch.setattr(habits_api.CRUDHabitBuddy, "get", mock_buddy_get)

    response = await client.post(f"{BASE_URL}/buddies/{buddy_id}/send-email?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_404_NOT_FOUND
    response_data = response.json()
    assert response_data["detail"] == "Habit buddy not found"
    mock_buddy_get.assert_awaited_once_with(id=buddy_id)

@pytest.mark.asyncio
async def test_send_accountability_email_unauthorized(client: AsyncClient, monkeypatch):
    """Test POST /habits/buddies/{buddy_id}/send-email when user doesn't own the buddy."""
    buddy_id = uuid4()
    different_user_id = uuid4()
    
    # Mock buddy data with different user_id
    mock_buddy_data = create_mock_habit_buddy_data(
        id=buddy_id, 
        overrides={"buddy_email": "accountability@example.com", "user_id": different_user_id}
    )
    mock_buddy_get = AsyncMock(return_value=type('MockDBHabitBuddy', (), mock_buddy_data)())
    monkeypatch.setattr(habits_api.CRUDHabitBuddy, "get", mock_buddy_get)

    response = await client.post(f"{BASE_URL}/buddies/{buddy_id}/send-email?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_403_FORBIDDEN
    response_data = response.json()
    assert response_data["detail"] == "Not authorized to send email for this buddy"
    mock_buddy_get.assert_awaited_once_with(id=buddy_id)

@pytest.mark.asyncio
async def test_send_accountability_email_no_habits(client: AsyncClient, monkeypatch):
    """Test POST /habits/buddies/{buddy_id}/send-email when user has no habits."""
    buddy_id = uuid4()
    
    # Mock buddy data
    mock_buddy_data = create_mock_habit_buddy_data(
        id=buddy_id, 
        overrides={"buddy_email": "accountability@example.com", "user_id": TEST_USER_ID}
    )
    mock_buddy_get = AsyncMock(return_value=type('MockDBHabitBuddy', (), mock_buddy_data)())
    monkeypatch.setattr(habits_api.CRUDHabitBuddy, "get", mock_buddy_get)
    
    # Mock the email manager
    mock_email_response = {"id": "test-email-id", "message": "Queued. Thank you."}
    mock_email_manager = Mock()
    mock_email_manager.is_configured.return_value = True
    mock_email_manager.send_accountability_email = AsyncMock(return_value=mock_email_response)
    
    # Mock the email manager class
    def mock_email_manager_init():
        return mock_email_manager
    
    monkeypatch.setattr("app.api.habits.HabitBuddiesEmailManager", mock_email_manager_init)

    response = await client.post(f"{BASE_URL}/buddies/{buddy_id}/send-email?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    
    # Should still succeed but with empty habit progress
    assert response_data["message"] == "Accountability email sent successfully"
    assert response_data["email_sent"] is True
    
    mock_buddy_get.assert_awaited_once_with(id=buddy_id)
    mock_email_manager.send_accountability_email.assert_awaited_once_with(
        db=ANY,
        user_id=TEST_USER_ID,
        buddy_email="accountability@example.com",
        days_back=7,
        censor_habits=False
    )

# --- Habit Buddy Censoring Tests ---

@pytest.mark.asyncio
async def test_create_habit_buddy_with_censoring(client: AsyncClient, monkeypatch):
    """Test POST /habits/buddies for creating a new habit buddy with censoring enabled."""
    buddy_id = uuid4()
    buddy_data = {
        "user_id": str(TEST_USER_ID),
        "buddy_email": "test.buddy@example.com",
        "censor_habits": True
    }
    
    mock_db_data = create_mock_habit_buddy_data(id=buddy_id, overrides=buddy_data)
    mock_create = AsyncMock(return_value=type('MockDBHabitBuddy', (), mock_db_data)())
    monkeypatch.setattr(habits_api.CRUDHabitBuddy, "create", mock_create)

    response = await client.post(f"{BASE_URL}/buddies", json=buddy_data)

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    assert response_data["id"] == str(buddy_id)
    assert response_data["buddy_email"] == buddy_data["buddy_email"]
    assert response_data["user_id"] == buddy_data["user_id"]
    assert response_data["censor_habits"] is True
    mock_create.assert_awaited_once()

@pytest.mark.asyncio
async def test_create_habit_buddy_default_censoring(client: AsyncClient, monkeypatch):
    """Test POST /habits/buddies with default censoring (should be False)."""
    buddy_id = uuid4()
    buddy_data = {
        "user_id": str(TEST_USER_ID),
        "buddy_email": "test.buddy@example.com"
        # censor_habits not specified - should default to False
    }
    
    mock_db_data = create_mock_habit_buddy_data(id=buddy_id, overrides=buddy_data)
    mock_create = AsyncMock(return_value=type('MockDBHabitBuddy', (), mock_db_data)())
    monkeypatch.setattr(habits_api.CRUDHabitBuddy, "create", mock_create)

    response = await client.post(f"{BASE_URL}/buddies", json=buddy_data)

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    assert response_data["censor_habits"] is False
    mock_create.assert_awaited_once()

@pytest.mark.asyncio
async def test_update_habit_buddy_censoring(client: AsyncClient, monkeypatch):
    """Test PUT /habits/buddies/{buddy_id} to update censoring setting."""
    buddy_id = uuid4()
    update_data = {
        "censor_habits": True
    }
    
    # Mock get to return existing buddy with censoring disabled
    mock_db_data = create_mock_habit_buddy_data(id=buddy_id, overrides={"censor_habits": False})
    mock_get = AsyncMock(return_value=type('MockDBHabitBuddy', (), mock_db_data)())
    monkeypatch.setattr(habits_api.CRUDHabitBuddy, "get", mock_get)
    
    # Mock update to return updated buddy with censoring enabled
    updated_data = {**mock_db_data, **update_data}
    mock_update = AsyncMock(return_value=type('MockDBHabitBuddy', (), updated_data)())
    monkeypatch.setattr(habits_api.CRUDHabitBuddy, "update", mock_update)

    response = await client.put(
        f"{BASE_URL}/buddies/{buddy_id}",
        json=update_data
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["censor_habits"] is True
    mock_get.assert_awaited_once_with(id=buddy_id)
    mock_update.assert_awaited_once()

@pytest.mark.asyncio
async def test_send_accountability_email_with_censoring(client: AsyncClient, monkeypatch):
    """Test POST /habits/buddies/{buddy_id}/send-email with censoring enabled."""
    buddy_id = uuid4()
    
    # Mock buddy data with censoring enabled
    mock_buddy_data = create_mock_habit_buddy_data(
        id=buddy_id, 
        overrides={
            "buddy_email": "accountability@example.com", 
            "user_id": TEST_USER_ID,
            "censor_habits": True
        }
    )
    mock_buddy_get = AsyncMock(return_value=type('MockDBHabitBuddy', (), mock_buddy_data)())
    monkeypatch.setattr(habits_api.CRUDHabitBuddy, "get", mock_buddy_get)
    
    # Mock the email manager
    mock_email_response = {"id": "test-email-id", "message": "Queued. Thank you."}
    mock_email_manager = Mock()
    mock_email_manager.is_configured.return_value = True
    mock_email_manager.send_accountability_email = AsyncMock(return_value=mock_email_response)
    
    # Mock the email manager class
    def mock_email_manager_init():
        return mock_email_manager
    
    monkeypatch.setattr("app.api.habits.HabitBuddiesEmailManager", mock_email_manager_init)

    response = await client.post(f"{BASE_URL}/buddies/{buddy_id}/send-email?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    
    # Verify response structure includes censored flag
    assert "message" in response_data
    assert "buddy_email" in response_data
    assert "email_sent" in response_data
    assert "censored" in response_data
    assert "mailgun_response" in response_data
    assert response_data["buddy_email"] == "accountability@example.com"
    assert response_data["message"] == "Accountability email sent successfully"
    assert response_data["email_sent"] is True
    assert response_data["censored"] is True
    
    # Verify mocks were called with censoring parameter
    mock_buddy_get.assert_awaited_once_with(id=buddy_id)
    mock_email_manager.send_accountability_email.assert_awaited_once_with(
        db=ANY,
        user_id=TEST_USER_ID,
        buddy_email="accountability@example.com",
        days_back=7,
        censor_habits=True
    )

@pytest.mark.asyncio
async def test_send_accountability_email_without_censoring(client: AsyncClient, monkeypatch):
    """Test POST /habits/buddies/{buddy_id}/send-email with censoring disabled."""
    buddy_id = uuid4()
    
    # Mock buddy data with censoring disabled
    mock_buddy_data = create_mock_habit_buddy_data(
        id=buddy_id, 
        overrides={
            "buddy_email": "accountability@example.com", 
            "user_id": TEST_USER_ID,
            "censor_habits": False
        }
    )
    mock_buddy_get = AsyncMock(return_value=type('MockDBHabitBuddy', (), mock_buddy_data)())
    monkeypatch.setattr(habits_api.CRUDHabitBuddy, "get", mock_buddy_get)
    
    # Mock the email manager
    mock_email_response = {"id": "test-email-id", "message": "Queued. Thank you."}
    mock_email_manager = Mock()
    mock_email_manager.is_configured.return_value = True
    mock_email_manager.send_accountability_email = AsyncMock(return_value=mock_email_response)
    
    # Mock the email manager class
    def mock_email_manager_init():
        return mock_email_manager
    
    monkeypatch.setattr("app.api.habits.HabitBuddiesEmailManager", mock_email_manager_init)

    response = await client.post(f"{BASE_URL}/buddies/{buddy_id}/send-email?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    
    # Verify censored flag is False
    assert response_data["censored"] is False
    
    # Verify mocks were called with censoring disabled
    mock_buddy_get.assert_awaited_once_with(id=buddy_id)
    mock_email_manager.send_accountability_email.assert_awaited_once_with(
        db=ANY,
        user_id=TEST_USER_ID,
        buddy_email="accountability@example.com",
        days_back=7,
        censor_habits=False
    )
