import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from fastapi import status, HTTPException
import os
import sys
from pathlib import Path
from uuid import UUID, uuid4
from datetime import datetime, timezone
from dotenv import load_dotenv
from typing import Dict, Any, Optional, List
from unittest.mock import AsyncMock, ANY
import json # For debugging output
from sqlalchemy.exc import IntegrityError # Import IntegrityError

# --- Add project root to sys.path --- 
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
# -------------------------------------

# Load environment variables
load_dotenv()

# Import app and specific modules to patch
from app.main import app
from app import schemas, models # Import top level
from app.api import todo_tabs as todo_tabs_api # Module containing the API routes

# --- Test User ID --- 
TEST_USER_ID_STR = os.getenv("TEST_USER_ID")
if not TEST_USER_ID_STR:
    raise ValueError("TEST_USER_ID environment variable not set or empty")
try:
    TEST_USER_ID = UUID(TEST_USER_ID_STR)
except ValueError:
     raise ValueError(f"Invalid UUID format for TEST_USER_ID: {TEST_USER_ID_STR}")
# --------------------

BASE_URL = "/todo-tabs" # API endpoint prefix

# --- Fixture for API Client --- 
@pytest_asyncio.fixture(scope="function")
async def client():
    """Provide a test client for making API requests to the app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

# --- Helper Functions for Mock Data --- 
def create_mock_db_object_data_tab(id: UUID, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates a dictionary mimicking attributes of a TodoTab DB model object."""
    base_data = {
        "id": id,
        "user_id": TEST_USER_ID,
        "name": f"Mock Tab {id}",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        # Add relationships if needed for complex mocks, e.g., todo_lists = []
    }
    if overrides:
        base_data.update(overrides)
    return base_data

def create_mock_response_data_tab(db_data: Dict[str, Any]) -> Dict[str, Any]:
    """Creates a dictionary matching the TodoTab response schema from mock DB data."""
    response_data = db_data.copy()
    # Convert types to match JSON serializable format
    response_data['id'] = str(response_data['id'])
    response_data['user_id'] = str(response_data['user_id'])
    if isinstance(response_data.get('created_at'), datetime):
        response_data['created_at'] = response_data['created_at'].isoformat()
    if isinstance(response_data.get('updated_at'), datetime):
        response_data['updated_at'] = response_data['updated_at'].isoformat()
    return response_data

# --- Test Cases --- 

@pytest.mark.asyncio
async def test_create_todo_tab(client: AsyncClient, monkeypatch):
    """Test POST /todo-tabs/"""
    tab_name = "Test Create Tab"
    create_payload = {"name": tab_name, "user_id": str(TEST_USER_ID)}
    mock_tab_id = uuid4()
    
    mock_db_data = create_mock_db_object_data_tab(id=mock_tab_id, overrides={"name": tab_name, "user_id": TEST_USER_ID})
    mock_create = AsyncMock(return_value=type('MockDBTab', (), mock_db_data)()) 
    monkeypatch.setattr(todo_tabs_api.CRUDTodoTab, "create", mock_create)

    response = await client.post(BASE_URL + "/", json=create_payload)

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    expected_response = create_mock_response_data_tab(mock_db_data)
    
    assert response_data.get("id") == expected_response.get("id")
    assert response_data.get("name") == expected_response.get("name")
    assert response_data.get("user_id") == str(TEST_USER_ID)
    assert "created_at" in response_data
    assert "updated_at" in response_data
    
    mock_create.assert_awaited_once()
    call_args, call_kwargs = mock_create.call_args
    assert isinstance(call_kwargs.get('obj_in'), schemas.todo_tabs.TodoTabCreate)
    assert call_kwargs.get('obj_in').name == tab_name
    assert call_kwargs.get('obj_in').user_id == TEST_USER_ID

