import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from fastapi import status
import os
import sys
import asyncio
from pathlib import Path
from uuid import UUID, uuid4
from datetime import datetime, timezone, date
from dotenv import load_dotenv
from typing import AsyncGenerator, List, Optional, Dict, Any
from unittest.mock import AsyncMock
from sqlalchemy import select, delete

# Add the project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.database import AsyncSessionLocal, get_db
from app.crud.weekly_design_system import CRUDWeeklyDesignSystem
from app.models.weekly_design_system import WeeklyDesignSystem as WeeklyDesignSystemModel
from app.main import app
from app.schemas.weekly_design_system import (
    WeeklyDesignSystem,
    WeeklyDesignSystemCreate,
    WeeklyDesignSystemUpdate
)
from app.api import weekly_design_system

# Load environment variables from .env file
load_dotenv()

# --- Test User ID --- 
TEST_USER_ID_STR = os.getenv("TEST_USER_ID")
if not TEST_USER_ID_STR:
    raise ValueError("TEST_USER_ID environment variable not set or empty")
try:
    TEST_USER_ID = UUID(TEST_USER_ID_STR)
except ValueError:
    raise ValueError(f"Invalid UUID format for TEST_USER_ID: {TEST_USER_ID_STR}")
# --------------------

# Since the router prefix has been removed, we need to adjust the base URL 
BASE_URL = "/api"

# --- Database Dependency Override ---
async def override_get_db():
    async with AsyncSessionLocal() as session:
        yield session

# --- Fixture for API Client ---
@pytest_asyncio.fixture(scope="function")
async def client():
    """Provide a test client for making API requests to the app."""
    # Create a fresh FastAPI application for testing
    from fastapi import FastAPI
    test_app = FastAPI()
    
    # Include the weekly design system router directly
    test_app.include_router(
        weekly_design_system.router,
        prefix="/api"
    )
    
    # Override the database dependency
    test_app.dependency_overrides[get_db] = override_get_db
    
    # Use ASGITransport explicitly as per deprecation warning
    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test"
    ) as ac:
        yield ac

