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
from app.crud.annual_calendar_plans import CRUDAnnualCalendarPlan
from app.models.annual_calendar_plans import AnnualCalendarPlan as AnnualCalendarPlanModel
from app.main import app
from app.schemas.annual_calendar_plans import (
    AnnualCalendarPlan,
    AnnualCalendarPlanCreate,
    AnnualCalendarPlanUpdate,
    AnnualCalendarPlanFilter
)
from app.api import annual_calendar_plans

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

# Base URL for API endpoints
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
    
    # Include the annual calendar plans router directly
    test_app.include_router(
        annual_calendar_plans.router,
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
def create_mock_annual_calendar_plan_data(id: UUID, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates mock DB data."""
    base_data = {
        "id": id,
        "user_id": TEST_USER_ID,
        "title": "Test Annual Plan 2024",
        "description": "This is a test annual calendar plan for 2024",
        "start_date": date(2024, 1, 1),
        "end_date": date(2024, 12, 31),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    if overrides:
        base_data.update(overrides)
    return base_data

def create_annual_calendar_plan_api_payload(overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates API payload."""
    payload = {
        "title": "Test Annual Plan 2024",
        "description": "This is a test annual calendar plan for 2024",
        "start_date": "2024-01-01",
        "end_date": "2024-12-31",
        "user_id": str(TEST_USER_ID)
    }
    if overrides:
        payload.update(overrides)
    return payload

# --- Test Cases ---
@pytest.mark.asyncio
async def test_create_annual_calendar_plan(client: AsyncClient, monkeypatch):
    """Test POST / for creating a new annual calendar plan."""
    plan_id = uuid4()
    create_payload = create_annual_calendar_plan_api_payload()
    
    mock_db_data = create_mock_annual_calendar_plan_data(id=plan_id, overrides={
        "title": create_payload["title"],
        "description": create_payload["description"],
        "start_date": date.fromisoformat(create_payload["start_date"]),
        "end_date": date.fromisoformat(create_payload["end_date"]),
        "user_id": TEST_USER_ID
    })
    
    mock_create = AsyncMock(return_value=type('MockDBAnnualCalendarPlan', (), mock_db_data)())
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "create", mock_create)

    response = await client.post(
        f"{BASE_URL}/",
        json=create_payload
    )

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    assert response_data["id"] == str(plan_id)
    assert response_data["user_id"] == str(TEST_USER_ID)
    assert response_data["title"] == create_payload["title"]
    assert response_data["description"] == create_payload["description"]

@pytest.mark.asyncio
async def test_get_annual_calendar_plan(client: AsyncClient, monkeypatch):
    """Test GET /{plan_id}."""
    plan_id = uuid4()
    mock_db_data = create_mock_annual_calendar_plan_data(id=plan_id)
    mock_get = AsyncMock(return_value=type('MockDBAnnualCalendarPlan', (), mock_db_data)())
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "get", mock_get)

    response = await client.get(
        f"{BASE_URL}/{plan_id}",
        params={"user_id": str(TEST_USER_ID)}
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(plan_id)
    assert response_data["title"] == "Test Annual Plan 2024"

@pytest.mark.asyncio
async def test_list_annual_calendar_plans(client: AsyncClient, monkeypatch):
    """Test GET / for listing user's annual calendar plans."""
    plan_id1 = uuid4()
    plan_id2 = uuid4()
    mock_db_list = [
        type('MockDBAnnualCalendarPlan', (), create_mock_annual_calendar_plan_data(
            id=plan_id1,
            overrides={"title": "Travel Plan 2024"}
        ))(),
        type('MockDBAnnualCalendarPlan', (), create_mock_annual_calendar_plan_data(
            id=plan_id2,
            overrides={"title": "Career Plan 2024", "description": "Career development goals"}
        ))()
    ]
    mock_get_multi = AsyncMock(return_value=mock_db_list)
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "get_multi_by_user", mock_get_multi)

    response = await client.get(
        f"{BASE_URL}/",
        params={
            "user_id": str(TEST_USER_ID),
            "skip": 0,
            "limit": 10
        }
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 2
    assert response_data[0]["title"] == "Travel Plan 2024"
    assert response_data[1]["title"] == "Career Plan 2024"

@pytest.mark.asyncio
async def test_update_annual_calendar_plan(client: AsyncClient, monkeypatch):
    """Test PUT /{plan_id}."""
    plan_id = uuid4()
    update_payload = {
        "title": "Updated Annual Plan 2024",
        "description": "Updated description for the annual plan"
    }
    
    mock_db_data = create_mock_annual_calendar_plan_data(id=plan_id)
    mock_get = AsyncMock(return_value=type('MockDBAnnualCalendarPlan', (), mock_db_data)())
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "get", mock_get)
    
    mock_update = AsyncMock(return_value=type('MockDBAnnualCalendarPlan', (), {**mock_db_data, **update_payload})())
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "update", mock_update)

    response = await client.put(
        f"{BASE_URL}/{plan_id}",
        json=update_payload,
        params={"user_id": str(TEST_USER_ID)}
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["title"] == update_payload["title"]
    assert response_data["description"] == update_payload["description"]

@pytest.mark.asyncio
async def test_delete_annual_calendar_plan(client: AsyncClient, monkeypatch):
    """Test DELETE /{plan_id}."""
    plan_id = uuid4()
    mock_db_data = create_mock_annual_calendar_plan_data(id=plan_id)
    mock_get = AsyncMock(return_value=type('MockDBAnnualCalendarPlan', (), mock_db_data)())
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "get", mock_get)
    
    mock_remove = AsyncMock(return_value=None)
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "remove", mock_remove)

    response = await client.delete(
        f"{BASE_URL}/{plan_id}",
        params={"user_id": str(TEST_USER_ID)}
    )

    assert response.status_code == status.HTTP_204_NO_CONTENT

