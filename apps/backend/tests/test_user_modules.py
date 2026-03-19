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
from app.schemas.user_modules import (
    UserModulesCreate,
    UserModulesUpdate,
    UserModulesResponse
)
from app.api import user_modules as user_modules_api

# --- Test User ID --- 
TEST_USER_ID_STR = os.getenv("TEST_USER_ID")
if not TEST_USER_ID_STR:
    raise ValueError("TEST_USER_ID environment variable not set or empty")
try:
    TEST_USER_ID = UUID(TEST_USER_ID_STR)
except ValueError:
    raise ValueError(f"Invalid UUID format for TEST_USER_ID: {TEST_USER_ID_STR}")
# --------------------

BASE_URL = "/user-modules"

# --- Fixture for API Client ---
@pytest_asyncio.fixture(scope="function")
async def client():
    """Provide a test client for making API requests to the app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

# --- Helper Functions ---
def create_mock_user_module_data(id: UUID, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates mock DB data for user_modules."""
    base_data = {
        "id": id,
        "user_id": TEST_USER_ID,
        "stripe_customer_id": "cus_test123456789",
        "stripe_subscription_item_id": "si_test123456789",
        "product_id": "prod_test123456789",
        "price_id": "price_test123456789",
        "status": "active",
        "start_date": datetime.now(timezone.utc),
        "end_date": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    if overrides:
        base_data.update(overrides)
    return base_data

def create_user_module_api_payload(overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates API payload for user_modules."""
    payload = {
        "user_id": str(TEST_USER_ID),
        "stripe_customer_id": "cus_api123456789",
        "stripe_subscription_item_id": "si_api123456789",
        "product_id": "prod_api123456789",
        "price_id": "price_api123456789",
        "status": "active",
        "start_date": "2024-01-01T00:00:00Z",
        "end_date": "2024-12-31T23:59:59Z"
    }
    if overrides:
        payload.update(overrides)
    return payload

# --- Test Cases ---

@pytest.mark.asyncio
async def test_create_user_module(client: AsyncClient, monkeypatch):
    """Test POST /user-modules/ for creating a new user module."""
    user_module_id = uuid4()
    create_payload = create_user_module_api_payload()
    
    # Mock DB data reflects the create payload
    mock_db_data = create_mock_user_module_data(id=user_module_id, overrides={
        "stripe_customer_id": create_payload["stripe_customer_id"],
        "stripe_subscription_item_id": create_payload["stripe_subscription_item_id"],
        "product_id": create_payload["product_id"],
        "price_id": create_payload["price_id"],
        "status": create_payload["status"],
        "user_id": TEST_USER_ID
    })
    
    mock_create = AsyncMock(return_value=type('MockDBUserModule', (), mock_db_data)()) 
    monkeypatch.setattr(user_modules_api.CRUDUserModules, "create", mock_create)

    response = await client.post(BASE_URL + "/", json=create_payload)

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    assert response_data["id"] == str(user_module_id)
    assert response_data["user_id"] == str(TEST_USER_ID)
    assert response_data["stripe_customer_id"] == create_payload["stripe_customer_id"]
    assert response_data["status"] == create_payload["status"]
    
    mock_create.assert_awaited_once()
    # Check the object passed to the mock create
    call_args = mock_create.call_args[1]['obj_in']
    assert isinstance(call_args, UserModulesCreate)
    assert call_args.stripe_customer_id == create_payload["stripe_customer_id"]

@pytest.mark.asyncio
async def test_get_user_module_by_id(client: AsyncClient, monkeypatch):
    """Test GET /user-modules/{user_module_id}."""
    user_module_id = uuid4()
    mock_db_data = create_mock_user_module_data(id=user_module_id)
    mock_get = AsyncMock(return_value=type('MockDBUserModule', (), mock_db_data)()) 
    monkeypatch.setattr(user_modules_api.CRUDUserModules, "get", mock_get)

    response = await client.get(f"{BASE_URL}/{user_module_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(user_module_id)
    assert response_data["user_id"] == str(TEST_USER_ID)
    assert response_data["stripe_customer_id"] == mock_db_data["stripe_customer_id"]
    mock_get.assert_awaited_once_with(id=user_module_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_get_user_modules_by_user(client: AsyncClient, monkeypatch):
    """Test GET /user-modules/user/{user_id}."""
    user_module_id1 = uuid4()
    user_module_id2 = uuid4()
    mock_db_data1 = create_mock_user_module_data(id=user_module_id1)
    mock_db_data2 = create_mock_user_module_data(id=user_module_id2, overrides={"status": "paused"})
    
    mock_get_by_user = AsyncMock(return_value=[
        type('MockDBUserModule', (), mock_db_data1)(),
        type('MockDBUserModule', (), mock_db_data2)()
    ]) 
    monkeypatch.setattr(user_modules_api.CRUDUserModules, "get_by_user", mock_get_by_user)

    response = await client.get(f"{BASE_URL}/user/{TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 2
    assert response_data[0]["id"] == str(user_module_id1)
    assert response_data[1]["id"] == str(user_module_id2)
    assert response_data[0]["status"] == "active"
    assert response_data[1]["status"] == "paused"
    mock_get_by_user.assert_awaited_once_with(user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_get_active_user_modules(client: AsyncClient, monkeypatch):
    """Test GET /user-modules/user/{user_id}/active."""
    user_module_id = uuid4()
    mock_db_data = create_mock_user_module_data(id=user_module_id)
    
    mock_get_active = AsyncMock(return_value=[type('MockDBUserModule', (), mock_db_data)()])
    monkeypatch.setattr(user_modules_api.CRUDUserModules, "get_active_subscriptions", mock_get_active)

    response = await client.get(f"{BASE_URL}/user/{TEST_USER_ID}/active")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 1
    assert response_data[0]["id"] == str(user_module_id)
    assert response_data[0]["status"] == "active"
    mock_get_active.assert_awaited_once_with(user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_get_user_modules_by_stripe_customer(client: AsyncClient, monkeypatch):
    """Test GET /user-modules/stripe/{stripe_customer_id}."""
    user_module_id = uuid4()
    stripe_customer_id = "cus_test123456789"
    mock_db_data = create_mock_user_module_data(id=user_module_id)
    
    mock_get_by_stripe = AsyncMock(return_value=[type('MockDBUserModule', (), mock_db_data)()])
    monkeypatch.setattr(user_modules_api.CRUDUserModules, "get_by_stripe_customer", mock_get_by_stripe)

    response = await client.get(f"{BASE_URL}/stripe/{stripe_customer_id}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 1
    assert response_data[0]["id"] == str(user_module_id)
    assert response_data[0]["stripe_customer_id"] == stripe_customer_id
    mock_get_by_stripe.assert_awaited_once_with(stripe_customer_id=stripe_customer_id)

@pytest.mark.asyncio
async def test_update_user_module(client: AsyncClient, monkeypatch):
    """Test PUT /user-modules/{user_module_id}."""
    user_module_id = uuid4()
    update_payload = {
        "status": "paused",
        "product_id": "prod_updated123456789"
    }
    
    # Mock get for existing record
    mock_db_data_orig = create_mock_user_module_data(id=user_module_id)
    mock_get = AsyncMock(return_value=type('MockDBUserModule', (), mock_db_data_orig)()) 
    monkeypatch.setattr(user_modules_api.CRUDUserModules, "get", mock_get)
    
    # Mock update with updated data
    mock_db_data_updated = create_mock_user_module_data(id=user_module_id, overrides={
        "status": update_payload["status"],
        "product_id": update_payload["product_id"]
    })
    mock_update = AsyncMock(return_value=type('MockDBUserModule', (), mock_db_data_updated)()) 
    monkeypatch.setattr(user_modules_api.CRUDUserModules, "update", mock_update)

    response = await client.put(
        f"{BASE_URL}/{user_module_id}?user_id={TEST_USER_ID}",
        json=update_payload
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(user_module_id)
    assert response_data["user_id"] == str(TEST_USER_ID)
    assert response_data["status"] == update_payload["status"]
    assert response_data["product_id"] == update_payload["product_id"]
    
    mock_get.assert_awaited_once_with(id=user_module_id, user_id=TEST_USER_ID)
    mock_update.assert_awaited_once()
    # Check arguments passed to mock update
    update_call_args = mock_update.call_args[1]
    assert update_call_args['db_obj'].id == user_module_id
    assert isinstance(update_call_args['obj_in'], UserModulesUpdate)

@pytest.mark.asyncio
async def test_update_user_module_status(client: AsyncClient, monkeypatch):
    """Test PATCH /user-modules/{user_module_id}/status."""
    user_module_id = uuid4()
    new_status = "cancelled"
    
    mock_db_data_updated = create_mock_user_module_data(id=user_module_id, overrides={
        "status": new_status
    })
    mock_update_status = AsyncMock(return_value=type('MockDBUserModule', (), mock_db_data_updated)())
    monkeypatch.setattr(user_modules_api.CRUDUserModules, "update_subscription_status", mock_update_status)

    response = await client.patch(
        f"{BASE_URL}/{user_module_id}/status?subscription_status={new_status}&user_id={TEST_USER_ID}"
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(user_module_id)
    assert response_data["status"] == new_status
    
    mock_update_status.assert_awaited_once_with(
        id=user_module_id,
        user_id=TEST_USER_ID,
        status=new_status
    )

@pytest.mark.asyncio
async def test_update_user_module_status_invalid(client: AsyncClient):
    """Test PATCH /user-modules/{user_module_id}/status with invalid status."""
    user_module_id = uuid4()
    invalid_status = "invalid_status"

    response = await client.patch(
        f"{BASE_URL}/{user_module_id}/status?subscription_status={invalid_status}&user_id={TEST_USER_ID}"
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "Status must be one of" in response.json()["detail"]

@pytest.mark.asyncio
async def test_delete_user_module(client: AsyncClient, monkeypatch):
    """Test DELETE /user-modules/{user_module_id}."""
    user_module_id = uuid4()
    mock_db_data = create_mock_user_module_data(id=user_module_id)
    
    # Mock delete returning the deleted object
    mock_delete = AsyncMock(return_value=type('MockDBUserModule', (), mock_db_data)()) 
    monkeypatch.setattr(user_modules_api.CRUDUserModules, "delete", mock_delete)

    response = await client.delete(f"{BASE_URL}/{user_module_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(user_module_id)
    assert response_data["user_id"] == str(TEST_USER_ID)
    mock_delete.assert_awaited_once_with(id=user_module_id, user_id=TEST_USER_ID)

# --- Error Handling Tests ---

@pytest.mark.asyncio
async def test_get_user_module_not_found(client: AsyncClient, monkeypatch):
    """Test GET /user-modules/{user_module_id} when user module not found."""
    user_module_id = uuid4()
    mock_get = AsyncMock(return_value=None) 
    monkeypatch.setattr(user_modules_api.CRUDUserModules, "get", mock_get)

    response = await client.get(f"{BASE_URL}/{user_module_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert "User module not found" in response.json()["detail"]
    mock_get.assert_awaited_once_with(id=user_module_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_update_user_module_not_found(client: AsyncClient, monkeypatch):
    """Test PUT /user-modules/{user_module_id} when user module not found."""
    user_module_id = uuid4()
    update_payload = {"status": "paused"}
    
    mock_get = AsyncMock(return_value=None) 
    monkeypatch.setattr(user_modules_api.CRUDUserModules, "get", mock_get)

    response = await client.put(
        f"{BASE_URL}/{user_module_id}?user_id={TEST_USER_ID}",
        json=update_payload
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert "User module not found" in response.json()["detail"]
    mock_get.assert_awaited_once_with(id=user_module_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_update_user_module_status_not_found(client: AsyncClient, monkeypatch):
    """Test PATCH /user-modules/{user_module_id}/status when user module not found."""
    user_module_id = uuid4()
    new_status = "cancelled"
    
    mock_update_status = AsyncMock(return_value=None)
    monkeypatch.setattr(user_modules_api.CRUDUserModules, "update_subscription_status", mock_update_status)

    response = await client.patch(
        f"{BASE_URL}/{user_module_id}/status?subscription_status={new_status}&user_id={TEST_USER_ID}"
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert "User module not found" in response.json()["detail"]
    mock_update_status.assert_awaited_once_with(
        id=user_module_id,
        user_id=TEST_USER_ID,
        status=new_status
    )

@pytest.mark.asyncio
async def test_delete_user_module_not_found(client: AsyncClient, monkeypatch):
    """Test DELETE /user-modules/{user_module_id} when user module not found."""
    user_module_id = uuid4()
    
    mock_delete = AsyncMock(return_value=None) 
    monkeypatch.setattr(user_modules_api.CRUDUserModules, "delete", mock_delete)

    response = await client.delete(f"{BASE_URL}/{user_module_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert "User module not found" in response.json()["detail"]
    mock_delete.assert_awaited_once_with(id=user_module_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_create_user_module_invalid_data(client: AsyncClient):
    """Test POST /user-modules/ with invalid data structure."""
    invalid_payload = {
        "user_id": str(TEST_USER_ID),
        "stripe_customer_id": "cus_test123456789",
        "stripe_subscription_item_id": "si_test123456789",
        "product_id": "prod_test123456789",
        "price_id": "price_test123456789",
        "status": "invalid_status",  # Invalid status
        "start_date": "invalid_date",  # Invalid date format
    }

    response = await client.post(BASE_URL + "/", json=invalid_payload)

    # Expect 422 Unprocessable Entity due to Pydantic validation failure
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

@pytest.mark.asyncio
async def test_create_user_module_missing_required_field(client: AsyncClient):
    """Test POST /user-modules/ with missing required field."""
    invalid_payload = {
        "user_id": str(TEST_USER_ID),
        "stripe_customer_id": "cus_test123456789",
        # Missing stripe_subscription_item_id
        "product_id": "prod_test123456789",
        "price_id": "price_test123456789",
        "status": "active",
        "start_date": "2024-01-01T00:00:00Z"
    }

    response = await client.post(BASE_URL + "/", json=invalid_payload)

    # Expect 422 Unprocessable Entity due to missing required field
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
