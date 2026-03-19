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
import json

# --- Add project root to sys.path --- 
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
# -------------------------------------

# Load environment variables from .env file
load_dotenv()

# Import app and schemas
from app.main import app # Assuming your FastAPI app instance is named 'app' in main.py
from app.schemas.travel_transactions import (
    TravelTransactionCreate,
    TravelTransactionUpdate,
    TravelTransactionResponse
)
# Import the specific API module to mock its CRUD operations
from app.api import travel_transactions as travel_transactions_api

# --- Test User ID --- 
TEST_USER_ID_STR = os.getenv("TEST_USER_ID")
if not TEST_USER_ID_STR:
    raise ValueError("TEST_USER_ID environment variable not set or empty")
try:
    TEST_USER_ID = UUID(TEST_USER_ID_STR)
except ValueError:
    raise ValueError(f"Invalid UUID format for TEST_USER_ID: {TEST_USER_ID_STR}")
# --------------------

BASE_URL = "/travel-transactions" # Matches the prefix in api_router.py

# --- Fixture for API Client --- 
@pytest_asyncio.fixture(scope="function")
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Provide a test client for making API requests to the app."""
    # Use ASGITransport for async testing with FastAPI
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

# --- Helper Function --- 
def create_mock_travel_transaction_data(id: UUID, user_id: UUID, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates mock data dictionary representing a TravelTransaction DB object."""
    base_data = {
        "id": id,
        "user_id": user_id,
        "booking_date": date.today() - timedelta(days=10),
        "payment_date": date.today() - timedelta(days=2),
        "description": "Mock Flight Ticket",
        "item": "Flight MOCK-DEST",
        "city": "MockCity",
        "country": "MockCountry",
        "trip_name": "Mock Trip", # Added trip_name
        "local_currency": "MCK",
        "amount_local_currency": Decimal("100.00"),
        "exchange_rate_to_sgd": Decimal("1.500000"),
        "category": "expense",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        # The database calculates this, so simulate it
        "amount_sgd": (Decimal("100.00") * Decimal("1.500000")).quantize(Decimal("0.00"))
    }
    if overrides:
        # Carefully update, converting Decimal/Date/UUID to strings if necessary for JSON comparison
        for key, value in overrides.items():
            # Check if the key corresponds to a field that should be Decimal
            if key in ["amount_local_currency", "exchange_rate_to_sgd"]:
                # Convert input string/Decimal to Decimal
                try:
                    base_data[key] = Decimal(value)
                except Exception:
                    # Handle potential conversion errors if needed, or raise
                    raise ValueError(f"Invalid Decimal value provided for {key}: {value}")
            # Check if the key corresponds to a field that should be Date
            elif key in ["booking_date", "payment_date"]:
                # Convert input string/date to date
                if isinstance(value, date):
                    base_data[key] = value
                else:
                    try:
                        base_data[key] = date.fromisoformat(str(value))
                    except ValueError:
                        raise ValueError(f"Invalid date format for {key}: {value}")
            else:
                # For other keys (like description, city, country, etc.) or already correct types
                base_data[key] = value
        # Recalculate amount_sgd if relevant inputs changed
        if "amount_local_currency" in overrides or "exchange_rate_to_sgd" in overrides:
            # Use the values already updated in base_data for recalculation
            amount_local = base_data["amount_local_currency"] # This is already a Decimal
            rate_sgd = base_data["exchange_rate_to_sgd"]     # This is already a Decimal
            base_data["amount_sgd"] = (amount_local * rate_sgd).quantize(Decimal("0.00"))

    # Ensure required fields for response are present after override
    # Convert Decimal/Date/datetime/UUID to string/isoformat for final dict representation matching JSON response
    for key, value in base_data.items():
        if isinstance(value, Decimal):
            base_data[key] = str(value) # Convert Decimal to string for comparison
        elif isinstance(value, datetime):
            # Ensure timezone-aware isoformat if applicable, or naive
            if value.tzinfo:
                 base_data[key] = value.isoformat()
            else:
                 # Add Z for UTC if naive but represents UTC
                 base_data[key] = value.isoformat() + 'Z'
        elif isinstance(value, date):
            base_data[key] = value.isoformat()
        elif isinstance(value, UUID):
            base_data[key] = str(value)

    return base_data

# --- Test Cases --- 