@pytest.mark.asyncio
async def test_get_filtered_annual_calendar_plans(client: AsyncClient, monkeypatch):
    """Test GET /filter/."""
    plan_id1 = uuid4()
    plan_id2 = uuid4()
    mock_db_list = [
        type('MockDBAnnualCalendarPlan', (), create_mock_annual_calendar_plan_data(
            id=plan_id1,
            overrides={"title": "Travel Plan 2024"}
        ))(),
        type('MockDBAnnualCalendarPlan', (), create_mock_annual_calendar_plan_data(
            id=plan_id2,
            overrides={"title": "Career Plan 2024"}
        ))()
    ]
    mock_get_multi = AsyncMock(return_value=mock_db_list)
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "get_multi_with_filter", mock_get_multi)

    response = await client.get(
        f"{BASE_URL}/filter/",
        params={
            "user_id": str(TEST_USER_ID),
            "title_contains": "Plan",
            "start_date_from": "2024-01-01",
            "end_date_to": "2024-12-31"
        }
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 2

@pytest.mark.asyncio
async def test_get_current_plans(client: AsyncClient, monkeypatch):
    """Test GET /current/."""
    plan_id = uuid4()
    mock_db_list = [
        type('MockDBAnnualCalendarPlan', (), create_mock_annual_calendar_plan_data(
            id=plan_id,
            overrides={"title": "Current Plan"}
        ))()
    ]
    mock_get_current = AsyncMock(return_value=mock_db_list)
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "get_current_plans", mock_get_current)

    response = await client.get(
        f"{BASE_URL}/current/",
        params={"user_id": str(TEST_USER_ID)}
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 1
    assert response_data[0]["title"] == "Current Plan"

@pytest.mark.asyncio
async def test_get_upcoming_plans(client: AsyncClient, monkeypatch):
    """Test GET /upcoming/."""
    plan_id = uuid4()
    mock_db_list = [
        type('MockDBAnnualCalendarPlan', (), create_mock_annual_calendar_plan_data(
            id=plan_id,
            overrides={"title": "Upcoming Plan"}
        ))()
    ]
    mock_get_upcoming = AsyncMock(return_value=mock_db_list)
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "get_upcoming_plans", mock_get_upcoming)

    response = await client.get(
        f"{BASE_URL}/upcoming/",
        params={
            "user_id": str(TEST_USER_ID),
            "days_ahead": 30
        }
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 1
    assert response_data[0]["title"] == "Upcoming Plan"

@pytest.mark.asyncio
async def test_get_plans_by_date_range(client: AsyncClient, monkeypatch):
    """Test GET /date-range/."""
    plan_id = uuid4()
    mock_db_list = [
        type('MockDBAnnualCalendarPlan', (), create_mock_annual_calendar_plan_data(
            id=plan_id,
            overrides={"title": "Plan in Range"}
        ))()
    ]
    mock_get_range = AsyncMock(return_value=mock_db_list)
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "get_plans_by_date_range", mock_get_range)

    response = await client.get(
        f"{BASE_URL}/date-range/",
        params={
            "user_id": str(TEST_USER_ID),
            "start_date": "2024-01-01",
            "end_date": "2024-12-31"
        }
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 1
    assert response_data[0]["title"] == "Plan in Range"

@pytest.mark.asyncio
async def test_get_plan_count(client: AsyncClient, monkeypatch):
    """Test GET /stats/count."""
    mock_count = AsyncMock(return_value=5)
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "count_by_user", mock_count)

    response = await client.get(
        f"{BASE_URL}/stats/count",
        params={"user_id": str(TEST_USER_ID)}
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["total_plans"] == 5

@pytest.mark.asyncio
async def test_get_plans_summary(client: AsyncClient, monkeypatch):
    """Test GET /stats/summary."""
    current_plans = [
        type('MockDBAnnualCalendarPlan', (), create_mock_annual_calendar_plan_data(id=uuid4()))()
    ]
    upcoming_plans = [
        type('MockDBAnnualCalendarPlan', (), create_mock_annual_calendar_plan_data(id=uuid4()))()
    ]
    
    mock_get_current = AsyncMock(return_value=current_plans)
    mock_get_upcoming = AsyncMock(return_value=upcoming_plans)
    mock_count = AsyncMock(return_value=5)
    
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "get_current_plans", mock_get_current)
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "get_upcoming_plans", mock_get_upcoming)
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "count_by_user", mock_count)

    response = await client.get(
        f"{BASE_URL}/stats/summary",
        params={"user_id": str(TEST_USER_ID)}
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["total_plans"] == 5
    assert response_data["active_plans"] == 1
    assert response_data["upcoming_plans"] == 1

@pytest.mark.asyncio
async def test_create_multiple_plans(client: AsyncClient, monkeypatch):
    """Test POST /bulk/."""
    plan_id1 = uuid4()
    plan_id2 = uuid4()
    plans_payload = [
        create_annual_calendar_plan_api_payload({"title": "Bulk Plan 1"}),
        create_annual_calendar_plan_api_payload({"title": "Bulk Plan 2"})
    ]
    
    mock_create = AsyncMock(side_effect=[
        type('MockDBAnnualCalendarPlan', (), create_mock_annual_calendar_plan_data(
            id=plan_id1, overrides={"title": "Bulk Plan 1"}
        ))(),
        type('MockDBAnnualCalendarPlan', (), create_mock_annual_calendar_plan_data(
            id=plan_id2, overrides={"title": "Bulk Plan 2"}
        ))()
    ])
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "create", mock_create)

    response = await client.post(
        f"{BASE_URL}/bulk/",
        json=plans_payload
    )

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    assert len(response_data) == 2
    assert response_data[0]["title"] == "Bulk Plan 1"
    assert response_data[1]["title"] == "Bulk Plan 2"

