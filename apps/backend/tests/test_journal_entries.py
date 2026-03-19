import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from fastapi import status
import os
import sys
from pathlib import Path
from uuid import UUID
from datetime import date, datetime, timezone
from dotenv import load_dotenv
from typing import AsyncGenerator, List, Optional, Dict, Any, AsyncIterator, cast
from unittest.mock import AsyncMock # Import AsyncMock
import json # Add this import at the top

# --- Add project root to sys.path --- 
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
# -------------------------------------

# Load environment variables from .env file
load_dotenv()

# Import app and schemas
from app.main import app
from app.schemas.journal_entries import JournalEntry, JournalEntryUpsert
# Import the module containing the class to patch
from app.api import journal_entries as journal_entries_api

# --- Test User ID --- 
TEST_USER_ID_STR = os.getenv("TEST_USER_ID")
if not TEST_USER_ID_STR:
    raise ValueError("TEST_USER_ID environment variable not set or empty")
try:
    TEST_USER_ID = UUID(TEST_USER_ID_STR)
except ValueError:
     raise ValueError(f"Invalid UUID format for TEST_USER_ID: {TEST_USER_ID_STR}")
# --------------------

BASE_URL = "/journal-entries"

# --- Fixture for API Client (No DB interaction) --- 

# Suppress the specific Pylance error
# pyright: reportInvalidTypeForm=false
@pytest_asyncio.fixture(scope="function")
async def client():  # Completely remove return type annotation
    """Provide a test client for making API requests to the app."""
    # No database setup or dependency override needed here
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