@pytest.mark.asyncio
async def test_read_todo_tabs(client: AsyncClient, monkeypatch):
    """Test GET /todo-tabs/"""
    mock_tab_id_1 = uuid4()
    mock_tab_id_2 = uuid4()
    mock_db_list = [
        type('MockDBTab1', (), create_mock_db_object_data_tab(id=mock_tab_id_1))(),
        type('MockDBTab2', (), create_mock_db_object_data_tab(id=mock_tab_id_2, overrides={"name": "Tab 2"}))()
    ]
    mock_get_multi = AsyncMock(return_value=mock_db_list)
    monkeypatch.setattr(todo_tabs_api.CRUDTodoTab, "get_multi_by_user", mock_get_multi)

    response = await client.get(f"{BASE_URL}/?user_id={TEST_USER_ID}&limit=10")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert isinstance(response_data, list)
    assert len(response_data) == 2

    expected_response_list = [
        create_mock_response_data_tab(create_mock_db_object_data_tab(id=mock_tab_id_1)),
        create_mock_response_data_tab(create_mock_db_object_data_tab(id=mock_tab_id_2, overrides={"name": "Tab 2"}))
    ]
    assert response_data[0].get("id") == expected_response_list[0].get("id")
    assert response_data[1].get("id") == expected_response_list[1].get("id")
    assert response_data[0].get("name") == expected_response_list[0].get("name")
    assert response_data[1].get("name") == expected_response_list[1].get("name")

    mock_get_multi.assert_awaited_once_with(user_id=TEST_USER_ID, skip=0, limit=10)

