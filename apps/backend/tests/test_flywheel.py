import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from fastapi import status
import os
import sys
from pathlib import Path
from uuid import UUID, uuid4
from datetime import datetime, timezone
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
from app.schemas.flywheel import (
    FlywheelCreate, FlywheelUpdate, FlywheelResponse, FlywheelEdge
)
from app.api import flywheel as flywheel_api # Import the API module itself

# --- Test User ID --- 
TEST_USER_ID_STR = os.getenv("TEST_USER_ID")
if not TEST_USER_ID_STR:
    raise ValueError("TEST_USER_ID environment variable not set or empty")
try:
    TEST_USER_ID = UUID(TEST_USER_ID_STR)
except ValueError:
    raise ValueError(f"Invalid UUID format for TEST_USER_ID: {TEST_USER_ID_STR}")
# --------------------

BASE_URL = "/flywheels" # Use the prefix defined in api_router.py

# --- Fixture for API Client --- 
@pytest_asyncio.fixture(scope="function")
async def client():
    """Provide a test client for making API requests to the app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

# --- Helper Functions --- 
def create_mock_flywheel_data(id: UUID, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates a dictionary representing a Flywheel database object."""
    base_data = {
        "id": id,
        "user_id": TEST_USER_ID,
        "name": "Test Flywheel",
        "description": "A flywheel for testing.",
        "edges": [
            {"id": "e1", "text": "Step 1"},
            {"id": "e2", "text": "Step 2"}
        ],
        "image_path": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    if overrides:
        if 'edges' in overrides:
             pass
        base_data.update(overrides)
    return base_data

def create_flywheel_api_payload(overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates a dictionary representing the API payload for creating a flywheel."""
    payload = {
        "user_id": str(TEST_USER_ID),
        "name": "Test Flywheel API",
        "description": "Creating via API test",
        "edges": [
            {"id": "api1", "text": "API Step 1"},
            {"id": "api2", "text": "API Step 2"}
        ],
        "image_path": "/images/api_payload.jpg"
    }
    if overrides:
        payload.update(overrides)
    return payload

# --- Test Cases --- 

@pytest.mark.asyncio
async def test_create_flywheel(client: AsyncClient, monkeypatch):
    """Test POST /flywheels/ for creating a new flywheel."""
    create_payload = create_flywheel_api_payload()
    generated_id = uuid4()
    
    mock_db_data = create_mock_flywheel_data(id=generated_id, overrides={
        "name": create_payload["name"],
        "description": create_payload["description"],
        "edges": create_payload["edges"],
        "image_path": create_payload["image_path"],
        "user_id": TEST_USER_ID
    })
    
    mock_create = AsyncMock(return_value=type('MockDBFlywheel', (), mock_db_data)()) 
    monkeypatch.setattr(flywheel_api.CRUDFlywheel, "create", mock_create)

    response = await client.post(f"{BASE_URL}/", json=create_payload)

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    assert response_data["id"] == str(generated_id)
    assert response_data["user_id"] == str(TEST_USER_ID)
    assert response_data["name"] == create_payload["name"]
    assert response_data["edges"] == create_payload["edges"]
    assert response_data["image_path"] == create_payload["image_path"]
    
    mock_create.assert_awaited_once()
    call_args = mock_create.call_args[1]['obj_in']
    assert isinstance(call_args, FlywheelCreate)
    assert call_args.user_id == TEST_USER_ID
    assert call_args.name == create_payload["name"]
    assert call_args.image_path == create_payload["image_path"]

@pytest.mark.asyncio
async def test_get_flywheel(client: AsyncClient, monkeypatch):
    """Test GET /flywheels/{flywheel_id}."""
    test_flywheel_id = uuid4()
    mock_image_path = "/images/mock_get.png"
    mock_db_data = create_mock_flywheel_data(id=test_flywheel_id, overrides={"image_path": mock_image_path})
    
    mock_get = AsyncMock(return_value=type('MockDBFlywheel', (), mock_db_data)()) 
    monkeypatch.setattr(flywheel_api.CRUDFlywheel, "get", mock_get)

    response = await client.get(f"{BASE_URL}/{str(test_flywheel_id)}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(test_flywheel_id)
    assert response_data["user_id"] == str(TEST_USER_ID)
    assert response_data["name"] == mock_db_data["name"]
    assert response_data["image_path"] == mock_image_path
    mock_get.assert_awaited_once_with(id=test_flywheel_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_get_flywheel_not_found(client: AsyncClient, monkeypatch):
    """Test GET /flywheels/{flywheel_id} when flywheel doesn't exist."""
    test_flywheel_id = uuid4()
    mock_get = AsyncMock(return_value=None)
    monkeypatch.setattr(flywheel_api.CRUDFlywheel, "get", mock_get)

    response = await client.get(f"{BASE_URL}/{str(test_flywheel_id)}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_404_NOT_FOUND
    mock_get.assert_awaited_once_with(id=test_flywheel_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_get_flywheels(client: AsyncClient, monkeypatch):
    """Test GET /flywheels/ for listing flywheels for a user."""
    fw_id1 = uuid4()
    fw_id2 = uuid4()
    mock_db_list = [
        type('MockDBFlywheel', (), create_mock_flywheel_data(id=fw_id1, overrides={"image_path": "img1.jpg"}))(),
        type('MockDBFlywheel', (), create_mock_flywheel_data(id=fw_id2, overrides={"name": "Another Flywheel", "image_path": None}))()
    ]
    mock_get_multi = AsyncMock(return_value=mock_db_list)
    monkeypatch.setattr(flywheel_api.CRUDFlywheel, "get_multi_by_user", mock_get_multi)

    response = await client.get(f"{BASE_URL}/?user_id={TEST_USER_ID}&skip=0&limit=10")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 2
    assert response_data[0]["id"] == str(fw_id1)
    assert response_data[0]["image_path"] == "img1.jpg"
    assert response_data[1]["id"] == str(fw_id2)
    assert response_data[1]["name"] == "Another Flywheel"
    assert response_data[1]["image_path"] is None
    mock_get_multi.assert_awaited_once_with(user_id=TEST_USER_ID, skip=0, limit=10)

@pytest.mark.asyncio
async def test_update_flywheel(client: AsyncClient, monkeypatch):
    """Test PUT /flywheels/{flywheel_id}."""
    test_flywheel_id = uuid4()
    update_payload = {
        "name": "Updated Flywheel Name",
        "description": "Updated description.",
        "edges": [{"id": "up1", "text": "Updated Step"}],
        "image_path": "/images/updated.svg"
    }
    
    mock_db_data_orig = create_mock_flywheel_data(id=test_flywheel_id, overrides={"image_path": "orig.jpg"})
    mock_get = AsyncMock(return_value=type('MockDBFlywheel', (), mock_db_data_orig)()) 
    monkeypatch.setattr(flywheel_api.CRUDFlywheel, "get", mock_get)
    
    mock_db_data_updated = {**mock_db_data_orig, **update_payload}
    mock_db_data_updated['id'] = test_flywheel_id 
    mock_update = AsyncMock(return_value=type('MockDBFlywheel', (), mock_db_data_updated)()) 
    monkeypatch.setattr(flywheel_api.CRUDFlywheel, "update", mock_update)

    response = await client.put(
        f"{BASE_URL}/{str(test_flywheel_id)}?user_id={TEST_USER_ID}",
        json=update_payload
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(test_flywheel_id)
    assert response_data["name"] == update_payload["name"]
    assert response_data["description"] == update_payload["description"]
    assert response_data["edges"] == update_payload["edges"]
    assert response_data["image_path"] == update_payload["image_path"]
    
    mock_get.assert_awaited_once_with(id=test_flywheel_id, user_id=TEST_USER_ID)
    mock_update.assert_awaited_once()
    update_call_args = mock_update.call_args[1]
    assert update_call_args['db_obj'].id == test_flywheel_id
    assert isinstance(update_call_args['obj_in'], FlywheelUpdate)
    assert update_call_args['obj_in'].name == update_payload["name"]
    assert update_call_args['obj_in'].image_path == update_payload["image_path"]

@pytest.mark.asyncio
async def test_update_flywheel_not_found(client: AsyncClient, monkeypatch):
    """Test PUT /flywheels/{flywheel_id} when flywheel doesn't exist."""
    test_flywheel_id = uuid4()
    update_payload = {"name": "Update Nonexistent"}

    mock_get = AsyncMock(return_value=None)
    monkeypatch.setattr(flywheel_api.CRUDFlywheel, "get", mock_get)
    mock_update = AsyncMock()
    monkeypatch.setattr(flywheel_api.CRUDFlywheel, "update", mock_update)

    response = await client.put(
        f"{BASE_URL}/{str(test_flywheel_id)}?user_id={TEST_USER_ID}",
        json=update_payload
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    mock_get.assert_awaited_once_with(id=test_flywheel_id, user_id=TEST_USER_ID)
    mock_update.assert_not_awaited()

@pytest.mark.asyncio
async def test_delete_flywheel(client: AsyncClient, monkeypatch):
    """Test DELETE /flywheels/{flywheel_id}."""
    test_flywheel_id = uuid4()
    mock_db_data = create_mock_flywheel_data(id=test_flywheel_id)
    
    mock_remove = AsyncMock(return_value=type('MockDBFlywheel', (), mock_db_data)()) 
    monkeypatch.setattr(flywheel_api.CRUDFlywheel, "remove", mock_remove)

    response = await client.delete(f"{BASE_URL}/{str(test_flywheel_id)}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_204_NO_CONTENT
    mock_remove.assert_awaited_once_with(id=test_flywheel_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_delete_flywheel_not_found(client: AsyncClient, monkeypatch):
    """Test DELETE /flywheels/{flywheel_id} when flywheel doesn't exist."""
    test_flywheel_id = uuid4()
    
    mock_remove = AsyncMock(return_value=None) 
    monkeypatch.setattr(flywheel_api.CRUDFlywheel, "remove", mock_remove)

    response = await client.delete(f"{BASE_URL}/{str(test_flywheel_id)}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_404_NOT_FOUND
    mock_remove.assert_awaited_once_with(id=test_flywheel_id, user_id=TEST_USER_ID)