# --- Helper to create mock data (mimics DB model attributes) --- 
def create_mock_db_object_data(id: int, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates a dictionary mimicking attributes of a DB model object."""
    base_data = {
        "id": id,
        "user_id": TEST_USER_ID, # Keep as UUID
        "question_id": 1,
        "entry_date": date.today(), # Keep as date
        "answer": f"Mock answer {id}",
        "created_at": datetime.now(timezone.utc) # Keep as datetime
    }
    if overrides:
        base_data.update(overrides)
    return base_data

# Helper for debugging dictionaries
def print_dict_structure(name, obj):
    """Pretty-print a dict or list to debug its structure"""
    print(f"\n--- {name} ---")
    if isinstance(obj, (dict, list)):
        print(json.dumps(obj, indent=2, default=str))
    else:
        print(f"Type: {type(obj)}")
        print(str(obj))
    print("-------------------\n")

# --- Helper to create mock response data (matches JournalEntry schema) ---
def create_mock_response_data(id: int, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates a dictionary matching the JournalEntry response schema."""
    db_data = create_mock_db_object_data(id, overrides)
    # Convert types to match JSON serializable format in the schema
    db_data['user_id'] = str(db_data['user_id'])
    # Handle entry_date: Check if it's already a string before formatting
    if isinstance(db_data.get('entry_date'), date):
        db_data['entry_date'] = db_data['entry_date'].isoformat()
    # Handle created_at: Convert to string, ignore minor diffs in tests
    if isinstance(db_data.get('created_at'), datetime):
        dt_obj = db_data['created_at']
        if dt_obj.tzinfo is None:
             dt_obj = dt_obj.replace(tzinfo=timezone.utc)
        db_data['created_at'] = dt_obj.isoformat()
    # Print the result before returning
    print_dict_structure(f"create_mock_response_data(id={id})", db_data)
    return db_data

# --- Test Cases with Mocking --- 

@pytest.mark.asyncio
async def test_upsert_journal_entry_create(client: AsyncClient, monkeypatch):
    """Test POST /journal-entries/ (upsert) for creating a new entry."""
    test_date = date.today()
    upsert_payload = {
        "user_id": str(TEST_USER_ID),
        "question_id": 1,
        "entry_date": test_date.isoformat(),
        "answer": "API upsert create test."
    }
    # Define mock return data (mimics DB model object)
    mock_db_object_data = create_mock_db_object_data(id=123, overrides=upsert_payload)

    # Mock the CRUDJournalEntry.upsert method
    mock_upsert = AsyncMock(return_value=type('MockDBEntry', (), mock_db_object_data)())
    monkeypatch.setattr(journal_entries_api.CRUDJournalEntry, "upsert", mock_upsert)

    response = await client.post(BASE_URL + "/", json=upsert_payload)

    # Expect 200 OK as per the current API endpoint definition for upsert
    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    # Use .get() method with default values for all dictionary access
    assert response_data.get("id") == 123
    assert response_data.get("user_id") == upsert_payload.get("user_id")
    assert response_data.get("question_id") == upsert_payload.get("question_id")
    assert response_data.get("entry_date") == upsert_payload.get("entry_date")
    assert response_data.get("answer") == upsert_payload.get("answer")
    assert "created_at" in response_data
    mock_upsert.assert_awaited_once()
    # Verify the input payload was passed correctly to the mock
    # Access the arguments the mock was called with
    call_args, call_kwargs = mock_upsert.call_args
    assert call_kwargs.get('entry_in').user_id == TEST_USER_ID
    assert call_kwargs.get('entry_in').question_id == upsert_payload["question_id"]
    assert call_kwargs.get('entry_in').entry_date.isoformat() == upsert_payload["entry_date"]
    assert call_kwargs.get('entry_in').answer == upsert_payload["answer"]

@pytest.mark.asyncio
async def test_upsert_journal_entry_update(client: AsyncClient, monkeypatch):
    """Test POST /journal-entries/ (upsert) for updating an existing entry's answer."""
    test_date = date.today()
    existing_entry_id = 456 # Assume this entry exists
    question_id_to_update = 1 # Specify the question ID being updated
    upsert_payload = {
        "user_id": str(TEST_USER_ID),
        "question_id": question_id_to_update, # Keep the same question ID
        "entry_date": test_date.isoformat(),
        "answer": "API upsert updated answer." # Update the answer
    }
    # Mock return data should reflect the update but keep the original ID and question_id
    mock_db_object_data = create_mock_db_object_data(
        id=existing_entry_id,
        overrides={
            "user_id": TEST_USER_ID, # Ensure UUID type for mock object
            "question_id": question_id_to_update,
            "entry_date": test_date, # Ensure date type for mock object
            "answer": upsert_payload["answer"],
        }
    )


    # Mock the CRUDJournalEntry.upsert method
    mock_upsert = AsyncMock(return_value=type('MockDBEntry', (), mock_db_object_data)())
    monkeypatch.setattr(journal_entries_api.CRUDJournalEntry, "upsert", mock_upsert)

    response = await client.post(BASE_URL + "/", json=upsert_payload)

    # Expect 200 OK
    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data.get("id") == existing_entry_id # ID should match existing
    assert response_data.get("user_id") == upsert_payload.get("user_id")
    assert response_data.get("question_id") == upsert_payload.get("question_id") # Question ID shouldn't change
    assert response_data.get("entry_date") == upsert_payload.get("entry_date")
    assert response_data.get("answer") == upsert_payload.get("answer") # Check updated answer
    assert "created_at" in response_data
    mock_upsert.assert_awaited_once()
     # Verify the input payload was passed correctly to the mock
    call_args, call_kwargs = mock_upsert.call_args
    entry_in_arg = call_kwargs.get('entry_in')
    assert isinstance(entry_in_arg, JournalEntryUpsert) # Ensure it's the correct schema type
    assert entry_in_arg.user_id == TEST_USER_ID
    assert entry_in_arg.question_id == upsert_payload["question_id"]
    # Compare dates directly if entry_date is a date object, otherwise compare ISO formats
    assert entry_in_arg.entry_date == test_date
    assert entry_in_arg.answer == upsert_payload["answer"]

@pytest.mark.asyncio
async def test_read_journal_entry(client: AsyncClient, monkeypatch):
    """Test GET /journal-entries/{entry_id} by mocking crud.get."""
    entry_id = 456
    mock_db_object_data = create_mock_db_object_data(id=entry_id)
    mock_get = AsyncMock(return_value=type('MockDBEntry', (), mock_db_object_data)())
    monkeypatch.setattr(journal_entries_api.CRUDJournalEntry, "get", mock_get)

    response = await client.get(f"{BASE_URL}/{entry_id}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    expected_response_data = create_mock_response_data(id=entry_id)
    # Use .get() method for all dictionary access
    assert response_data.get("id") == expected_response_data.get("id")
    assert response_data.get("user_id") == expected_response_data.get("user_id")
    assert response_data.get("question_id") == expected_response_data.get("question_id")
    assert response_data.get("entry_date") == expected_response_data.get("entry_date")
    assert response_data.get("answer") == expected_response_data.get("answer")
    assert "created_at" in response_data
    mock_get.assert_awaited_once()

@pytest.mark.asyncio
async def test_read_journal_entry_not_found(client: AsyncClient, monkeypatch):
    """Test GET /journal-entries/{entry_id} for a 404 by mocking crud.get to return None."""
    entry_id = 999
    mock_get = AsyncMock(return_value=None)
    monkeypatch.setattr(journal_entries_api.CRUDJournalEntry, "get", mock_get)
    response = await client.get(f"{BASE_URL}/{entry_id}")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    mock_get.assert_awaited_once()

@pytest.mark.asyncio
async def test_read_journal_entries_by_user(client: AsyncClient, monkeypatch):
    """Test GET /journal-entries/user/{user_id} by mocking crud.get_multi_by_user."""
    mock_db_list = [
        type('MockDBEntry', (), create_mock_db_object_data(id=1))(),
        type('MockDBEntry', (), create_mock_db_object_data(id=2, overrides={"question_id": 5}))()
    ]
    mock_get_multi = AsyncMock(return_value=mock_db_list)
    # Patch the class method within the API module's scope
    monkeypatch.setattr(journal_entries_api.CRUDJournalEntry, "get_multi_by_user", mock_get_multi) # Corrected target


    response = await client.get(f"{BASE_URL}/user/{TEST_USER_ID}?limit=10")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    print_dict_structure("RESPONSE DATA (GET MULTI)", response_data)

    expected_response_list = [
        create_mock_response_data(id=1),
        create_mock_response_data(id=2, overrides={"question_id": 5})
    ]
    print_dict_structure("EXPECTED DATA (GET MULTI)", expected_response_list)

    assert isinstance(response_data, list)
    # Compare lengths and key fields of list items (excluding created_at)
    assert len(response_data) == len(expected_response_list)

    # Dump the first item if available for debugging
    if len(response_data) > 0:
        print_dict_structure("First response item (GET MULTI)", response_data[0])
    if len(expected_response_list) > 0:
        print_dict_structure("First expected item (GET MULTI)", expected_response_list[0])

    for i in range(len(response_data)):
        try:
            # Use .get() method for all access
            assert response_data[i].get("id") == expected_response_list[i].get("id")
            assert response_data[i].get("user_id") == expected_response_list[i].get("user_id")
            assert response_data[i].get("question_id") == expected_response_list[i].get("question_id")
            assert response_data[i].get("entry_date") == expected_response_list[i].get("entry_date")
            assert response_data[i].get("answer") == expected_response_list[i].get("answer")
            assert "created_at" in response_data[i]
        except AssertionError as e:
            # Print detailed debug info on assertion failure
            print(f"\n❌ ASSERTION FAILED at index {i} (GET MULTI):")
            print(f"Error: {e}")
            print(f"response_data[{i}] keys: {response_data[i].keys() if isinstance(response_data[i], dict) else 'NOT A DICT'}")
            print(f"expected_response_list[{i}] keys: {expected_response_list[i].keys() if isinstance(expected_response_list[i], dict) else 'NOT A DICT'}")
            # Re-raise to fail the test
            raise
    mock_get_multi.assert_awaited_once_with(user_id=TEST_USER_ID, skip=0, limit=10) # Add verification of arguments

@pytest.mark.asyncio
async def test_delete_journal_entry(client: AsyncClient, monkeypatch):
    """Test DELETE /journal-entries/{entry_id} by mocking crud.get and crud.remove."""
    entry_id = 101
    existing_db_data = create_mock_db_object_data(id=entry_id)
    # Mock the get method on the class within the API module's scope
    mock_get = AsyncMock(return_value=type('MockDBEntry', (), existing_db_data)())
    monkeypatch.setattr(journal_entries_api.CRUDJournalEntry, "get", mock_get) # Corrected target

    # Mock remove to return the object it was asked to delete
    mock_remove = AsyncMock(return_value=type('MockDBEntry', (), existing_db_data)())
    monkeypatch.setattr(journal_entries_api.CRUDJournalEntry, "remove", mock_remove) # Corrected target

    response = await client.delete(f"{BASE_URL}/{entry_id}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    expected_response_data = create_mock_response_data(id=entry_id)
    # Use .get() method for all dictionary access
    assert response_data.get("id") == expected_response_data.get("id")
    assert response_data.get("user_id") == expected_response_data.get("user_id")
    assert response_data.get("question_id") == expected_response_data.get("question_id")
    assert response_data.get("entry_date") == expected_response_data.get("entry_date")
    assert response_data.get("answer") == expected_response_data.get("answer")
    assert "created_at" in response_data
    mock_get.assert_awaited_once_with(id=entry_id) # Verify arguments
    mock_remove.assert_awaited_once_with(id=entry_id) # Verify arguments

@pytest.mark.asyncio
async def test_delete_journal_entry_not_found(client: AsyncClient, monkeypatch):
    """Test DELETE /journal-entries/{entry_id} for 404 by mocking crud.get to return None."""
    entry_id = 999
    # Mock the get method on the class within the API module's scope
    mock_get = AsyncMock(return_value=None)
    monkeypatch.setattr(journal_entries_api.CRUDJournalEntry, "get", mock_get) # Corrected target

    # Mock remove just in case, though it shouldn't be called
    mock_remove = AsyncMock()
    monkeypatch.setattr(journal_entries_api.CRUDJournalEntry, "remove", mock_remove) # Corrected target

    response = await client.delete(f"{BASE_URL}/{entry_id}")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    mock_get.assert_awaited_once_with(id=entry_id) # Verify arguments
    mock_remove.assert_not_awaited()

@pytest.mark.asyncio
async def test_create_entry_invalid_question_id_api_validation(client: AsyncClient):
    """Test creating an entry with an invalid question_id relies on FastAPI/Pydantic validation."""
    create_payload = {
        "user_id": str(TEST_USER_ID),
        "question_id": 99,
        "entry_date": date.today().isoformat(),
        "answer": "Invalid question ID API validation test."
    }
    response = await client.post(BASE_URL + "/", json=create_payload)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

@pytest.mark.asyncio
async def test_update_journal_entry(client: AsyncClient, monkeypatch):
    """Test PUT /journal-entries/{entry_id} by mocking crud.get and crud.update."""
