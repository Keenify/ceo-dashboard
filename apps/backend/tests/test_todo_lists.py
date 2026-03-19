import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from fastapi import status, HTTPException
import os
import sys
from pathlib import Path
from uuid import UUID, uuid4
from datetime import datetime, timezone, date
from dotenv import load_dotenv
from typing import Dict, Any, Optional, List
from unittest.mock import AsyncMock, MagicMock, ANY
import json # For debugging output

# --- Add project root to sys.path --- 
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
# -------------------------------------

# Load environment variables
load_dotenv()

# Import app and specific modules to patch
from app.main import app
from app import schemas, models
from app.api import todo_lists as todo_lists_api # Module containing the API routes
from app.api import todo_tabs as todo_tabs_api # Need to mock tab checks

# --- Test User ID --- 
TEST_USER_ID_STR = os.getenv("TEST_USER_ID")
if not TEST_USER_ID_STR:
    raise ValueError("TEST_USER_ID environment variable not set or empty")
try:
    TEST_USER_ID = UUID(TEST_USER_ID_STR)
except ValueError:
     raise ValueError(f"Invalid UUID format for TEST_USER_ID: {TEST_USER_ID_STR}")
# --------------------

BASE_URL = "/todo-lists" # API endpoint prefix

# --- Fixture for API Client --- 
@pytest_asyncio.fixture(scope="function")
async def client():
    """Provide a test client for making API requests to the app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

# --- Helper Functions for Mock Data --- 
def create_mock_db_object_data_list(id: UUID, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates a dictionary mimicking attributes of a TodoList DB model object."""
    base_data = {
        "id": id,
        "user_id": TEST_USER_ID,
        "tab_id": None, # Default to no tab
        "name": f"Mock List {id}",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        # Add relationships if needed, e.g., todos = []
    }
    if overrides:
        base_data.update(overrides)
    return base_data

def create_mock_response_data_list(db_data: Dict[str, Any]) -> Dict[str, Any]:
    """Creates a dictionary matching the TodoList response schema from mock DB data."""
    response_data = db_data.copy()
    response_data['id'] = str(response_data['id'])
    response_data['user_id'] = str(response_data['user_id'])
    if response_data.get('tab_id') is not None:
        response_data['tab_id'] = str(response_data['tab_id'])
    if isinstance(response_data.get('created_at'), datetime):
        response_data['created_at'] = response_data['created_at'].isoformat()
    if isinstance(response_data.get('updated_at'), datetime):
        response_data['updated_at'] = response_data['updated_at'].isoformat()
    return response_data

# --- Test Cases --- 

@pytest.mark.asyncio
async def test_create_todo_list_no_tab(client: AsyncClient, monkeypatch):
    """Test POST /todo-lists/ without assigning a tab."""
    list_name = "Test Create List (No Tab)"
    create_payload = {"name": list_name, "tab_id": None, "user_id": str(TEST_USER_ID)}
    mock_list_id = uuid4()
    
    mock_db_data = create_mock_db_object_data_list(id=mock_list_id, overrides={"name": list_name, "tab_id": None, "user_id": TEST_USER_ID})
    mock_create = AsyncMock(return_value=type('MockDBList', (), mock_db_data)()) 
    monkeypatch.setattr(todo_lists_api.CRUDTodoList, "create", mock_create)
    
    mock_validate_tab = AsyncMock()
    monkeypatch.setattr(todo_lists_api, "validate_tab_ownership", mock_validate_tab)

    response = await client.post(BASE_URL + "/", json=create_payload)

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    expected_response = create_mock_response_data_list(mock_db_data)
    
    assert response_data.get("id") == expected_response.get("id")
    assert response_data.get("name") == expected_response.get("name")
    assert response_data.get("user_id") == str(TEST_USER_ID)
    assert response_data.get("tab_id") is None
    
    mock_create.assert_awaited_once()
    call_args, call_kwargs = mock_create.call_args
    assert isinstance(call_kwargs.get('obj_in'), schemas.todo_lists.TodoListCreate)
    assert call_kwargs.get('obj_in').name == list_name
    assert call_kwargs.get('obj_in').tab_id is None
    assert call_kwargs.get('obj_in').user_id == TEST_USER_ID
    assert call_kwargs.get('user_id') == TEST_USER_ID
    mock_validate_tab.assert_awaited_once_with(ANY, None, TEST_USER_ID)

