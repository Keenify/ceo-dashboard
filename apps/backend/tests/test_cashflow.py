import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from fastapi import status
import os
import sys
from pathlib import Path
from uuid import UUID, uuid4
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
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
from app.main import app # Your FastAPI app instance
from app.schemas.cashflow import (
    CashflowCreate,
    CashflowUpdate,
    CashflowResponse,
    FlowType
)
# Import the specific API module to mock its CRUD operations
from app.api import cashflow as cashflow_api

# --- Test User ID --- 
TEST_USER_ID_STR = os.getenv("TEST_USER_ID")
if not TEST_USER_ID_STR:
    raise ValueError("TEST_USER_ID environment variable not set or empty")
try:
    TEST_USER_ID = UUID(TEST_USER_ID_STR)
except ValueError:
    raise ValueError(f"Invalid UUID format for TEST_USER_ID: {TEST_USER_ID_STR}")
# --------------------

BASE_URL = "/cashflows" # Matches the prefix in api_router.py

# --- Fixture for API Client --- 
@pytest_asyncio.fixture(scope="function")
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Provide a test client for making API requests to the app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

# --- Helper Function --- 
def create_mock_cashflow_data(id: UUID, user_id: UUID, flow_type: FlowType, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates mock data dictionary representing a Cashflow DB object."""
    base_data = {
        "id": id,
        "user_id": user_id,
        "flow_type": flow_type,
        "amount": Decimal("100.00") if flow_type == 'inflow' else Decimal("50.00"),
        "description": f"Mock {flow_type} description",
        "flow_date": date.today() - timedelta(days=1),
        "category": "MockCategory",
        "background_color_code": None,
        "font_color_code": None,
        "note": f"Mock note for {flow_type}",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    if overrides:
        # Update base_data carefully, converting types if necessary for Decimal/Date
        for key, value in overrides.items():
            if key == "amount" and value is not None:
                base_data[key] = Decimal(value)
            elif key == "flow_date" and value is not None:
                 if isinstance(value, date):
                     base_data[key] = value
                 else:
                     try:
                        base_data[key] = date.fromisoformat(str(value))
                     except ValueError:
                         raise ValueError(f"Invalid date format for {key}: {value}")
            else:
                 base_data[key] = value

    # Convert types for final JSON-like dict representation
    for key, value in base_data.items():
        if isinstance(value, Decimal):
            base_data[key] = str(value)
        elif isinstance(value, datetime):
            base_data[key] = value.isoformat().replace("+00:00", "Z") # Ensure Z for UTC
        elif isinstance(value, date):
            base_data[key] = value.isoformat()
        elif isinstance(value, UUID):
            base_data[key] = str(value)

    return base_data

# --- Utility to convert mock data dict back to mock object --- 
def dict_to_mock_object(data: Dict[str, Any], class_name: str = 'MockDBCashflow') -> Any:
    "Converts a dictionary (potentially with stringified types) back to a mock object with correct types." 
    typed_data = {}
    for k, v in data.items():
        if v is None:
            typed_data[k] = None
            continue
        # Attempt type conversions based on key names or expected types
        if k in ('id', 'user_id'):
            typed_data[k] = UUID(v)
        elif k == 'amount':
            typed_data[k] = Decimal(v)
        elif k == 'flow_date':
            typed_data[k] = date.fromisoformat(v)
        elif k in ('created_at', 'updated_at'):
             # Handle potential 'Z' suffix
            iso_str = v.replace('Z', '+00:00')
            typed_data[k] = datetime.fromisoformat(iso_str)
        else:
            typed_data[k] = v # flow_type, description, category are likely strings
    return type(class_name, (), typed_data)()


# --- Test Cases --- 

@pytest.mark.asyncio
async def test_create_cashflow_inflow(client: AsyncClient, monkeypatch) -> None:
    """Test POST /cashflows/ for creating an inflow record."""
    record_id = uuid4()
    today = date.today()
    post_data = {
        "user_id": str(TEST_USER_ID),
        "flow_type": "inflow",
        "amount": "5000.00",
        "description": "Salary Deposit",
        "flow_date": (today - timedelta(days=5)).isoformat(),
        "category": "Income",
        "background_color_code": "#AABBCC",
        "font_color_code": "#112233",
        "note": "Initial salary note"
    }

    mock_db_object_attrs = {
        "id": record_id,
        "user_id": TEST_USER_ID,
        "flow_type": "inflow",
        "amount": Decimal("5000.00"),
        "description": "Salary Deposit",
        "flow_date": today - timedelta(days=5),
        "category": "Income",
        "background_color_code": "#AABBCC",
        "font_color_code": "#112233",
        "note": "Initial salary note",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    mock_created_object = dict_to_mock_object(create_mock_cashflow_data(record_id, TEST_USER_ID, 'inflow', overrides=post_data))

    mock_create = AsyncMock(return_value=mock_created_object)
    monkeypatch.setattr(cashflow_api.CRUDCashflow, "create", mock_create)

    response = await client.post(BASE_URL + "/", json=post_data)

    assert response.status_code == status.HTTP_201_CREATED, response.text
    response_data = response.json()
    assert response_data["id"] == str(record_id)
    assert response_data["flow_type"] == "inflow"
    assert response_data["amount"] == "5000.00"
    assert response_data["description"] == "Salary Deposit"
    assert response_data["background_color_code"] == "#AABBCC"
    assert response_data["font_color_code"] == "#112233"
    assert response_data["note"] == "Initial salary note"

    mock_create.assert_awaited_once()
    call_args, call_kwargs = mock_create.call_args
    assert isinstance(call_kwargs["obj_in"], CashflowCreate)
    assert call_kwargs["obj_in"].amount == Decimal("5000.00")

@pytest.mark.asyncio
async def test_create_cashflow_outflow(client: AsyncClient, monkeypatch) -> None:
    """Test POST /cashflows/ for creating an outflow record."""
    record_id = uuid4()
    today = date.today()
    post_data = {
        "user_id": str(TEST_USER_ID),
        "flow_type": "outflow",
        "amount": "120.50",
        "description": "Utility Bill",
        "flow_date": (today - timedelta(days=2)).isoformat(),
        "category": "Expenses",
        "note": "Electricity bill note"
    }
    mock_created_object = dict_to_mock_object(create_mock_cashflow_data(record_id, TEST_USER_ID, 'outflow', overrides=post_data))

    mock_create = AsyncMock(return_value=mock_created_object)
    monkeypatch.setattr(cashflow_api.CRUDCashflow, "create", mock_create)

    response = await client.post(BASE_URL + "/", json=post_data)

    assert response.status_code == status.HTTP_201_CREATED, response.text
    response_data = response.json()
    assert response_data["id"] == str(record_id)
    assert response_data["flow_type"] == "outflow"
    assert response_data["amount"] == "120.50"
    assert response_data["background_color_code"] is None
    assert response_data["font_color_code"] is None
    assert response_data["note"] == "Electricity bill note"

    mock_create.assert_awaited_once()
    call_args, call_kwargs = mock_create.call_args
    assert isinstance(call_kwargs["obj_in"], CashflowCreate)
    assert call_kwargs["obj_in"].flow_type == "outflow"

@pytest.mark.asyncio
async def test_get_cashflow(client: AsyncClient, monkeypatch) -> None:
    """Test GET /cashflows/{cashflow_id}."""
    record_id = uuid4()
    mock_data_dict = create_mock_cashflow_data(id=record_id, user_id=TEST_USER_ID, flow_type='inflow')
    mock_get_return = dict_to_mock_object(mock_data_dict)

    mock_get = AsyncMock(return_value=mock_get_return)
    monkeypatch.setattr(cashflow_api.CRUDCashflow, "get", mock_get)

    response = await client.get(f"{BASE_URL}/{record_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(record_id)
    assert response_data["flow_type"] == mock_data_dict["flow_type"]
    assert response_data["amount"] == mock_data_dict["amount"]
    assert response_data["background_color_code"] == mock_data_dict["background_color_code"]
    assert response_data["font_color_code"] == mock_data_dict["font_color_code"]
    assert response_data["note"] == mock_data_dict["note"]

    mock_get.assert_awaited_once_with(id=record_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_get_cashflows_paginated(client: AsyncClient, monkeypatch) -> None:
    """Test GET /cashflows/ without filters, using pagination."""
    id1, id2 = uuid4(), uuid4()
    mock_data1 = create_mock_cashflow_data(id=id1, user_id=TEST_USER_ID, flow_type='inflow', overrides={"flow_date": date.today() - timedelta(days=2)})
    mock_data2 = create_mock_cashflow_data(id=id2, user_id=TEST_USER_ID, flow_type='outflow', overrides={"flow_date": date.today() - timedelta(days=1)})
    mock_obj1 = dict_to_mock_object(mock_data1)
    mock_obj2 = dict_to_mock_object(mock_data2)

    # Simulate ordering: most recent date first (outflow)
    mock_get_multi = AsyncMock(return_value=[mock_obj2, mock_obj1])
    monkeypatch.setattr(cashflow_api.CRUDCashflow, "get_multi_by_user", mock_get_multi)

    response = await client.get(f"{BASE_URL}/?user_id={TEST_USER_ID}&skip=0&limit=10")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 2
    assert response_data[0]["id"] == str(id2) # Outflow first due to date
    assert response_data[1]["id"] == str(id1)

    mock_get_multi.assert_awaited_once_with(user_id=TEST_USER_ID, skip=0, limit=10, flow_type=None, return_all=False)

@pytest.mark.asyncio
@pytest.mark.parametrize(
    "query_params, expected_crud_params",
    [
        ("flow_type=inflow", {"flow_type": "inflow", "return_all": False}),
        ("flow_type=outflow", {"flow_type": "outflow", "return_all": False}),
        ("return_all=true", {"flow_type": None, "return_all": True}),
        ("flow_type=inflow&return_all=true", {"flow_type": "inflow", "return_all": True}),
        ("limit=5", {"flow_type": None, "return_all": False, "limit": 5}), # Expect limit=5 to be passed to CRUD
    ]
)
async def test_get_cashflows_with_filters(client: AsyncClient, monkeypatch, query_params, expected_crud_params) -> None:
    """Test GET /cashflows/ with flow_type and return_all filters."""
    mock_get_multi = AsyncMock(return_value=[]) # Return empty list, just check call args
    monkeypatch.setattr(cashflow_api.CRUDCashflow, "get_multi_by_user", mock_get_multi)

    response = await client.get(f"{BASE_URL}/?user_id={TEST_USER_ID}&{query_params}")

    assert response.status_code == status.HTTP_200_OK

    # Base expected args, will be updated by expected_crud_params
    expected_call_args = {
        "user_id": TEST_USER_ID,
        "skip": 0, # Default if not specified
        "limit": 100, # Default if not specified
        "flow_type": None,
        "return_all": False
    }
    # Update with the specific params for this test case
    expected_call_args.update(expected_crud_params)

    mock_get_multi.assert_awaited_once_with(**expected_call_args)

@pytest.mark.asyncio
async def test_update_cashflow(client: AsyncClient, monkeypatch) -> None:
    """Test PUT /cashflows/{cashflow_id}."""
    record_id = uuid4()
    update_payload = {
        "description": "Updated Salary Deposit",
        "category": "Salary - Bonus",
        "background_color_code": "#FF0000",
        "font_color_code": None,
        "note": "Updated note for bonus"
    }

    # Mock initial state (inflow)
    mock_initial_dict_overrides = {
        "background_color_code": "#00FF00", 
        "font_color_code": "#0000FF", 
        "note": "Original note"
    }
    mock_initial_dict = create_mock_cashflow_data(
        id=record_id, 
        user_id=TEST_USER_ID, 
        flow_type='inflow', 
        overrides=mock_initial_dict_overrides
    )
    mock_get_return = dict_to_mock_object(mock_initial_dict)
    mock_get = AsyncMock(return_value=mock_get_return)
    monkeypatch.setattr(cashflow_api.CRUDCashflow, "get", mock_get)

    # Mock state after update
    updated_attrs = mock_initial_dict.copy()
    updated_attrs.update(update_payload)
    updated_attrs["updated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z") # Simulate update
    mock_update_return = dict_to_mock_object(updated_attrs)

    mock_update = AsyncMock(return_value=mock_update_return)
    monkeypatch.setattr(cashflow_api.CRUDCashflow, "update", mock_update)

    response = await client.put(
        f"{BASE_URL}/{record_id}?user_id={TEST_USER_ID}",
        json=update_payload
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(record_id)
    assert response_data["description"] == update_payload["description"]
    assert response_data["category"] == update_payload["category"]
    assert response_data["amount"] == mock_initial_dict["amount"] # Should be unchanged
    assert response_data["background_color_code"] == "#FF0000"
    assert response_data["font_color_code"] is None

    mock_get.assert_awaited_once_with(id=record_id, user_id=TEST_USER_ID)
    mock_update.assert_awaited_once()
    call_args, call_kwargs = mock_update.call_args
    assert call_kwargs["db_obj"] == mock_get_return
    assert isinstance(call_kwargs["obj_in"], CashflowUpdate)
    assert call_kwargs["obj_in"].description == update_payload["description"]

@pytest.mark.asyncio
async def test_delete_cashflow(client: AsyncClient, monkeypatch) -> None:
    """Test DELETE /cashflows/{cashflow_id}."""
    record_id = uuid4()

    mock_data_dict = create_mock_cashflow_data(id=record_id, user_id=TEST_USER_ID, flow_type='outflow')
    mock_get_return = dict_to_mock_object(mock_data_dict)
    mock_get = AsyncMock(return_value=mock_get_return)
    monkeypatch.setattr(cashflow_api.CRUDCashflow, "get", mock_get)

    mock_remove = AsyncMock(return_value=mock_get_return) # remove returns the deleted obj
    monkeypatch.setattr(cashflow_api.CRUDCashflow, "remove", mock_remove)

    response = await client.delete(f"{BASE_URL}/{record_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_204_NO_CONTENT
    mock_get.assert_awaited_once_with(id=record_id, user_id=TEST_USER_ID)
    mock_remove.assert_awaited_once_with(id=record_id, user_id=TEST_USER_ID)

# --- Test Not Found Cases --- 

@pytest.mark.asyncio
async def test_get_cashflow_not_found(client: AsyncClient, monkeypatch) -> None:
    """Test GET /cashflows/{cashflow_id} when record doesn't exist."""
    record_id = uuid4()
    mock_get = AsyncMock(return_value=None)
    monkeypatch.setattr(cashflow_api.CRUDCashflow, "get", mock_get)

    response = await client.get(f"{BASE_URL}/{record_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_404_NOT_FOUND
    mock_get.assert_awaited_once_with(id=record_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_update_cashflow_not_found(client: AsyncClient, monkeypatch) -> None:
    """Test PUT /cashflows/{cashflow_id} when record doesn't exist."""
    record_id = uuid4()
    update_payload = {"description": "Does not matter"}
    mock_get = AsyncMock(return_value=None)
    monkeypatch.setattr(cashflow_api.CRUDCashflow, "get", mock_get)
    mock_update = AsyncMock()
    monkeypatch.setattr(cashflow_api.CRUDCashflow, "update", mock_update)

    response = await client.put(f"{BASE_URL}/{record_id}?user_id={TEST_USER_ID}", json=update_payload)

    assert response.status_code == status.HTTP_404_NOT_FOUND
    mock_get.assert_awaited_once_with(id=record_id, user_id=TEST_USER_ID)
    mock_update.assert_not_awaited()

@pytest.mark.asyncio
async def test_delete_cashflow_not_found(client: AsyncClient, monkeypatch) -> None:
    """Test DELETE /cashflows/{cashflow_id} when record doesn't exist."""
    record_id = uuid4()
    mock_get = AsyncMock(return_value=None)
    monkeypatch.setattr(cashflow_api.CRUDCashflow, "get", mock_get)
    mock_remove = AsyncMock()
    monkeypatch.setattr(cashflow_api.CRUDCashflow, "remove", mock_remove)

    response = await client.delete(f"{BASE_URL}/{record_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_404_NOT_FOUND
    mock_get.assert_awaited_once_with(id=record_id, user_id=TEST_USER_ID)
    mock_remove.assert_not_awaited()
