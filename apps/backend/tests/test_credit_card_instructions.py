import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from fastapi import status
import os
from uuid import UUID, uuid4
from datetime import datetime, timezone
from typing import AsyncGenerator, Dict, Any, List
from unittest.mock import AsyncMock
import sys
from pathlib import Path

# --- Add project root to sys.path --- 
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
# -------------------------------------

# Import app and schemas
from app.main import app
from app.schemas.credit_card_instructions import (
    CreditCardInstructionsCreate,
    CreditCardInstructionsUpdate,
    CreditCardInstructionsResponse
)
# Import the specific API module to mock its CRUD operations
from app.api import credit_card_instructions as credit_card_instructions_api

# --- Test User ID --- 
TEST_USER_ID_STR = os.getenv("TEST_USER_ID")
if not TEST_USER_ID_STR:
    raise ValueError("TEST_USER_ID environment variable not set or empty")
try:
    TEST_USER_ID = UUID(TEST_USER_ID_STR)
except ValueError:
    raise ValueError(f"Invalid UUID format for TEST_USER_ID: {TEST_USER_ID_STR}")
# --------------------

BASE_URL = "/credit-card-instructions" # Matches the prefix in api_router.py

# --- Fixture for API Client --- 
@pytest_asyncio.fixture(scope="function")
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Provide a test client for making API requests to the app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

