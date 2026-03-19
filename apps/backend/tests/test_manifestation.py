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

# --- Add project root to sys.path --- 
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
# -------------------------------------

# Load environment variables from .env file
load_dotenv()

# Import app and schemas
from app.main import app
from app.schemas.manifestation import (
    ManifestationCreate,
    ManifestationUpdate,
    ManifestationResponse
)
from app.api import manifestation as manifestation_api

# --- Test User ID --- 
TEST_USER_ID_STR = os.getenv("TEST_USER_ID")
if not TEST_USER_ID_STR:
    raise ValueError("TEST_USER_ID environment variable not set or empty")
try:
    TEST_USER_ID = UUID(TEST_USER_ID_STR)
except ValueError:
    raise ValueError(f"Invalid UUID format for TEST_USER_ID: {TEST_USER_ID_STR}")
# --------------------

BASE_URL = "/manifestation"

# --- Fixture for API Client ---
@pytest_asyncio.fixture(scope="function")
async def client():
    """Provide a test client for making API requests to the app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

# --- Helper Functions ---
def create_mock_manifestation_data(id: UUID, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates mock DB data, including new fields."""
    base_data = {
        "id": id,
        "user_id": TEST_USER_ID,
        "strong_life_changes": [f"Change {i+1}" for i in range(5)],
        "big_targets": [f"Target {i+1}" for i in range(5)],
        "top_values": [f"Value {i+1}" for i in range(5)],
        "non_negotiables": [f"Non-neg {i+1}" for i in range(5)],
        "life_rules": [f"Rule {i+1}" for i in range(5)],
        "rituals": [f"Ritual {i+1}" for i in range(5)],
        # Add new fields with defaults or example values
        "courage_list": [], # Default from model
        "year": None,
        "theme": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    if overrides:
        base_data.update(overrides)
    return base_data

def create_manifestation_api_payload(overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates API payload, including new optional fields."""
    payload = {
        "user_id": str(TEST_USER_ID),
        "strong_life_changes": [f"API Change {i+1}" for i in range(5)],
        "big_targets": [f"API Target {i+1}" for i in range(5)],
        "top_values": [f"API Value {i+1}" for i in range(5)],
        "non_negotiables": [f"API Non-neg {i+1}" for i in range(5)],
        "life_rules": [f"API Rule {i+1}" for i in range(5)],
        "rituals": [f"API Ritual {i+1}" for i in range(5)],
        # Include new optional fields for testing
        "courage_list": [{"text": "API Courage"}],
        "year": 2024,
        "theme": "API Theme"
    }
    if overrides:
        payload.update(overrides)
    # Remove fields not present in ManifestationCreate if necessary (though Pydantic handles extra fields)
    # Example: payload.pop('id', None)
    return payload

# --- Test Cases ---

@pytest.mark.asyncio
async def test_create_manifestation(client: AsyncClient, monkeypatch):
    """Test POST /manifestation/ for creating a new manifestation."""
    manifestation_id = uuid4()
    create_payload = create_manifestation_api_payload()
    
    # Mock DB data reflects the create payload, including new fields
    mock_db_data = create_mock_manifestation_data(id=manifestation_id, overrides={
        "strong_life_changes": create_payload["strong_life_changes"],
        "big_targets": create_payload["big_targets"],
        "top_values": create_payload["top_values"],
        "non_negotiables": create_payload["non_negotiables"],
        "life_rules": create_payload["life_rules"],
        "rituals": create_payload["rituals"],
        "courage_list": create_payload["courage_list"],
        "year": create_payload["year"],
        "theme": create_payload["theme"],
        "user_id": TEST_USER_ID # Ensure UUID for mock DB object
    })
    
    mock_create = AsyncMock(return_value=type('MockDBManifestation', (), mock_db_data)()) 
    monkeypatch.setattr(manifestation_api.CRUDManifestation, "create", mock_create)

    response = await client.post(BASE_URL + "/", json=create_payload)

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    assert response_data["id"] == str(manifestation_id)
    assert response_data["user_id"] == str(TEST_USER_ID)
    assert response_data["strong_life_changes"] == create_payload["strong_life_changes"]
    # Add assertions for new fields
    # CourageItem automatically adds completed=False, so we need to expect that
    expected_courage_list = [{"text": "API Courage", "completed": False}]
    assert response_data["courage_list"] == expected_courage_list
    assert response_data["year"] == create_payload["year"]
    assert response_data["theme"] == create_payload["theme"]
    
    mock_create.assert_awaited_once()
    # Check the object passed to the mock create
    call_args = mock_create.call_args[1]['obj_in']
    assert isinstance(call_args, ManifestationCreate)
    assert call_args.year == create_payload["year"]
    assert call_args.theme == create_payload["theme"]
    # CourageItem objects are created from the payload, so we need to compare properly
    assert len(call_args.courage_list) == len(create_payload["courage_list"])
    assert call_args.courage_list[0].text == create_payload["courage_list"][0]["text"]
    assert call_args.courage_list[0].completed == False

@pytest.mark.asyncio
async def test_get_manifestation(client: AsyncClient, monkeypatch):
    """Test GET /manifestation/{manifestation_id} including new fields."""
    manifestation_id = uuid4()
    # Include new fields in mock data
    mock_db_data = create_mock_manifestation_data(id=manifestation_id, overrides={
        "year": 2023,
        "theme": "Test Theme",
        "courage_list": ["Test Courage"]
    })
    mock_get = AsyncMock(return_value=type('MockDBManifestation', (), mock_db_data)()) 
    monkeypatch.setattr(manifestation_api.CRUDManifestation, "get", mock_get)

    response = await client.get(f"{BASE_URL}/{manifestation_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(manifestation_id)
    assert response_data["user_id"] == str(TEST_USER_ID)
    # Add assertions for new fields
    assert response_data["year"] == 2023
    assert response_data["theme"] == "Test Theme"
    assert response_data["courage_list"] == ["Test Courage"]
    mock_get.assert_awaited_once_with(id=manifestation_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_get_manifestations(client: AsyncClient, monkeypatch):
    """Test GET /manifestation/ including new fields in response."""
    manifestation_id1 = uuid4()
    manifestation_id2 = uuid4()
    mock_db_list = [
        type('MockDBManifestation', (), create_mock_manifestation_data(id=manifestation_id1, overrides={"year": 2022}))(),
        type('MockDBManifestation', (), create_mock_manifestation_data(id=manifestation_id2, overrides={"theme": "Another Theme", "courage_list": []}))()
    ]
    mock_get_multi = AsyncMock(return_value=mock_db_list)
    monkeypatch.setattr(manifestation_api.CRUDManifestation, "get_multi_by_user", mock_get_multi)

    response = await client.get(f"{BASE_URL}/?user_id={TEST_USER_ID}&limit=10")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 2
    assert response_data[0]["id"] == str(manifestation_id1)
    assert response_data[0]["year"] == 2022
    assert response_data[1]["theme"] == "Another Theme"
    # Response schema expects courage_list, even if empty (due to db default)
    assert response_data[1]["courage_list"] == []
    mock_get_multi.assert_awaited_once_with(user_id=TEST_USER_ID, skip=0, limit=10)

@pytest.mark.asyncio
async def test_update_manifestation(client: AsyncClient, monkeypatch):
    """Test PUT /manifestation/{manifestation_id} including new fields."""
    manifestation_id = uuid4()
    update_payload = {
        "rituals": ["Updated Ritual"],
        "year": 2025,
        "theme": "Updated Theme",
        "courage_list": [{"text": "Updated Courage"}]
    }
    
    mock_db_data_orig = create_mock_manifestation_data(id=manifestation_id, overrides={"year": 2024, "theme": "Orig Theme"})
    mock_get = AsyncMock(return_value=type('MockDBManifestation', (), mock_db_data_orig)()) 
    monkeypatch.setattr(manifestation_api.CRUDManifestation, "get", mock_get)
    
    mock_db_data_updated = {**mock_db_data_orig, **update_payload}
    # Ensure ID and user_id remain correct UUIDs
    mock_db_data_updated['id'] = manifestation_id 
    mock_db_data_updated['user_id'] = TEST_USER_ID 
    mock_update = AsyncMock(return_value=type('MockDBManifestation', (), mock_db_data_updated)()) 
    monkeypatch.setattr(manifestation_api.CRUDManifestation, "update", mock_update)

    response = await client.put(
        f"{BASE_URL}/{manifestation_id}?user_id={TEST_USER_ID}",
        json=update_payload
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["rituals"] == update_payload["rituals"]
    # Add assertions for new fields
    assert response_data["year"] == update_payload["year"]
    assert response_data["theme"] == update_payload["theme"]
    # CourageItem automatically adds completed=False, so we need to expect that
    expected_courage_list = [{"text": "Updated Courage", "completed": False}]
    assert response_data["courage_list"] == expected_courage_list
    
    mock_get.assert_awaited_once_with(id=manifestation_id, user_id=TEST_USER_ID)
    mock_update.assert_awaited_once()
    # Check arguments passed to mock update
    update_call_args = mock_update.call_args[1]
    assert update_call_args['db_obj'].id == manifestation_id
    assert isinstance(update_call_args['obj_in'], ManifestationUpdate)
    assert update_call_args['obj_in'].year == update_payload["year"]
    assert update_call_args['obj_in'].theme == update_payload["theme"]
    # CourageItem objects are created from the payload, so we need to compare properly
    assert len(update_call_args['obj_in'].courage_list) == len(update_payload["courage_list"])
    assert update_call_args['obj_in'].courage_list[0].text == update_payload["courage_list"][0]["text"]
    assert update_call_args['obj_in'].courage_list[0].completed == False

@pytest.mark.asyncio
async def test_delete_manifestation(client: AsyncClient, monkeypatch):
    """Test DELETE /manifestation/{manifestation_id}."""
    manifestation_id = uuid4()
    mock_db_data = create_mock_manifestation_data(id=manifestation_id)
    
    # Mock get called by API endpoint
    mock_get = AsyncMock(return_value=type('MockDBManifestation', (), mock_db_data)()) 
    monkeypatch.setattr(manifestation_api.CRUDManifestation, "get", mock_get)
    
    # Mock remove called by API endpoint
    # In API, remove doesn't return the obj, so mock doesn't need to either
    mock_remove = AsyncMock(return_value=None) 
    monkeypatch.setattr(manifestation_api.CRUDManifestation, "remove", mock_remove)

    response = await client.delete(f"{BASE_URL}/{manifestation_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_204_NO_CONTENT
    mock_get.assert_awaited_once_with(id=manifestation_id, user_id=TEST_USER_ID)
    mock_remove.assert_awaited_once_with(id=manifestation_id, user_id=TEST_USER_ID)

# Add test for updating with invalid year (optional)
@pytest.mark.asyncio
async def test_update_manifestation_invalid_year(client: AsyncClient, monkeypatch):
    """Test PUT /manifestation/{manifestation_id} with invalid year."""
    manifestation_id = uuid4()
    update_payload = {"year": 999} # Invalid year

    # Mock get - It won't be called because validation fails first
    mock_db_data_orig = create_mock_manifestation_data(id=manifestation_id)
    mock_get = AsyncMock(return_value=type('MockDBManifestation', (), mock_db_data_orig)()) 
    monkeypatch.setattr(manifestation_api.CRUDManifestation, "get", mock_get)
    
    # Mock update - should not be called due to validation error
    mock_update = AsyncMock()
    monkeypatch.setattr(manifestation_api.CRUDManifestation, "update", mock_update)

    response = await client.put(
        f"{BASE_URL}/{manifestation_id}?user_id={TEST_USER_ID}",
        json=update_payload
    )

    # Expect 422 Unprocessable Entity due to Pydantic validation failure
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY 
    # mock_get is not called because validation occurs before the endpoint code runs
    # mock_get.assert_awaited_once_with(id=manifestation_id, user_id=TEST_USER_ID)
    mock_get.assert_not_awaited() # Verify get was indeed not called
    mock_update.assert_not_awaited()