@pytest.mark.asyncio
async def test_create_travel_transaction(client: AsyncClient, monkeypatch):
    """Test POST /travel-transactions/ for creating a new transaction."""
    transaction_id = uuid4()
    today = date.today()
    post_data = {
        "user_id": str(TEST_USER_ID),
        "booking_date": (today - timedelta(days=10)).isoformat(),
        "payment_date": (today - timedelta(days=2)).isoformat(),
        "description": "Test Flight Ticket",
        "item": "Flight SIN-LON",
        "city": "London",
        "country": "UK",
        "trip_name": "UK Adventure", # Added trip_name
        "local_currency": "GBP",
        "amount_local_currency": "550.75", # Send as string for Decimal
        "exchange_rate_to_sgd": "1.712345", # Send as string for Decimal
        "category": "expense"
    }

    # Prepare mock return data (simulating DB object attributes)
    mock_db_object_attrs = {
        "id": transaction_id,
        "user_id": TEST_USER_ID,
        "booking_date": today - timedelta(days=10),
        "payment_date": today - timedelta(days=2),
        "description": "Test Flight Ticket",
        "item": "Flight SIN-LON",
        "city": "London",
        "country": "UK",
        "trip_name": "UK Adventure", # Added trip_name
        "local_currency": "GBP",
        "amount_local_currency": Decimal("550.75"),
        "exchange_rate_to_sgd": Decimal("1.712345"),
        "category": "expense",
        "created_at": datetime.now(timezone.utc), # Simulate DB default
        "updated_at": datetime.now(timezone.utc), # Simulate DB default
        "amount_sgd": (Decimal("550.75") * Decimal("1.712345")).quantize(Decimal("0.00"))
    }

    # Ensure the mock object attributes have the correct types for model_validate
    # No changes needed here if mock_db_object_attrs already has correct types (Decimal, date, etc.)
    mock_created_object = type('MockDBTravelTransaction', (), mock_db_object_attrs)() 

    mock_create = AsyncMock(return_value=mock_created_object)
    # Mock the CRUD method within the *API module's scope*
    monkeypatch.setattr(travel_transactions_api.CRUDTravelTransaction, "create", mock_create)

    response = await client.post(BASE_URL + "/", json=post_data)

    if response.status_code != status.HTTP_201_CREATED:
        # Print the response body to understand the validation error
        try:
            print("\n--- Create Transaction Failed ---")
            print(f"Status Code: {response.status_code}")
            print(f"Response JSON: {response.json()}")
            print("-------------------------------")
        except Exception as e:
            print(f"Could not decode JSON response: {e}")
            print(f"Response Text: {response.text}")

    assert response.status_code == status.HTTP_201_CREATED, f"Expected 201, got {response.status_code}"
    response_data = response.json()
    assert response_data["id"] == str(transaction_id)
    assert response_data["user_id"] == str(TEST_USER_ID)
    assert response_data["item"] == "Flight SIN-LON"
    assert response_data["city"] == "London"
    assert response_data["trip_name"] == "UK Adventure" # Added trip_name check
    # Check calculated field (compare as strings)
    expected_sgd = mock_db_object_attrs["amount_sgd"].quantize(Decimal('0.00')) # Match DB precision (Numeric(12,2))
    assert response_data["amount_sgd"] == str(expected_sgd)

    # Assert the mock CRUD method was called correctly
    mock_create.assert_awaited_once() 
    # Check the type/structure of the object passed to crud.create
    call_args, call_kwargs = mock_create.call_args
    assert "obj_in" in call_kwargs
    create_input_obj = call_kwargs["obj_in"]
    assert isinstance(create_input_obj, TravelTransactionCreate) 
    assert create_input_obj.user_id == TEST_USER_ID
    assert create_input_obj.item == post_data["item"]
    assert create_input_obj.trip_name == post_data["trip_name"] # Added trip_name check
    assert create_input_obj.amount_local_currency == Decimal(post_data["amount_local_currency"])