@pytest.mark.asyncio
async def test_delete_multiple_plans(client: AsyncClient, monkeypatch):
    """Test DELETE /bulk/."""
    plan_id1 = uuid4()
    plan_id2 = uuid4()
    
    mock_get = AsyncMock(return_value=type('MockDBAnnualCalendarPlan', (), create_mock_annual_calendar_plan_data(id=plan_id1))())
    mock_remove = AsyncMock(return_value=None)
    
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "get", mock_get)
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "remove", mock_remove)

    response = await client.delete(
        f"{BASE_URL}/bulk/",
        params={
            "user_id": str(TEST_USER_ID),
            "plan_ids": [str(plan_id1), str(plan_id2)]
        }
    )

    assert response.status_code == status.HTTP_204_NO_CONTENT

@pytest.mark.asyncio
async def test_get_annual_calendar_plan_not_found(client: AsyncClient, monkeypatch):
    """Test GET /{plan_id} with non-existent plan."""
    plan_id = uuid4()
    mock_get = AsyncMock(return_value=None)
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "get", mock_get)

    response = await client.get(
        f"{BASE_URL}/{plan_id}",
        params={"user_id": str(TEST_USER_ID)}
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND

@pytest.mark.asyncio
async def test_get_annual_calendar_plan_wrong_user(client: AsyncClient, monkeypatch):
    """Test GET /{plan_id} with wrong user."""
    plan_id = uuid4()
    wrong_user_id = uuid4()
    mock_db_data = create_mock_annual_calendar_plan_data(id=plan_id)
    mock_get = AsyncMock(return_value=type('MockDBAnnualCalendarPlan', (), mock_db_data)())
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "get", mock_get)

    response = await client.get(
        f"{BASE_URL}/{plan_id}",
        params={"user_id": str(wrong_user_id)}
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND

@pytest.mark.asyncio
async def test_update_annual_calendar_plan_not_found(client: AsyncClient, monkeypatch):
    """Test PUT /{plan_id} with non-existent plan."""
    plan_id = uuid4()
    mock_get = AsyncMock(return_value=None)
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "get", mock_get)

    response = await client.put(
        f"{BASE_URL}/{plan_id}",
        json={"title": "Updated Title"},
        params={"user_id": str(TEST_USER_ID)}
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND

@pytest.mark.asyncio
async def test_delete_annual_calendar_plan_not_found(client: AsyncClient, monkeypatch):
    """Test DELETE /{plan_id} with non-existent plan."""
    plan_id = uuid4()
    mock_get = AsyncMock(return_value=None)
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "get", mock_get)

    response = await client.delete(
        f"{BASE_URL}/{plan_id}",
        params={"user_id": str(TEST_USER_ID)}
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND

@pytest.mark.asyncio
async def test_create_annual_calendar_plan_invalid_dates(client: AsyncClient):
    """Test POST / with end_date before start_date."""
    create_payload = create_annual_calendar_plan_api_payload({
        "start_date": "2024-12-31",
        "end_date": "2024-01-01"
    })

    response = await client.post(
        f"{BASE_URL}/",
        json=create_payload
    )

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    response_data = response.json()
    assert any("end_date" in error["loc"] for error in response_data["detail"])  # Verify the error is about end_date

@pytest.mark.asyncio
async def test_create_annual_calendar_plan_missing_required_fields(client: AsyncClient):
    """Test POST / with missing required fields."""
    create_payload = {
        "description": "This should fail",
        "user_id": str(TEST_USER_ID)
    }

    response = await client.post(
        f"{BASE_URL}/",
        json=create_payload
    )

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

@pytest.mark.asyncio
async def test_full_crud_workflow(client: AsyncClient, monkeypatch):
    """Test full CRUD workflow."""
    # Create
    plan_id = uuid4()
    create_payload = create_annual_calendar_plan_api_payload()
    mock_db_data = create_mock_annual_calendar_plan_data(id=plan_id)
    
    mock_create = AsyncMock(return_value=type('MockDBAnnualCalendarPlan', (), mock_db_data)())
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "create", mock_create)
    
    create_response = await client.post(
        f"{BASE_URL}/",
        json=create_payload
    )
    assert create_response.status_code == status.HTTP_201_CREATED
    created_plan = create_response.json()
    
    # Read
    mock_get = AsyncMock(return_value=type('MockDBAnnualCalendarPlan', (), mock_db_data)())
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "get", mock_get)
    
    read_response = await client.get(
        f"{BASE_URL}/{created_plan['id']}",
        params={"user_id": str(TEST_USER_ID)}
    )
    assert read_response.status_code == status.HTTP_200_OK
    
    # Update
    update_payload = {"title": "Updated Title"}
    mock_update = AsyncMock(return_value=type('MockDBAnnualCalendarPlan', (), {**mock_db_data, **update_payload})())
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "update", mock_update)
    
    update_response = await client.put(
        f"{BASE_URL}/{created_plan['id']}",
        json=update_payload,
        params={"user_id": str(TEST_USER_ID)}
    )
    assert update_response.status_code == status.HTTP_200_OK
    assert update_response.json()["title"] == "Updated Title"
    
    # Delete
    mock_remove = AsyncMock(return_value=None)
    monkeypatch.setattr(annual_calendar_plans.CRUDAnnualCalendarPlan, "remove", mock_remove)
    
    delete_response = await client.delete(
        f"{BASE_URL}/{created_plan['id']}",
        params={"user_id": str(TEST_USER_ID)}
    )
    assert delete_response.status_code == status.HTTP_204_NO_CONTENT 