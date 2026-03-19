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
from app.schemas.ikigai import (
    IkigaiCreate,
    IkigaiUpdate,
    IkigaiResponse
)
from app.api import ikigai as ikigai_api

# --- Test User ID --- 
TEST_USER_ID_STR = os.getenv("TEST_USER_ID")
if not TEST_USER_ID_STR:
    raise ValueError("TEST_USER_ID environment variable not set or empty")
try:
    TEST_USER_ID = UUID(TEST_USER_ID_STR)
except ValueError:
    raise ValueError(f"Invalid UUID format for TEST_USER_ID: {TEST_USER_ID_STR}")
# --------------------

BASE_URL = "/ikigai"

# --- Fixture for API Client ---
@pytest_asyncio.fixture(scope="function")
async def client():
    """Provide a test client for making API requests to the app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

# --- Helper Functions ---
def create_mock_ikigai_data(id: UUID, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates mock DB data for ikigai."""
    base_data = {
        "id": id,
        "user_id": TEST_USER_ID,
        "ikigai_data": {
            "what_you_love": ["Reading", "Teaching", "Creating", "Helping others"],
            "what_you_are_good_at": ["Programming", "Problem solving", "Communication", "Leadership"],
            "what_the_world_needs": ["Better education", "Technology solutions", "Mentorship", "Innovation"],
            "what_you_can_be_paid_for": ["Software development", "Consulting", "Training", "Product management"],
            "passion": "Technology education",
            "mission": "Empowering others through technology",
            "profession": "Software engineering and teaching",
            "vocation": "Creating educational technology solutions",
            "ikigai": "Building technology that educates and empowers people"
        },
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    if overrides:
        base_data.update(overrides)
    return base_data

def create_ikigai_api_payload(overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates API payload for ikigai."""
    payload = {
        "user_id": str(TEST_USER_ID),
        "ikigai_data": {
            "what_you_love": ["API Reading", "API Teaching", "API Creating", "API Helping"],
            "what_you_are_good_at": ["API Programming", "API Problem solving", "API Communication", "API Leadership"],
            "what_the_world_needs": ["API Better education", "API Technology solutions", "API Mentorship", "API Innovation"],
            "what_you_can_be_paid_for": ["API Software development", "API Consulting", "API Training", "API Product management"],
            "passion": "API Technology education",
            "mission": "API Empowering others through technology",
            "profession": "API Software engineering and teaching",
            "vocation": "API Creating educational technology solutions",
            "ikigai": "API Building technology that educates and empowers people"
        }
    }
    if overrides:
        payload.update(overrides)
    return payload

def create_upsert_payload(overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates upsert payload (just the ikigai_data part)."""
    payload = {
        "what_you_love": ["Upsert Reading", "Upsert Teaching", "Upsert Creating", "Upsert Helping"],
        "what_you_are_good_at": ["Upsert Programming", "Upsert Problem solving", "Upsert Communication", "Upsert Leadership"],
        "what_the_world_needs": ["Upsert Better education", "Upsert Technology solutions", "Upsert Mentorship", "Upsert Innovation"],
        "what_you_can_be_paid_for": ["Upsert Software development", "Upsert Consulting", "Upsert Training", "Upsert Product management"],
        "passion": "Upsert Technology education",
        "mission": "Upsert Empowering others through technology",
        "profession": "Upsert Software engineering and teaching",
        "vocation": "Upsert Creating educational technology solutions",
        "ikigai": "Upsert Building technology that educates and empowers people"
    }
    if overrides:
        payload.update(overrides)
    return payload

# --- Test Cases ---

@pytest.mark.asyncio
async def test_create_ikigai(client: AsyncClient, monkeypatch):
    """Test POST /ikigai/ for creating a new ikigai."""
    ikigai_id = uuid4()
    create_payload = create_ikigai_api_payload()
    
    # Mock DB data reflects the create payload
    mock_db_data = create_mock_ikigai_data(id=ikigai_id, overrides={
        "ikigai_data": create_payload["ikigai_data"],
        "user_id": TEST_USER_ID
    })
    
    mock_create = AsyncMock(return_value=type('MockDBIkigai', (), mock_db_data)()) 
    monkeypatch.setattr(ikigai_api.CRUDIkigai, "create", mock_create)

    response = await client.post(BASE_URL + "/", json=create_payload)

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    assert response_data["id"] == str(ikigai_id)
    assert response_data["user_id"] == str(TEST_USER_ID)
    assert response_data["ikigai_data"] == create_payload["ikigai_data"]
    
    mock_create.assert_awaited_once()
    # Check the object passed to the mock create
    call_args = mock_create.call_args[1]['obj_in']
    assert isinstance(call_args, IkigaiCreate)
    assert call_args.ikigai_data == create_payload["ikigai_data"]

@pytest.mark.asyncio
async def test_get_ikigai_by_id(client: AsyncClient, monkeypatch):
    """Test GET /ikigai/{ikigai_id}."""
    ikigai_id = uuid4()
    mock_db_data = create_mock_ikigai_data(id=ikigai_id)
    mock_get = AsyncMock(return_value=type('MockDBIkigai', (), mock_db_data)()) 
    monkeypatch.setattr(ikigai_api.CRUDIkigai, "get", mock_get)

    response = await client.get(f"{BASE_URL}/{ikigai_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(ikigai_id)
    assert response_data["user_id"] == str(TEST_USER_ID)
    assert response_data["ikigai_data"] == mock_db_data["ikigai_data"]
    mock_get.assert_awaited_once_with(id=ikigai_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_get_ikigai_by_user(client: AsyncClient, monkeypatch):
    """Test GET /ikigai/user/{user_id}."""
    ikigai_id = uuid4()
    mock_db_data = create_mock_ikigai_data(id=ikigai_id)
    mock_get_by_user = AsyncMock(return_value=type('MockDBIkigai', (), mock_db_data)()) 
    monkeypatch.setattr(ikigai_api.CRUDIkigai, "get_by_user", mock_get_by_user)

    response = await client.get(f"{BASE_URL}/user/{TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(ikigai_id)
    assert response_data["user_id"] == str(TEST_USER_ID)
    assert response_data["ikigai_data"] == mock_db_data["ikigai_data"]
    mock_get_by_user.assert_awaited_once_with(user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_update_ikigai(client: AsyncClient, monkeypatch):
    """Test PUT /ikigai/{ikigai_id}."""
    ikigai_id = uuid4()
    update_payload = {
        "ikigai_data": {
            "what_you_love": ["Updated Reading", "Updated Teaching"],
            "what_you_are_good_at": ["Updated Programming", "Updated Problem solving"],
            "what_the_world_needs": ["Updated Better education", "Updated Technology solutions"],
            "what_you_can_be_paid_for": ["Updated Software development", "Updated Consulting"],
            "passion": "Updated Technology education",
            "mission": "Updated Empowering others through technology",
            "profession": "Updated Software engineering and teaching",
            "vocation": "Updated Creating educational technology solutions",
            "ikigai": "Updated Building technology that educates and empowers people"
        }
    }
    
    # Mock get for existing record
    mock_db_data_orig = create_mock_ikigai_data(id=ikigai_id)
    mock_get = AsyncMock(return_value=type('MockDBIkigai', (), mock_db_data_orig)()) 
    monkeypatch.setattr(ikigai_api.CRUDIkigai, "get", mock_get)
    
    # Mock update with updated data
    mock_db_data_updated = create_mock_ikigai_data(id=ikigai_id, overrides={
        "ikigai_data": update_payload["ikigai_data"]
    })
    mock_update = AsyncMock(return_value=type('MockDBIkigai', (), mock_db_data_updated)()) 
    monkeypatch.setattr(ikigai_api.CRUDIkigai, "update", mock_update)

    response = await client.put(
        f"{BASE_URL}/{ikigai_id}?user_id={TEST_USER_ID}",
        json=update_payload
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(ikigai_id)
    assert response_data["user_id"] == str(TEST_USER_ID)
    assert response_data["ikigai_data"] == update_payload["ikigai_data"]
    
    mock_get.assert_awaited_once_with(id=ikigai_id, user_id=TEST_USER_ID)
    mock_update.assert_awaited_once()
    # Check arguments passed to mock update
    update_call_args = mock_update.call_args[1]
    assert update_call_args['db_obj'].id == ikigai_id
    assert isinstance(update_call_args['obj_in'], IkigaiUpdate)
    assert update_call_args['obj_in'].ikigai_data == update_payload["ikigai_data"]

@pytest.mark.asyncio
async def test_delete_ikigai(client: AsyncClient, monkeypatch):
    """Test DELETE /ikigai/{ikigai_id}."""
    ikigai_id = uuid4()
    mock_db_data = create_mock_ikigai_data(id=ikigai_id)
    
    # Mock delete returning the deleted object
    mock_delete = AsyncMock(return_value=type('MockDBIkigai', (), mock_db_data)()) 
    monkeypatch.setattr(ikigai_api.CRUDIkigai, "delete", mock_delete)

    response = await client.delete(f"{BASE_URL}/{ikigai_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(ikigai_id)
    assert response_data["user_id"] == str(TEST_USER_ID)
    mock_delete.assert_awaited_once_with(id=ikigai_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_upsert_ikigai_create(client: AsyncClient, monkeypatch):
    """Test POST /ikigai/upsert/{user_id} for creating new ikigai."""
    ikigai_id = uuid4()
    upsert_payload = create_upsert_payload()
    
    # Mock DB data for created ikigai
    mock_db_data = create_mock_ikigai_data(id=ikigai_id, overrides={
        "ikigai_data": upsert_payload,
        "user_id": TEST_USER_ID
    })
    
    mock_upsert = AsyncMock(return_value=type('MockDBIkigai', (), mock_db_data)()) 
    monkeypatch.setattr(ikigai_api.CRUDIkigai, "upsert", mock_upsert)

    response = await client.post(f"{BASE_URL}/upsert/{TEST_USER_ID}", json=upsert_payload)

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(ikigai_id)
    assert response_data["user_id"] == str(TEST_USER_ID)
    assert response_data["ikigai_data"] == upsert_payload
    
    mock_upsert.assert_awaited_once_with(user_id=TEST_USER_ID, ikigai_data=upsert_payload)

@pytest.mark.asyncio
async def test_upsert_ikigai_update(client: AsyncClient, monkeypatch):
    """Test POST /ikigai/upsert/{user_id} for updating existing ikigai."""
    ikigai_id = uuid4()
    upsert_payload = create_upsert_payload(overrides={
        "ikigai": "Updated through upsert - Building technology that transforms the world"
    })
    
    # Mock DB data for updated ikigai
    mock_db_data = create_mock_ikigai_data(id=ikigai_id, overrides={
        "ikigai_data": upsert_payload,
        "user_id": TEST_USER_ID
    })
    
    mock_upsert = AsyncMock(return_value=type('MockDBIkigai', (), mock_db_data)()) 
    monkeypatch.setattr(ikigai_api.CRUDIkigai, "upsert", mock_upsert)

    response = await client.post(f"{BASE_URL}/upsert/{TEST_USER_ID}", json=upsert_payload)

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(ikigai_id)
    assert response_data["user_id"] == str(TEST_USER_ID)
    assert response_data["ikigai_data"] == upsert_payload
    assert response_data["ikigai_data"]["ikigai"] == "Updated through upsert - Building technology that transforms the world"
    
    mock_upsert.assert_awaited_once_with(user_id=TEST_USER_ID, ikigai_data=upsert_payload)

# --- Error Handling Tests ---

@pytest.mark.asyncio
async def test_get_ikigai_not_found(client: AsyncClient, monkeypatch):
    """Test GET /ikigai/{ikigai_id} when ikigai not found."""
    ikigai_id = uuid4()
    mock_get = AsyncMock(return_value=None) 
    monkeypatch.setattr(ikigai_api.CRUDIkigai, "get", mock_get)

    response = await client.get(f"{BASE_URL}/{ikigai_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert "Ikigai not found" in response.json()["detail"]
    mock_get.assert_awaited_once_with(id=ikigai_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_get_ikigai_by_user_not_found(client: AsyncClient, monkeypatch):
    """Test GET /ikigai/user/{user_id} when user has no ikigai."""
    mock_get_by_user = AsyncMock(return_value=None) 
    monkeypatch.setattr(ikigai_api.CRUDIkigai, "get_by_user", mock_get_by_user)

    response = await client.get(f"{BASE_URL}/user/{TEST_USER_ID}")

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert "Ikigai not found for this user" in response.json()["detail"]
    mock_get_by_user.assert_awaited_once_with(user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_update_ikigai_not_found(client: AsyncClient, monkeypatch):
    """Test PUT /ikigai/{ikigai_id} when ikigai not found."""
    ikigai_id = uuid4()
    update_payload = {"ikigai_data": {"ikigai": "Updated value"}}
    
    mock_get = AsyncMock(return_value=None) 
    monkeypatch.setattr(ikigai_api.CRUDIkigai, "get", mock_get)

    response = await client.put(
        f"{BASE_URL}/{ikigai_id}?user_id={TEST_USER_ID}",
        json=update_payload
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert "Ikigai not found" in response.json()["detail"]
    mock_get.assert_awaited_once_with(id=ikigai_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_delete_ikigai_not_found(client: AsyncClient, monkeypatch):
    """Test DELETE /ikigai/{ikigai_id} when ikigai not found."""
    ikigai_id = uuid4()
    
    mock_delete = AsyncMock(return_value=None) 
    monkeypatch.setattr(ikigai_api.CRUDIkigai, "delete", mock_delete)

    response = await client.delete(f"{BASE_URL}/{ikigai_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert "Ikigai not found" in response.json()["detail"]
    mock_delete.assert_awaited_once_with(id=ikigai_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_create_ikigai_invalid_data(client: AsyncClient):
    """Test POST /ikigai/ with invalid data structure."""
    invalid_payload = {
        "user_id": str(TEST_USER_ID),
        "ikigai_data": "invalid_string_instead_of_dict"
    }

    response = await client.post(BASE_URL + "/", json=invalid_payload)

    # Expect 422 Unprocessable Entity due to Pydantic validation failure
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

@pytest.mark.asyncio
async def test_create_ikigai_missing_user_id(client: AsyncClient):
    """Test POST /ikigai/ with missing user_id."""
    invalid_payload = {
        "ikigai_data": {
            "ikigai": "Missing user_id test"
        }
    }

    response = await client.post(BASE_URL + "/", json=invalid_payload)

    # Expect 422 Unprocessable Entity due to missing required field
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