@pytest.mark.asyncio
async def test_read_todo_tab(client: AsyncClient, monkeypatch):
    """Test GET /todo-tabs/{tab_id}"""
    mock_tab_id = uuid4()
    mock_db_data = create_mock_db_object_data_tab(id=mock_tab_id)
    mock_get = AsyncMock(return_value=type('MockDBTab', (), mock_db_data)()) 
    monkeypatch.setattr(todo_tabs_api.CRUDTodoTab, "get", mock_get)

    response = await client.get(f"{BASE_URL}/{mock_tab_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    expected_response = create_mock_response_data_tab(mock_db_data)
    assert response_data.get("id") == expected_response.get("id")
    assert response_data.get("name") == expected_response.get("name")
    assert response_data.get("user_id") == str(TEST_USER_ID)
    
    mock_get.assert_awaited_once_with(id=mock_tab_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_read_todo_tab_not_found(client: AsyncClient, monkeypatch):
    """Test GET /todo-tabs/{tab_id} for 404"""
    mock_tab_id = uuid4()
    mock_get = AsyncMock(return_value=None)
    monkeypatch.setattr(todo_tabs_api.CRUDTodoTab, "get", mock_get)

    response = await client.get(f"{BASE_URL}/{mock_tab_id}?user_id={TEST_USER_ID}")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    mock_get.assert_awaited_once_with(id=mock_tab_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_update_todo_tab(client: AsyncClient, monkeypatch):
    """Test PUT /todo-tabs/{tab_id}"""
    mock_tab_id = uuid4()
    original_name = "Original Tab Name"
    updated_name = "Updated Tab Name"
    update_payload = {"name": updated_name}
    
    # Mock data for the existing object fetched by get
    existing_db_data = create_mock_db_object_data_tab(id=mock_tab_id, overrides={"name": original_name})
    mock_get = AsyncMock(return_value=type('MockDBTabGet', (), existing_db_data)()) 
    monkeypatch.setattr(todo_tabs_api.CRUDTodoTab, "get", mock_get)
    
    # Mock data returned by the update method
    updated_db_data = create_mock_db_object_data_tab(id=mock_tab_id, overrides={"name": updated_name})
    mock_update = AsyncMock(return_value=type('MockDBTabUpdate', (), updated_db_data)()) 
    monkeypatch.setattr(todo_tabs_api.CRUDTodoTab, "update", mock_update)

    response = await client.put(f"{BASE_URL}/{mock_tab_id}?user_id={TEST_USER_ID}", json=update_payload)

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    expected_response = create_mock_response_data_tab(updated_db_data)

    assert response_data.get("id") == expected_response.get("id")
    assert response_data.get("name") == updated_name # Check the updated name
    assert response_data.get("user_id") == str(TEST_USER_ID)
    
    mock_get.assert_awaited_once_with(id=mock_tab_id, user_id=TEST_USER_ID)
    mock_update.assert_awaited_once()
    # Verify the update payload and the db object passed to the mock
    call_args, call_kwargs = mock_update.call_args
    assert call_kwargs.get('db_obj').id == mock_tab_id # Check the object passed
    assert isinstance(call_kwargs.get('obj_in'), schemas.todo_tabs.TodoTabUpdate)
    assert call_kwargs.get('obj_in').name == updated_name

@pytest.mark.asyncio
async def test_update_todo_tab_not_found(client: AsyncClient, monkeypatch):
    """Test PUT /todo-tabs/{tab_id} for 404"""
    mock_tab_id = uuid4()
    update_payload = {"name": "Doesn't matter"}
    
    # Mock get to return None
    mock_get = AsyncMock(return_value=None)
    monkeypatch.setattr(todo_tabs_api.CRUDTodoTab, "get", mock_get)
    
    # Mock update should not be called
    mock_update = AsyncMock()
    monkeypatch.setattr(todo_tabs_api.CRUDTodoTab, "update", mock_update)

    response = await client.put(f"{BASE_URL}/{mock_tab_id}?user_id={TEST_USER_ID}", json=update_payload)
    assert response.status_code == status.HTTP_404_NOT_FOUND
    mock_get.assert_awaited_once_with(id=mock_tab_id, user_id=TEST_USER_ID)
    mock_update.assert_not_awaited()

@pytest.mark.asyncio
async def test_delete_todo_tab(client: AsyncClient, monkeypatch):
    """Test DELETE /todo-tabs/{tab_id}"""
    mock_tab_id = uuid4()
    # Mock data for the object to be deleted
    existing_db_data = create_mock_db_object_data_tab(id=mock_tab_id)
    
    # Mock remove to return the object it deleted
    mock_remove = AsyncMock(return_value=type('MockDBTabDelete', (), existing_db_data)()) 
    monkeypatch.setattr(todo_tabs_api.CRUDTodoTab, "remove", mock_remove)

    response = await client.delete(f"{BASE_URL}/{mock_tab_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    expected_response = create_mock_response_data_tab(existing_db_data)
    assert response_data.get("id") == expected_response.get("id")
    assert response_data.get("name") == expected_response.get("name")
    
    mock_remove.assert_awaited_once_with(id=mock_tab_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_delete_todo_tab_not_found(client: AsyncClient, monkeypatch):
    """Test DELETE /todo-tabs/{tab_id} for 404"""
    mock_tab_id = uuid4()
    # Mock remove to return None
    mock_remove = AsyncMock(return_value=None)
    monkeypatch.setattr(todo_tabs_api.CRUDTodoTab, "remove", mock_remove)

    response = await client.delete(f"{BASE_URL}/{mock_tab_id}?user_id={TEST_USER_ID}")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    mock_remove.assert_awaited_once_with(id=mock_tab_id, user_id=TEST_USER_ID)

# Example test for constraint violation (e.g., deleting a tab with lists)
@pytest.mark.asyncio
async def test_delete_todo_tab_conflict(client: AsyncClient, monkeypatch):
    """Test DELETE /todo-tabs/{tab_id} for 409 Conflict"""
    mock_tab_id = uuid4()
    # Mock remove to raise the HTTPException(409) that the CRUD layer would raise
    mock_remove = AsyncMock(side_effect=HTTPException(
        status_code=status.HTTP_409_CONFLICT, 
        detail="Simulated DB conflict"
    ))
    monkeypatch.setattr(todo_tabs_api.CRUDTodoTab, "remove", mock_remove)

    response = await client.delete(f"{BASE_URL}/{mock_tab_id}?user_id={TEST_USER_ID}")
    
    # Now the API layer should return the 409 raised by the mocked CRUD method
    assert response.status_code == status.HTTP_409_CONFLICT 
    assert "detail" in response.json() # Check if detail is present
    assert "Simulated DB conflict" in response.json().get("detail", "")

    mock_remove.assert_awaited_once_with(id=mock_tab_id, user_id=TEST_USER_ID)