@pytest.mark.asyncio
async def test_create_todo_list_with_tab(client: AsyncClient, monkeypatch):
    """Test POST /todo-lists/ assigning to a valid tab."""
    list_name = "Test Create List (With Tab)"
    mock_tab_id = uuid4()
    create_payload = {"name": list_name, "tab_id": str(mock_tab_id), "user_id": str(TEST_USER_ID)}
    mock_list_id = uuid4()
    
    mock_db_data = create_mock_db_object_data_list(id=mock_list_id, overrides={"name": list_name, "tab_id": mock_tab_id, "user_id": TEST_USER_ID})
    mock_create = AsyncMock(return_value=type('MockDBList', (), mock_db_data)()) 
    monkeypatch.setattr(todo_lists_api.CRUDTodoList, "create", mock_create)
    
    mock_validate_tab = AsyncMock()
    monkeypatch.setattr(todo_lists_api, "validate_tab_ownership", mock_validate_tab)

    response = await client.post(BASE_URL + "/", json=create_payload)

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    expected_response = create_mock_response_data_list(mock_db_data)
    
    assert response_data.get("id") == expected_response.get("id")
    assert response_data.get("name") == expected_response.get("name")
    assert response_data.get("tab_id") == str(mock_tab_id)
    
    mock_create.assert_awaited_once()
    call_args, call_kwargs = mock_create.call_args
    assert call_kwargs.get('obj_in').name == list_name
    assert call_kwargs.get('obj_in').tab_id == mock_tab_id
    assert call_kwargs.get('obj_in').user_id == TEST_USER_ID
    mock_validate_tab.assert_awaited_once_with(ANY, mock_tab_id, TEST_USER_ID)

@pytest.mark.asyncio
async def test_create_todo_list_invalid_tab(client: AsyncClient, monkeypatch):
    """Test POST /todo-lists/ assigning to an invalid/unowned tab."""
    list_name = "Test Create List (Invalid Tab)"
    mock_tab_id = uuid4()
    create_payload = {"name": list_name, "tab_id": str(mock_tab_id), "user_id": str(TEST_USER_ID)}
    
    mock_validate_tab = AsyncMock(side_effect=HTTPException(status_code=status.HTTP_404_NOT_FOUND))
    monkeypatch.setattr(todo_lists_api, "validate_tab_ownership", mock_validate_tab)

    mock_create = AsyncMock()
    monkeypatch.setattr(todo_lists_api.CRUDTodoList, "create", mock_create)

    response = await client.post(BASE_URL + "/", json=create_payload)

    assert response.status_code == status.HTTP_404_NOT_FOUND
    mock_validate_tab.assert_awaited_once_with(ANY, mock_tab_id, TEST_USER_ID)
    mock_create.assert_not_awaited()

@pytest.mark.asyncio
async def test_read_todo_lists_all(client: AsyncClient, monkeypatch):
    """Test GET /todo-lists/ (no filter)."""
    mock_list_id_1 = uuid4()
    mock_list_id_2 = uuid4()
    mock_tab_id = uuid4()
    mock_db_list = [
        type('MockDBList1', (), create_mock_db_object_data_list(id=mock_list_id_1))(),
        type('MockDBList2', (), create_mock_db_object_data_list(id=mock_list_id_2, overrides={"name": "List 2", "tab_id": mock_tab_id}))()
    ]
    mock_get_multi = AsyncMock(return_value=mock_db_list)
    monkeypatch.setattr(todo_lists_api.CRUDTodoList, "get_multi_by_user", mock_get_multi)

    response = await client.get(f"{BASE_URL}/?user_id={TEST_USER_ID}&limit=10")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 2
    assert response_data[0]["id"] == str(mock_list_id_1)
    assert response_data[1]["id"] == str(mock_list_id_2)
    assert response_data[0]["tab_id"] is None
    assert response_data[1]["tab_id"] == str(mock_tab_id)

    mock_get_multi.assert_awaited_once_with(user_id=TEST_USER_ID, skip=0, limit=10)

@pytest.mark.asyncio
async def test_read_todo_lists_by_tab(client: AsyncClient, monkeypatch):
    """Test GET /todo-lists/?tab_id=..."""
    mock_list_id = uuid4()
    mock_tab_id = uuid4()
    mock_db_list = [
        type('MockDBList1', (), create_mock_db_object_data_list(id=mock_list_id, overrides={"tab_id": mock_tab_id}))()
    ]
    mock_get_multi_tab = AsyncMock(return_value=mock_db_list)
    monkeypatch.setattr(todo_lists_api.CRUDTodoList, "get_multi_by_tab", mock_get_multi_tab)
    
    mock_validate_tab = AsyncMock()
    monkeypatch.setattr(todo_lists_api, "validate_tab_ownership", mock_validate_tab)

    response = await client.get(f"{BASE_URL}/?user_id={TEST_USER_ID}&tab_id={mock_tab_id}&limit=10")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 1
    assert response_data[0]["id"] == str(mock_list_id)
    assert response_data[0]["tab_id"] == str(mock_tab_id)

    mock_validate_tab.assert_awaited_once_with(ANY, mock_tab_id, TEST_USER_ID)
    mock_get_multi_tab.assert_awaited_once_with(tab_id=mock_tab_id, user_id=TEST_USER_ID, skip=0, limit=10)