# --- Helper Function --- 
def create_mock_credit_card_instructions_data(id: UUID, user_id: UUID, overrides: Dict[str, Any] = None) -> Dict[str, Any]:
    """Creates mock data dictionary representing a CreditCardInstructions DB object."""
    base_data = {
        "id": id,
        "user_id": user_id,
        "card_name": "Mock Card",
        "payment_day": 15,
        "description": "Mock description",
        "instruction": "Mock instruction",
        "is_paid": False,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    if overrides:
        base_data.update(overrides)
    return base_data

# --- Test Cases --- 

@pytest.mark.asyncio
async def test_create_credit_card_instructions(client: AsyncClient, monkeypatch) -> None:
    """Test POST /credit-card-instructions/ for creating a credit card instruction record."""
    record_id = uuid4()
    post_data = {
        "user_id": str(TEST_USER_ID),
        "card_name": "Visa",
        "payment_day": 10,
        "description": "Monthly payment",
        "instruction": "Pay the full amount",
        "is_paid": False
    }

    mock_created_object = create_mock_credit_card_instructions_data(record_id, TEST_USER_ID, overrides=post_data)
    mock_create = AsyncMock(return_value=mock_created_object)
    monkeypatch.setattr(credit_card_instructions_api.CRUDCreditCardInstructions, "create", mock_create)

    response = await client.post(BASE_URL + "/", json=post_data)

    assert response.status_code == status.HTTP_201_CREATED, response.text
    response_data = response.json()
    assert response_data["id"] == str(record_id)
    assert response_data["card_name"] == "Visa"
    assert response_data["payment_day"] == 10
    assert response_data["description"] == "Monthly payment"
    assert response_data["instruction"] == "Pay the full amount"
    assert response_data["is_paid"] is False

    mock_create.assert_awaited_once()
    call_args, call_kwargs = mock_create.call_args
    assert isinstance(call_kwargs["obj_in"], CreditCardInstructionsCreate)
    assert call_kwargs["obj_in"].card_name == "Visa"

@pytest.mark.asyncio
async def test_get_credit_card_instructions(client: AsyncClient, monkeypatch) -> None:
    """Test GET /credit-card-instructions/{instruction_id}."""
    record_id = uuid4()
    mock_data_dict = create_mock_credit_card_instructions_data(id=record_id, user_id=TEST_USER_ID)
    mock_get_return = mock_data_dict

    mock_get = AsyncMock(return_value=mock_get_return)
    monkeypatch.setattr(credit_card_instructions_api.CRUDCreditCardInstructions, "get", mock_get)

    response = await client.get(f"{BASE_URL}/{record_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(record_id)
    assert response_data["card_name"] == mock_data_dict["card_name"]
    assert response_data["payment_day"] == mock_data_dict["payment_day"]
    assert response_data["description"] == mock_data_dict["description"]
    assert response_data["instruction"] == mock_data_dict["instruction"]
    assert response_data["is_paid"] == mock_data_dict["is_paid"]

    mock_get.assert_awaited_once_with(id=record_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_get_all_credit_card_instructions(client: AsyncClient, monkeypatch) -> None:
    """Test GET /credit-card-instructions/ for getting all instructions by user_id."""
    # Create mock records
    record_id1 = uuid4()
    record_id2 = uuid4()
    
    mock_data1 = create_mock_credit_card_instructions_data(
        id=record_id1, 
        user_id=TEST_USER_ID,
        overrides={"card_name": "Visa", "payment_day": 10}
    )
    
    mock_data2 = create_mock_credit_card_instructions_data(
        id=record_id2, 
        user_id=TEST_USER_ID,
        overrides={"card_name": "MasterCard", "payment_day": 15}
    )
    
    mock_return_list = [mock_data1, mock_data2]
    
    # Mock the get_multi_by_user method
    mock_get_multi = AsyncMock(return_value=mock_return_list)
    monkeypatch.setattr(credit_card_instructions_api.CRUDCreditCardInstructions, "get_multi_by_user", mock_get_multi)
    
    # Test without return_all parameter (default)
    response = await client.get(f"{BASE_URL}/?user_id={TEST_USER_ID}")
    
    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 2
    assert response_data[0]["id"] == str(record_id1)
    assert response_data[1]["id"] == str(record_id2)
    
    mock_get_multi.assert_awaited_once()
    call_args, call_kwargs = mock_get_multi.call_args
    assert call_kwargs["user_id"] == TEST_USER_ID
    assert call_kwargs.get("return_all", False) is False
    
    # Reset mock for next test
    mock_get_multi.reset_mock()
    
    # Test with return_all=True
    response = await client.get(f"{BASE_URL}/?user_id={TEST_USER_ID}&return_all=true")
    
    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 2
    
    mock_get_multi.assert_awaited_once()
    call_args, call_kwargs = mock_get_multi.call_args
    assert call_kwargs["user_id"] == TEST_USER_ID
    assert call_kwargs.get("return_all", False) is True

@pytest.mark.asyncio
async def test_update_credit_card_instructions(client: AsyncClient, monkeypatch) -> None:
    """Test PUT /credit-card-instructions/{instruction_id}."""
    record_id = uuid4()
    update_payload = {
        "card_name": "MasterCard",
        "payment_day": 20,
        "description": "Updated description",
        "instruction": "Pay minimum amount",
        "is_paid": True
    }

    # Mock initial state
    mock_initial_dict = create_mock_credit_card_instructions_data(id=record_id, user_id=TEST_USER_ID)
    mock_get_return = mock_initial_dict
    mock_get = AsyncMock(return_value=mock_get_return)
    monkeypatch.setattr(credit_card_instructions_api.CRUDCreditCardInstructions, "get", mock_get)

    # Mock state after update
    updated_attrs = mock_initial_dict.copy()
    updated_attrs.update(update_payload)
    updated_attrs["updated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    mock_update_return = updated_attrs

    mock_update = AsyncMock(return_value=mock_update_return)
    monkeypatch.setattr(credit_card_instructions_api.CRUDCreditCardInstructions, "update", mock_update)

    response = await client.put(
        f"{BASE_URL}/{record_id}?user_id={TEST_USER_ID}",
        json=update_payload
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(record_id)
    assert response_data["card_name"] == update_payload["card_name"]
    assert response_data["payment_day"] == update_payload["payment_day"]
    assert response_data["description"] == update_payload["description"]
    assert response_data["instruction"] == update_payload["instruction"]
    assert response_data["is_paid"] == update_payload["is_paid"]

    mock_get.assert_awaited_once_with(id=record_id, user_id=TEST_USER_ID)
    mock_update.assert_awaited_once()
    call_args, call_kwargs = mock_update.call_args
    assert call_kwargs["db_obj"] == mock_get_return
    assert isinstance(call_kwargs["obj_in"], CreditCardInstructionsUpdate)
    assert call_kwargs["obj_in"].card_name == update_payload["card_name"]

@pytest.mark.asyncio
async def test_delete_credit_card_instructions(client: AsyncClient, monkeypatch) -> None:
    """Test DELETE /credit-card-instructions/{instruction_id}."""
    record_id = uuid4()

    mock_data_dict = create_mock_credit_card_instructions_data(id=record_id, user_id=TEST_USER_ID)
    mock_get_return = mock_data_dict
    mock_get = AsyncMock(return_value=mock_get_return)
    monkeypatch.setattr(credit_card_instructions_api.CRUDCreditCardInstructions, "get", mock_get)

    mock_remove = AsyncMock(return_value=mock_get_return) # remove returns the deleted obj
    monkeypatch.setattr(credit_card_instructions_api.CRUDCreditCardInstructions, "remove", mock_remove)

    response = await client.delete(f"{BASE_URL}/{record_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_204_NO_CONTENT
    mock_get.assert_awaited_once_with(id=record_id, user_id=TEST_USER_ID)
    mock_remove.assert_awaited_once_with(id=record_id, user_id=TEST_USER_ID)