# --- Helper Functions ---
def create_mock_weekly_design_system_data(id: UUID, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates mock DB data."""
    base_data = {
        "id": id,
        "user_id": TEST_USER_ID,
        "week_start_date": date(2024, 3, 18),
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
            "Monday": {"9:00": "Meeting", "10:00": "Work"},
            "Tuesday": {"14:00": "Planning", "15:00": "Review"}
        },
        "daily_checklists": {
            "Monday": {
                "gratitude": ["Family", "Health"],
                "habits": ["Exercise", "Reading"]
            },
            "Tuesday": {
                "gratitude": ["Work", "Friends"],
                "habits": ["Meditation", "Writing"]
            }
        },
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    if overrides:
        base_data.update(overrides)
    return base_data

def create_weekly_design_system_api_payload(overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates API payload."""
    payload = {
        "week_start_date": "2024-03-18",
        "next_goals": [
            {"goal": "API Complete project proposal"},
            {"goal": "API Schedule team meeting"},
            {"goal": "API Review quarterly reports"}
        ],
        "personal_goals": [
            {"goal": "API Exercise 3 times this week"},
            {"goal": "API Read 1 book chapter"}
        ],
        "time_blocks": {
            "Monday": {"9:00": "API Meeting", "10:00": "API Work"},
            "Tuesday": {"14:00": "API Planning", "15:00": "API Review"}
        },
        "daily_checklists": {
            "Monday": {
                "gratitude": ["API Family", "API Health"],
                "habits": ["API Exercise", "API Reading"]
            },
            "Tuesday": {
                "gratitude": ["API Work", "API Friends"],
                "habits": ["API Meditation", "API Writing"]
            }
        }
    }
    if overrides:
        payload.update(overrides)
    return payload

# --- Test Cases ---
@pytest.mark.asyncio
async def test_create_weekly_design_system(client: AsyncClient, monkeypatch):
    """Test POST /weekly-design-system/ for creating a new weekly design system."""
    weekly_design_system_id = uuid4()
    create_payload = create_weekly_design_system_api_payload()
    
    mock_db_data = create_mock_weekly_design_system_data(id=weekly_design_system_id, overrides={
        "week_start_date": date.fromisoformat(create_payload["week_start_date"]),
        "next_goals": create_payload["next_goals"],
        "time_blocks": create_payload["time_blocks"],
        "daily_checklists": create_payload["daily_checklists"],
        "user_id": TEST_USER_ID
    })
    
    mock_create = AsyncMock(return_value=type('MockDBWeeklyDesignSystem', (), mock_db_data)())
    from app.crud.weekly_design_system import CRUDWeeklyDesignSystem
    monkeypatch.setattr(CRUDWeeklyDesignSystem, "create_weekly_design_system", mock_create)
    mock_get_by_week = AsyncMock(return_value=None)
    monkeypatch.setattr(CRUDWeeklyDesignSystem, "get_weekly_design_system_by_week", mock_get_by_week)

    response = await client.post(
        f"{BASE_URL}/",
        params={"user_id": TEST_USER_ID},
        json=create_payload
    )

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    assert response_data["id"] == str(weekly_design_system_id)
    assert response_data["user_id"] == str(TEST_USER_ID)
    assert response_data["week_start_date"] == create_payload["week_start_date"]

@pytest.mark.asyncio
async def test_get_weekly_design_system(client: AsyncClient, monkeypatch):
    """Test GET /weekly-design-system/{weekly_design_system_id}."""
    weekly_design_system_id = uuid4()
    mock_db_data = create_mock_weekly_design_system_data(id=weekly_design_system_id)
    mock_get = AsyncMock(return_value=type('MockDBWeeklyDesignSystem', (), mock_db_data)())
    from app.crud.weekly_design_system import CRUDWeeklyDesignSystem
    monkeypatch.setattr(CRUDWeeklyDesignSystem, "get_weekly_design_system", mock_get)

    response = await client.get(
        f"{BASE_URL}/{weekly_design_system_id}",
        params={"user_id": TEST_USER_ID}
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(weekly_design_system_id)

@pytest.mark.asyncio
async def test_get_weekly_design_system_by_week(client: AsyncClient, monkeypatch):
    """Test GET /weekly-design-system/by-week/{week_start_date}."""
    weekly_design_system_id = uuid4()
    week_start_date = "2024-03-18"
    mock_db_data = create_mock_weekly_design_system_data(
        id=weekly_design_system_id,
        overrides={"week_start_date": date.fromisoformat(week_start_date)}
    )
    mock_get_by_week = AsyncMock(return_value=type('MockDBWeeklyDesignSystem', (), mock_db_data)())
    from app.crud.weekly_design_system import CRUDWeeklyDesignSystem
    monkeypatch.setattr(CRUDWeeklyDesignSystem, "get_weekly_design_system_by_week", mock_get_by_week)

    response = await client.get(
        f"{BASE_URL}/by-week/{week_start_date}",
        params={"user_id": TEST_USER_ID}
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(weekly_design_system_id)

@pytest.mark.asyncio
async def test_list_weekly_design_systems(client: AsyncClient, monkeypatch):
    """Test GET /weekly-design-system/."""
    weekly_design_system_id1 = uuid4()
    weekly_design_system_id2 = uuid4()
    mock_db_list = [
        type('MockDBWeeklyDesignSystem', (), create_mock_weekly_design_system_data(id=weekly_design_system_id1))(),
        type('MockDBWeeklyDesignSystem', (), create_mock_weekly_design_system_data(id=weekly_design_system_id2))()
    ]
    mock_get_multi = AsyncMock(return_value=mock_db_list)
    from app.crud.weekly_design_system import CRUDWeeklyDesignSystem
    monkeypatch.setattr(CRUDWeeklyDesignSystem, "get_weekly_design_systems", mock_get_multi)

    response = await client.get(
        f"{BASE_URL}/",
        params={
            "user_id": TEST_USER_ID,
            "skip": 0,
            "limit": 10
        }
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 2

@pytest.mark.asyncio
async def test_update_weekly_design_system(client: AsyncClient, monkeypatch):
    """Test PUT /weekly-design-system/{weekly_design_system_id}."""
    weekly_design_system_id = uuid4()
    update_payload = {
        "next_goals": [
            {"goal": "Updated Goal 1"},
            {"goal": "Updated Goal 2"}
        ],
        "personal_goals": [
            {"goal": "Updated Personal Goal 1"},
            {"goal": "Updated Personal Goal 2"}
        ],
        "time_blocks": {"Wednesday": {"11:00": "Updated Meeting"}}
    }
    
    mock_db_data = create_mock_weekly_design_system_data(id=weekly_design_system_id)
    mock_get = AsyncMock(return_value=type('MockDBWeeklyDesignSystem', (), mock_db_data)())
    from app.crud.weekly_design_system import CRUDWeeklyDesignSystem
    monkeypatch.setattr(CRUDWeeklyDesignSystem, "get_weekly_design_system", mock_get)
    
    mock_update = AsyncMock(return_value=type('MockDBWeeklyDesignSystem', (), {**mock_db_data, **update_payload})())
    monkeypatch.setattr(CRUDWeeklyDesignSystem, "update_weekly_design_system", mock_update)

    response = await client.put(
        f"{BASE_URL}/{weekly_design_system_id}",
        params={"user_id": TEST_USER_ID},
        json=update_payload
    )

    assert response.status_code == status.HTTP_200_OK

@pytest.mark.asyncio
async def test_delete_weekly_design_system(client: AsyncClient, monkeypatch):
    """Test DELETE /weekly-design-system/{weekly_design_system_id}."""
    weekly_design_system_id = uuid4()
    mock_db_data = create_mock_weekly_design_system_data(id=weekly_design_system_id)
    
    mock_get = AsyncMock(return_value=type('MockDBWeeklyDesignSystem', (), mock_db_data)())
    from app.crud.weekly_design_system import CRUDWeeklyDesignSystem
    monkeypatch.setattr(CRUDWeeklyDesignSystem, "get_weekly_design_system", mock_get)
    
    mock_delete = AsyncMock(return_value=type('MockDBWeeklyDesignSystem', (), mock_db_data)())
    monkeypatch.setattr(CRUDWeeklyDesignSystem, "delete_weekly_design_system", mock_delete)

    response = await client.delete(
        f"{BASE_URL}/{weekly_design_system_id}",
        params={"user_id": TEST_USER_ID}
    )

    assert response.status_code == status.HTTP_200_OK

@pytest.mark.asyncio
async def test_create_weekly_design_system_duplicate_week(client: AsyncClient, monkeypatch):
    """Test POST /weekly-design-system/ with duplicate week."""
    create_payload = create_weekly_design_system_api_payload()
    
    # Create a mock existing system with the same week_start_date
    mock_existing = AsyncMock(return_value=type('MockDBWeeklyDesignSystem', (), create_mock_weekly_design_system_data(
        id=uuid4(),
        overrides={"week_start_date": date.fromisoformat(create_payload["week_start_date"])}
    ))())
    
    # Mock the get_weekly_design_system_by_week to return the existing system
    from app.crud.weekly_design_system import CRUDWeeklyDesignSystem
    monkeypatch.setattr(
        CRUDWeeklyDesignSystem,
        "get_weekly_design_system_by_week",
        AsyncMock(return_value=mock_existing.return_value)
    )
    
    response = await client.post(
        f"{BASE_URL}/",
        params={"user_id": TEST_USER_ID},
        json=create_payload
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    response_data = response.json()
    assert "already exists" in response_data["detail"]
    assert str(create_payload["week_start_date"]) in response_data["detail"] 