@pytest.mark.asyncio
async def test_read_todo_lists_unassigned(client: AsyncClient, monkeypatch):
    """Test GET /todo-lists/?include_unassigned=true"""
    mock_list_id = uuid4()
    mock_db_list = [
        type('MockDBList1', (), create_mock_db_object_data_list(id=mock_list_id, overrides={"tab_id": None}))()
    ]
    mock_get_multi_tab = AsyncMock(return_value=mock_db_list)
    monkeypatch.setattr(todo_lists_api.CRUDTodoList, "get_multi_by_tab", mock_get_multi_tab)

    response = await client.get(f"{BASE_URL}/?user_id={TEST_USER_ID}&include_unassigned=true&limit=10")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 1
    assert response_data[0]["id"] == str(mock_list_id)
    assert response_data[0]["tab_id"] is None

    mock_get_multi_tab.assert_awaited_once_with(tab_id=None, user_id=TEST_USER_ID, skip=0, limit=10)

@pytest.mark.asyncio
async def test_read_todo_list(client: AsyncClient, monkeypatch):
    """Test GET /todo-lists/{list_id}"""
    mock_list_id = uuid4()
    mock_db_data = create_mock_db_object_data_list(id=mock_list_id)
    mock_get = AsyncMock(return_value=type('MockDBList', (), mock_db_data)()) 
    monkeypatch.setattr(todo_lists_api.CRUDTodoList, "get", mock_get)

    response = await client.get(f"{BASE_URL}/{mock_list_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    expected_response = create_mock_response_data_list(mock_db_data)
    assert response_data.get("id") == expected_response.get("id")
    assert response_data.get("name") == expected_response.get("name")
    assert response_data.get("user_id") == str(TEST_USER_ID)
    assert response_data.get("tab_id") == expected_response.get("tab_id")
    mock_get.assert_awaited_once_with(id=mock_list_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_read_todo_list_not_found(client: AsyncClient, monkeypatch):
    """Test GET /todo-lists/{list_id} for 404"""
    mock_list_id = uuid4()
    mock_get = AsyncMock(return_value=None)
    monkeypatch.setattr(todo_lists_api.CRUDTodoList, "get", mock_get)

    response = await client.get(f"{BASE_URL}/{mock_list_id}?user_id={TEST_USER_ID}")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    mock_get.assert_awaited_once_with(id=mock_list_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_update_todo_list_assign_tab(client: AsyncClient, monkeypatch):
    """Test PUT /todo-lists/{list_id} to assign/change tab."""
    mock_list_id = uuid4()
    mock_new_tab_id = uuid4()
    updated_name = "Updated List Name For Tab Assign"
    update_payload = {"name": updated_name, "tab_id": str(mock_new_tab_id)}

    existing_db_data = create_mock_db_object_data_list(id=mock_list_id, overrides={"tab_id": None})
    mock_get = AsyncMock(return_value=type('MockDBListGet', (), existing_db_data)()) 
    monkeypatch.setattr(todo_lists_api.CRUDTodoList, "get", mock_get)

    updated_db_data = create_mock_db_object_data_list(id=mock_list_id, overrides={"name": updated_name, "tab_id": mock_new_tab_id})
    mock_update = AsyncMock(return_value=type('MockDBListUpdate', (), updated_db_data)()) 
    monkeypatch.setattr(todo_lists_api.CRUDTodoList, "update", mock_update)
    
    mock_validate_tab = AsyncMock()
    monkeypatch.setattr(todo_lists_api, "validate_tab_ownership", mock_validate_tab)

    response = await client.put(f"{BASE_URL}/{mock_list_id}?user_id={TEST_USER_ID}", json=update_payload)

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["name"] == updated_name
    assert response_data["tab_id"] == str(mock_new_tab_id)

    mock_get.assert_awaited_once_with(id=mock_list_id, user_id=TEST_USER_ID)
    mock_validate_tab.assert_awaited_once_with(ANY, mock_new_tab_id, TEST_USER_ID)
    mock_update.assert_awaited_once()
    call_args, call_kwargs = mock_update.call_args
    assert call_kwargs['db_obj'].id == mock_list_id
    assert isinstance(call_kwargs['obj_in'], schemas.todo_lists.TodoListUpdate)
    assert call_kwargs['obj_in'].name == updated_name
    assert call_kwargs['obj_in'].tab_id == mock_new_tab_id

@pytest.mark.asyncio
async def test_update_todo_list_unassign_tab(client: AsyncClient, monkeypatch):
    """Test PUT /todo-lists/{list_id} to unassign tab (set to null)."""
    mock_list_id = uuid4()
    mock_old_tab_id = uuid4()
    update_payload = {"tab_id": None} # Only updating tab_id

    existing_db_data = create_mock_db_object_data_list(id=mock_list_id, overrides={"tab_id": mock_old_tab_id, "name": "List With Tab"})
    mock_get = AsyncMock(return_value=type('MockDBListGet', (), existing_db_data)()) 
    monkeypatch.setattr(todo_lists_api.CRUDTodoList, "get", mock_get)

    # Mock the returned object after update
    updated_db_data = create_mock_db_object_data_list(id=mock_list_id, overrides={"tab_id": None, "name": "List With Tab"})
    mock_update = AsyncMock(return_value=type('MockDBListUpdate', (), updated_db_data)()) 
    monkeypatch.setattr(todo_lists_api.CRUDTodoList, "update", mock_update)
    
    mock_validate_tab = AsyncMock()
    monkeypatch.setattr(todo_lists_api, "validate_tab_ownership", mock_validate_tab)

    response = await client.put(f"{BASE_URL}/{mock_list_id}?user_id={TEST_USER_ID}", json=update_payload)

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["tab_id"] is None
    assert response_data["name"] == "List With Tab" # Name shouldn't change

    mock_get.assert_awaited_once_with(id=mock_list_id, user_id=TEST_USER_ID)
    mock_validate_tab.assert_awaited_once_with(ANY, None, TEST_USER_ID)
    mock_update.assert_awaited_once()
    call_args, call_kwargs = mock_update.call_args
    assert call_kwargs['db_obj'].id == mock_list_id
    assert isinstance(call_kwargs['obj_in'], schemas.todo_lists.TodoListUpdate)
    assert call_kwargs['obj_in'].tab_id is None
    assert call_kwargs['obj_in'].name is None # Name was not in payload

@pytest.mark.asyncio
async def test_update_todo_list_invalid_tab(client: AsyncClient, monkeypatch):
    """Test PUT /todo-lists/{list_id} assigning to an invalid tab."""
    mock_list_id = uuid4()
    mock_invalid_tab_id = uuid4()
    update_payload = {"tab_id": str(mock_invalid_tab_id)}
    
    # Mock get for the list itself
    existing_db_data = create_mock_db_object_data_list(id=mock_list_id)
    mock_get = AsyncMock(return_value=type('MockDBListGet', (), existing_db_data)()) 
    monkeypatch.setattr(todo_lists_api.CRUDTodoList, "get", mock_get)

    # Mock tab validation to fail (use imported HTTPException)
    mock_validate_tab = AsyncMock(side_effect=HTTPException(status_code=status.HTTP_404_NOT_FOUND))
    monkeypatch.setattr(todo_lists_api, "validate_tab_ownership", mock_validate_tab)
    
    # Update should not be called
    mock_update = AsyncMock()
    monkeypatch.setattr(todo_lists_api.CRUDTodoList, "update", mock_update)

    response = await client.put(f"{BASE_URL}/{mock_list_id}?user_id={TEST_USER_ID}", json=update_payload)

    assert response.status_code == status.HTTP_404_NOT_FOUND
    mock_get.assert_awaited_once_with(id=mock_list_id, user_id=TEST_USER_ID)
    mock_validate_tab.assert_awaited_once_with(ANY, mock_invalid_tab_id, TEST_USER_ID)
    mock_update.assert_not_awaited()

@pytest.mark.asyncio
async def test_delete_todo_list(client: AsyncClient, monkeypatch):
    """Test DELETE /todo-lists/{list_id}"""
    mock_list_id = uuid4()
    existing_db_data = create_mock_db_object_data_list(id=mock_list_id)
    mock_remove = AsyncMock(return_value=type('MockDBListDelete', (), existing_db_data)()) 
    monkeypatch.setattr(todo_lists_api.CRUDTodoList, "remove", mock_remove)

    response = await client.delete(f"{BASE_URL}/{mock_list_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    expected_response = create_mock_response_data_list(existing_db_data)
    assert response_data.get("id") == expected_response.get("id")
    assert response_data.get("name") == expected_response.get("name")
    assert response_data.get("user_id") == str(TEST_USER_ID)
    assert response_data.get("tab_id") == expected_response.get("tab_id")
    mock_remove.assert_awaited_once_with(id=mock_list_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_delete_todo_list_not_found(client: AsyncClient, monkeypatch):
    """Test DELETE /todo-lists/{list_id} for 404"""
    mock_list_id = uuid4()
    mock_remove = AsyncMock(return_value=None)
    monkeypatch.setattr(todo_lists_api.CRUDTodoList, "remove", mock_remove)

    response = await client.delete(f"{BASE_URL}/{mock_list_id}?user_id={TEST_USER_ID}")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    mock_remove.assert_awaited_once_with(id=mock_list_id, user_id=TEST_USER_ID)