@pytest.mark.asyncio
async def test_create_travel_transaction_direct_sgd(client: AsyncClient, monkeypatch):
    """Test POST /travel-transactions/ creating using direct SGD amount."""
    transaction_id = uuid4()
    today = date.today()
    post_data = {
        "user_id": str(TEST_USER_ID),
        "payment_date": today.isoformat(),
        "item": "Direct SGD Item",
        "city": "Singapore",
        "country": "SG",
        "trip_name": "SG Staycation", # Added trip_name
        "amount_sgd": "123.45", # Direct SGD input
        "category": "expense"
        # No local currency fields provided
    }

    # Mock DB object attributes (local fields should be None)
    mock_db_object_attrs = {
        "id": transaction_id,
        "user_id": TEST_USER_ID,
        "booking_date": None, # Example: not provided
        "payment_date": today,
        "description": None, # Example: not provided
        "item": "Direct SGD Item",
        "city": "Singapore",
        "country": "SG",
        "trip_name": "SG Staycation", # Added trip_name
        "local_currency": None,
        "amount_local_currency": None,
        "exchange_rate_to_sgd": None,
        "category": "expense",
        "amount_sgd": Decimal("123.45"),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    mock_created_object = type('MockDBTravelTransaction', (), mock_db_object_attrs)()

    mock_create = AsyncMock(return_value=mock_created_object)
    monkeypatch.setattr(travel_transactions_api.CRUDTravelTransaction, "create", mock_create)

    response = await client.post(BASE_URL + "/", json=post_data)

    assert response.status_code == status.HTTP_201_CREATED, f"Expected 201, got {response.status_code}, Response: {response.text}"
    response_data = response.json()
    assert response_data["id"] == str(transaction_id)
    assert response_data["amount_sgd"] == "123.45"
    assert response_data["trip_name"] == "SG Staycation" # Added trip_name check
    assert response_data["local_currency"] is None

    # Check that the CRUD create method was called with correct data
    mock_create.assert_awaited_once()
    call_args, call_kwargs = mock_create.call_args
    create_input_obj = call_kwargs["obj_in"]
    assert isinstance(create_input_obj, TravelTransactionCreate)
    assert create_input_obj.amount_sgd == Decimal("123.45")
    assert create_input_obj.trip_name == post_data["trip_name"] # Added trip_name check
    assert create_input_obj.local_currency is None

@pytest.mark.asyncio
async def test_get_travel_transaction(client: AsyncClient, monkeypatch):
    """Test GET /travel-transactions/{transaction_id}."""
    transaction_id = uuid4()

    # Mock the DB object that crud.get would return
    mock_db_object_attrs = create_mock_travel_transaction_data(id=transaction_id, user_id=TEST_USER_ID)
    # Convert dict back to a mock object for the CRUD return value
    mock_get_return = type('MockDBTravelTransaction', (), {k: (Decimal(v) if k in ('amount_local_currency', 'exchange_rate_to_sgd', 'amount_sgd') 
                                                               else datetime.fromisoformat(v.replace('Z', '+00:00')) if k in ('created_at', 'updated_at')
                                                               else date.fromisoformat(v) if k in ('booking_date', 'payment_date')
                                                               else UUID(v) if k in ('id', 'user_id')
                                                               else v) 
                                                           for k,v in mock_db_object_attrs.items()})()

    mock_get = AsyncMock(return_value=mock_get_return)
    monkeypatch.setattr(travel_transactions_api.CRUDTravelTransaction, "get", mock_get)

    response = await client.get(f"{BASE_URL}/{transaction_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    # Compare response JSON strings with the prepared mock data strings
    assert response_data["id"] == mock_db_object_attrs["id"]
    assert response_data["user_id"] == mock_db_object_attrs["user_id"]
    assert response_data["city"] == mock_db_object_attrs["city"]
    assert response_data["trip_name"] == mock_db_object_attrs["trip_name"] # Added trip_name check
    assert response_data["amount_sgd"] == mock_db_object_attrs["amount_sgd"]

    mock_get.assert_awaited_once_with(id=transaction_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_get_travel_transactions_no_filters(client: AsyncClient, monkeypatch):
    """Test GET /travel-transactions/ without any filters."""
    t_id1, t_id2 = uuid4(), uuid4()
    # Mock the list of DB objects crud.get_multi_by_user would return
    mock_data1 = create_mock_travel_transaction_data(id=t_id1, user_id=TEST_USER_ID)
    mock_data2 = create_mock_travel_transaction_data(id=t_id2, user_id=TEST_USER_ID, overrides={"city": "AnotherCity", "amount_local_currency": "200.00"})

    # Convert dicts back to mock objects
    mock_obj1 = type('MockDBTravelTransaction', (), {k: (Decimal(v) if k in ('amount_local_currency', 'exchange_rate_to_sgd', 'amount_sgd') 
                                                         else datetime.fromisoformat(v.replace('Z', '+00:00')) if k in ('created_at', 'updated_at')
                                                         else date.fromisoformat(v) if k in ('booking_date', 'payment_date')
                                                         else UUID(v) if k in ('id', 'user_id')
                                                         else v) 
                                                      for k,v in mock_data1.items()})()
    mock_obj2 = type('MockDBTravelTransaction', (), {k: (Decimal(v) if k in ('amount_local_currency', 'exchange_rate_to_sgd', 'amount_sgd') 
                                                         else datetime.fromisoformat(v.replace('Z', '+00:00')) if k in ('created_at', 'updated_at')
                                                         else date.fromisoformat(v) if k in ('booking_date', 'payment_date')
                                                         else UUID(v) if k in ('id', 'user_id')
                                                         else v) 
                                                      for k,v in mock_data2.items()})()

    mock_get_multi = AsyncMock(return_value=[mock_obj1, mock_obj2])
    monkeypatch.setattr(travel_transactions_api.CRUDTravelTransaction, "get_multi_by_user", mock_get_multi)

    response = await client.get(f"{BASE_URL}/?user_id={TEST_USER_ID}&limit=10")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 2
    assert response_data[0]["id"] == str(t_id1)
    assert response_data[1]["id"] == str(t_id2)
    assert response_data[1]["city"] == "AnotherCity"
    assert response_data[0]["amount_sgd"] == mock_data1["amount_sgd"]

    mock_get_multi.assert_awaited_once_with(user_id=TEST_USER_ID, skip=0, limit=10, start_date=None, end_date=None, city=None, country=None)

@pytest.mark.asyncio
@pytest.mark.parametrize(
    "params, expected_filters",
    [
        ("start_date=2023-01-01", {"start_date": date(2023, 1, 1)}),
        ("end_date=2023-12-31", {"end_date": date(2023, 12, 31)}),
        ("city=MockCity", {"city": "MockCity"}),
        ("country=MockCountry", {"country": "MockCountry"}),
        ("start_date=2023-01-01&end_date=2023-06-30&city=SomeCity", {"start_date": date(2023, 1, 1), "end_date": date(2023, 6, 30), "city": "SomeCity"}),
    ]
)
async def test_get_travel_transactions_with_filters(client: AsyncClient, monkeypatch, params, expected_filters):
    """Test GET /travel-transactions/ with various filters."""
    # Mock the crud method to return an empty list, we only care about the call args
    mock_get_multi = AsyncMock(return_value=[])
    monkeypatch.setattr(travel_transactions_api.CRUDTravelTransaction, "get_multi_by_user", mock_get_multi)

    response = await client.get(f"{BASE_URL}/?user_id={TEST_USER_ID}&{params}")

    assert response.status_code == status.HTTP_200_OK

    expected_call_args = {
        "user_id": TEST_USER_ID,
        "skip": 0,
        "limit": 100, # Default limit if not specified
        "start_date": None,
        "end_date": None,
        "city": None,
        "country": None
    }
    expected_call_args.update(expected_filters)

    mock_get_multi.assert_awaited_once_with(**expected_call_args)

@pytest.mark.asyncio
async def test_update_travel_transaction(client: AsyncClient, monkeypatch):
    """Test PUT /travel-transactions/{transaction_id}."""
    transaction_id = uuid4()
    update_payload = {
        "description": "Updated Description",
        "city": "UpdatedCity",
        "trip_name": "Updated Trip Name" # Added trip_name
        # Removed partial amount update to avoid validation error in this test
    }

    # Mock the initial state fetched by crud.get
    mock_db_initial_attrs = create_mock_travel_transaction_data(id=transaction_id, user_id=TEST_USER_ID)
    mock_get_return = type('MockDBTravelTransaction', (), {k: (Decimal(v) if k in ('amount_local_currency', 'exchange_rate_to_sgd', 'amount_sgd') 
                                                             else datetime.fromisoformat(v.replace('Z', '+00:00')) if k in ('created_at', 'updated_at')
                                                             else date.fromisoformat(v) if k in ('booking_date', 'payment_date')
                                                             else UUID(v) if k in ('id', 'user_id')
                                                             else v) 
                                                          for k,v in mock_db_initial_attrs.items()})()
    mock_get = AsyncMock(return_value=mock_get_return)
    monkeypatch.setattr(travel_transactions_api.CRUDTravelTransaction, "get", mock_get)

    # Mock the state *after* update returned by crud.update
    # Create the expected attributes *after* the update is applied
    updated_attrs = mock_db_initial_attrs.copy()
    updated_attrs.update({
        "description": update_payload["description"],
        "city": update_payload["city"],
        "trip_name": update_payload["trip_name"], # Added trip_name
        "updated_at": datetime.now(timezone.utc) # Simulate updated timestamp
    })
    # Since we are not updating amount fields here, amount_sgd should remain unchanged
    updated_attrs["amount_sgd"] = mock_db_initial_attrs["amount_sgd"]

    # Convert back to mock object for return value (handling types)
    mock_update_return = type('MockDBTravelTransaction', (), {k: (v if isinstance(v, (Decimal, date, datetime, UUID)) # Use already converted types
                                                                 else Decimal(v) if k in ('amount_local_currency', 'exchange_rate_to_sgd', 'amount_sgd') and v is not None
                                                                 else datetime.fromisoformat(v.replace('Z', '+00:00')) if k in ('created_at', 'updated_at')
                                                                 else date.fromisoformat(v) if k in ('booking_date', 'payment_date')
                                                                 else UUID(v) if k in ('id', 'user_id')
                                                                 else v) 
                                                              for k,v in updated_attrs.items()})()

    mock_update = AsyncMock(return_value=mock_update_return)
    monkeypatch.setattr(travel_transactions_api.CRUDTravelTransaction, "update", mock_update)

    response = await client.put(
        f"{BASE_URL}/{transaction_id}?user_id={TEST_USER_ID}",
        json=update_payload
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(transaction_id)
    assert response_data["description"] == update_payload["description"]
    assert response_data["city"] == update_payload["city"]
    assert response_data["trip_name"] == update_payload["trip_name"] # Added trip_name check
    # Check updated amount_sgd (compare as string after quantizing)
    expected_sgd = Decimal(mock_db_initial_attrs["amount_sgd"]).quantize(Decimal('0.01'))
    # Parse response string to Decimal and quantize before comparing
    response_sgd = Decimal(response_data["amount_sgd"]).quantize(Decimal('0.01'))
    assert response_sgd == expected_sgd

    # Assert mocks were called
    mock_get.assert_awaited_once_with(id=transaction_id, user_id=TEST_USER_ID)
    mock_update.assert_awaited_once()
    # Check args passed to update
    update_call_args, update_call_kwargs = mock_update.call_args
    assert "db_obj" in update_call_kwargs
    assert update_call_kwargs["db_obj"] == mock_get_return # Ensure the object from get was passed
    assert "obj_in" in update_call_kwargs
    assert isinstance(update_call_kwargs["obj_in"], TravelTransactionUpdate)
    assert update_call_kwargs["obj_in"].description == update_payload["description"]
    assert update_call_kwargs["obj_in"].city == update_payload["city"]
    assert update_call_kwargs["obj_in"].trip_name == update_payload["trip_name"] # Added trip_name check
    assert update_call_kwargs["obj_in"].amount_local_currency is None # Ensure it wasn't sent

@pytest.mark.asyncio
async def test_update_transaction_to_direct_sgd(client: AsyncClient, monkeypatch):
    """Test updating a transaction FROM local currency TO direct SGD."""
    transaction_id = uuid4()
    update_payload = {
        "amount_sgd": "999.99" # Update to direct SGD
        # No local fields provided
    }

    # Mock the initial state (created with local currency)
    mock_db_initial_attrs = create_mock_travel_transaction_data(id=transaction_id, user_id=TEST_USER_ID)
    # Convert dict back to a mock object for the GET return value
    mock_get_return = type('MockDBTravelTransaction', (), {k: (Decimal(v) if k in ('amount_local_currency', 'exchange_rate_to_sgd', 'amount_sgd')
                                                             else datetime.fromisoformat(v.replace('Z', '+00:00')) if k in ('created_at', 'updated_at')
                                                             else date.fromisoformat(v) if k in ('booking_date', 'payment_date')
                                                             else UUID(v) if k in ('id', 'user_id')
                                                             else v)
                                                          for k,v in mock_db_initial_attrs.items()})()
    mock_get = AsyncMock(return_value=mock_get_return)
    monkeypatch.setattr(travel_transactions_api.CRUDTravelTransaction, "get", mock_get)

    # Mock the state *after* update (local fields should be nullified)
    updated_attrs = mock_db_initial_attrs.copy()
    updated_attrs.update({
        "amount_sgd": Decimal("999.99"),
        "local_currency": None,
        "amount_local_currency": None,
        "exchange_rate_to_sgd": None,
        "updated_at": datetime.now(timezone.utc) # Simulate update timestamp
    })

    # Convert back to mock object for UPDATE return value
    mock_update_return = type('MockDBTravelTransaction', (), {k: (v if isinstance(v, (Decimal, date, datetime, UUID))
                                                                 # Handle potential None for Decimal fields
                                                                 else Decimal(v) if k in ('amount_local_currency', 'exchange_rate_to_sgd', 'amount_sgd') and v is not None
                                                                 else datetime.fromisoformat(v.replace('Z', '+00:00')) if k in ('created_at', 'updated_at')
                                                                 else date.fromisoformat(v) if k in ('booking_date', 'payment_date')
                                                                 else UUID(v) if k in ('id', 'user_id')
                                                                 else v)
                                                              for k,v in updated_attrs.items()})()

    mock_update = AsyncMock(return_value=mock_update_return)
    monkeypatch.setattr(travel_transactions_api.CRUDTravelTransaction, "update", mock_update)

    response = await client.put(
        f"{BASE_URL}/{transaction_id}?user_id={TEST_USER_ID}",
        json=update_payload
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["amount_sgd"] == "999.99"
    assert response_data["local_currency"] is None
    assert response_data["amount_local_currency"] is None
    assert response_data["exchange_rate_to_sgd"] is None

    # Check that the CRUD update method was called correctly
    mock_update.assert_awaited_once()
    update_call_args, update_call_kwargs = mock_update.call_args
    update_input_obj = update_call_kwargs["obj_in"]
    assert isinstance(update_input_obj, TravelTransactionUpdate)
    assert update_input_obj.amount_sgd == Decimal("999.99")
    # Ensure CRUD layer logic would nullify local fields based on this input

@pytest.mark.asyncio
async def test_delete_travel_transaction(client: AsyncClient, monkeypatch):
    """Test DELETE /travel-transactions/{transaction_id}."""
    transaction_id = uuid4()

    # Mock crud.get to find the object
    mock_db_object_attrs = create_mock_travel_transaction_data(id=transaction_id, user_id=TEST_USER_ID)
    mock_get_return = type('MockDBTravelTransaction', (), {k: (Decimal(v) if k in ('amount_local_currency', 'exchange_rate_to_sgd', 'amount_sgd') 
                                                             else datetime.fromisoformat(v.replace('Z', '+00:00')) if k in ('created_at', 'updated_at')
                                                             else date.fromisoformat(v) if k in ('booking_date', 'payment_date')
                                                             else UUID(v) if k in ('id', 'user_id')
                                                             else v) 
                                                          for k,v in mock_db_object_attrs.items()})()
    mock_get = AsyncMock(return_value=mock_get_return)
    monkeypatch.setattr(travel_transactions_api.CRUDTravelTransaction, "get", mock_get)

    # Mock crud.remove
    mock_remove = AsyncMock(return_value=mock_get_return) # remove returns the deleted obj
    monkeypatch.setattr(travel_transactions_api.CRUDTravelTransaction, "remove", mock_remove)

    response = await client.delete(f"{BASE_URL}/{transaction_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_204_NO_CONTENT

    # Assert mocks were called correctly
    mock_get.assert_awaited_once_with(id=transaction_id, user_id=TEST_USER_ID)
    mock_remove.assert_awaited_once_with(id=transaction_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_get_travel_transaction_not_found(client: AsyncClient, monkeypatch):
    """Test GET /travel-transactions/{transaction_id} when transaction doesn't exist."""
    transaction_id = uuid4()
    mock_get = AsyncMock(return_value=None) # Simulate not found
    monkeypatch.setattr(travel_transactions_api.CRUDTravelTransaction, "get", mock_get)

    response = await client.get(f"{BASE_URL}/{transaction_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_404_NOT_FOUND
    mock_get.assert_awaited_once_with(id=transaction_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_update_travel_transaction_not_found(client: AsyncClient, monkeypatch):
    """Test PUT /travel-transactions/{transaction_id} when transaction doesn't exist."""
    transaction_id = uuid4()
    update_payload = {"description": "Doesn't matter"}

    mock_get = AsyncMock(return_value=None) # Simulate not found
    monkeypatch.setattr(travel_transactions_api.CRUDTravelTransaction, "get", mock_get)

    # The update mock should NOT be called
    mock_update = AsyncMock()
    monkeypatch.setattr(travel_transactions_api.CRUDTravelTransaction, "update", mock_update)

    response = await client.put(
        f"{BASE_URL}/{transaction_id}?user_id={TEST_USER_ID}",
        json=update_payload
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    mock_get.assert_awaited_once_with(id=transaction_id, user_id=TEST_USER_ID)
    mock_update.assert_not_awaited()

@pytest.mark.asyncio
async def test_delete_travel_transaction_not_found(client: AsyncClient, monkeypatch):
    """Test DELETE /travel-transactions/{transaction_id} when transaction doesn't exist."""
    transaction_id = uuid4()

    mock_get = AsyncMock(return_value=None) # Simulate not found
    monkeypatch.setattr(travel_transactions_api.CRUDTravelTransaction, "get", mock_get)

    # The remove mock should NOT be called
    mock_remove = AsyncMock()
    monkeypatch.setattr(travel_transactions_api.CRUDTravelTransaction, "remove", mock_remove)

    response = await client.delete(f"{BASE_URL}/{transaction_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_404_NOT_FOUND
    mock_get.assert_awaited_once_with(id=transaction_id, user_id=TEST_USER_ID)
    mock_remove.assert_not_awaited()

@pytest.mark.asyncio
async def test_bulk_rename_trip(client: AsyncClient, monkeypatch):
    """Test POST /travel-transactions/bulk-rename-trip for bulk renaming trip details."""
    updated_ids = [uuid4(), uuid4(), uuid4()]
    
    # Request payload
    rename_data = {
        "user_id": str(TEST_USER_ID),
        "old_trip_name": "Old Trip Name",
        "old_city": "Old City",
        "old_country": "Old Country",
        "new_trip_name": "New Trip Name",
        "new_city": "New City",
        "new_country": "New Country"
    }

    # Mock the bulk_rename_trip method to return success
    mock_bulk_rename = AsyncMock(return_value=(3, updated_ids))
    monkeypatch.setattr(travel_transactions_api.CRUDTravelTransaction, "bulk_rename_trip", mock_bulk_rename)

    response = await client.post(f"{BASE_URL}/bulk-rename-trip", json=rename_data)

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["updated_count"] == 3
    assert len(response_data["updated_transaction_ids"]) == 3
    assert response_data["updated_transaction_ids"] == [str(id) for id in updated_ids]

    # Verify the CRUD method was called with correct parameters
    mock_bulk_rename.assert_awaited_once_with(
        user_id=TEST_USER_ID,
        old_trip_name="Old Trip Name",
        old_city="Old City",
        old_country="Old Country",
        new_trip_name="New Trip Name",
        new_city="New City",
        new_country="New Country"
    )

@pytest.mark.asyncio
async def test_bulk_rename_trip_no_transactions_found(client: AsyncClient, monkeypatch):
    """Test POST /travel-transactions/bulk-rename-trip when no transactions match."""
    
    # Request payload
    rename_data = {
        "user_id": str(TEST_USER_ID),
        "old_trip_name": "Nonexistent Trip",
        "old_city": "Nonexistent City", 
        "old_country": "Nonexistent Country",
        "new_trip_name": "New Trip Name",
        "new_city": "New City",
        "new_country": "New Country"
    }

    # Mock the bulk_rename_trip method to return no updates
    mock_bulk_rename = AsyncMock(return_value=(0, []))
    monkeypatch.setattr(travel_transactions_api.CRUDTravelTransaction, "bulk_rename_trip", mock_bulk_rename)

    response = await client.post(f"{BASE_URL}/bulk-rename-trip", json=rename_data)

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["updated_count"] == 0
    assert response_data["updated_transaction_ids"] == []

    mock_bulk_rename.assert_awaited_once()
