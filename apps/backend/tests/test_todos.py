import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from fastapi import status, HTTPException
import os
import sys
from pathlib import Path
from uuid import UUID, uuid4
from datetime import date, datetime, timezone
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
from app.api import todos as todos_api # Module containing the API routes
from app.api import todo_lists as todo_lists_api # Need to mock list checks

# --- Test User ID --- 
TEST_USER_ID_STR = os.getenv("TEST_USER_ID")
if not TEST_USER_ID_STR:
    raise ValueError("TEST_USER_ID environment variable not set or empty")
try:
    TEST_USER_ID = UUID(TEST_USER_ID_STR)
except ValueError:
     raise ValueError(f"Invalid UUID format for TEST_USER_ID: {TEST_USER_ID_STR}")
# --------------------

BASE_URL = "/todos" # API endpoint prefix

# --- Fixture for API Client --- 
@pytest_asyncio.fixture(scope="function")
async def client():
    """Provide a test client for making API requests to the app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

# --- Helper Functions for Mock Data --- 
def create_mock_db_object_data_todo(id: UUID, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates a dictionary mimicking attributes of a Todo DB model object."""
    base_data = {
        "id": id,
        "user_id": TEST_USER_ID,
        "list_id": None,
        "title": f"Mock Todo {id}",
        "description": None,
        "due_date": None,
        "is_completed": False,
        "priority": 0,
        "color_code": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    if overrides:
        base_data.update(overrides)
    return base_data

def create_mock_response_data_todo(db_data: Dict[str, Any]) -> Dict[str, Any]:
    """Creates a dictionary matching the Todo response schema from mock DB data."""
    response_data = db_data.copy()
    response_data['id'] = str(response_data['id'])
    response_data['user_id'] = str(response_data['user_id'])
    if response_data.get('list_id') is not None:
        response_data['list_id'] = str(response_data['list_id'])
    if isinstance(response_data.get('due_date'), date):
        response_data['due_date'] = response_data['due_date'].isoformat()
    if isinstance(response_data.get('created_at'), datetime):
        response_data['created_at'] = response_data['created_at'].isoformat()
    if isinstance(response_data.get('updated_at'), datetime):
        response_data['updated_at'] = response_data['updated_at'].isoformat()
    return response_data

# --- Test Cases --- 

@pytest.mark.asyncio
async def test_create_todo_no_list(client: AsyncClient, monkeypatch):
    """Test POST /todos/ without assigning a list."""
    todo_title = "Test Create Todo (No List)"
    initial_due = date.today()
    create_payload = {"title": todo_title, "list_id": None, "due_date": initial_due.isoformat(), "user_id": str(TEST_USER_ID)}
    mock_todo_id = uuid4()
    
    mock_db_data = create_mock_db_object_data_todo(id=mock_todo_id, overrides={"title": todo_title, "list_id": None, "due_date": initial_due, "user_id": TEST_USER_ID})
    mock_create = AsyncMock(return_value=type('MockDBTodo', (), mock_db_data)()) 
    monkeypatch.setattr(todos_api.CRUDTodo, "create", mock_create)
    
    mock_validate_list = AsyncMock()
    monkeypatch.setattr(todos_api, "validate_list_ownership", mock_validate_list)

    response = await client.post(BASE_URL + "/", json=create_payload)

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    expected_response = create_mock_response_data_todo(mock_db_data)
    
    assert response_data.get("id") == expected_response.get("id")
    assert response_data.get("title") == expected_response.get("title")
    assert response_data.get("user_id") == str(TEST_USER_ID)
    assert response_data.get("list_id") is None
    assert response_data.get("due_date") == initial_due.isoformat()
    
    mock_create.assert_awaited_once()
    call_args, call_kwargs = mock_create.call_args
    assert isinstance(call_kwargs.get('obj_in'), schemas.todos.TodoCreate)
    assert call_kwargs.get('obj_in').title == todo_title
    assert call_kwargs.get('obj_in').list_id is None
    assert call_kwargs.get('obj_in').due_date == initial_due
    assert call_kwargs.get('obj_in').user_id == TEST_USER_ID
    assert call_kwargs.get('user_id') == TEST_USER_ID
    mock_validate_list.assert_awaited_once_with(ANY, None, TEST_USER_ID)

@pytest.mark.asyncio
async def test_create_todo_with_list(client: AsyncClient, monkeypatch):
    """Test POST /todos/ assigning to a valid list."""
    todo_title = "Test Create Todo (With List)"
    mock_list_id = uuid4()
    create_payload = {"title": todo_title, "list_id": str(mock_list_id), "due_date": None, "user_id": str(TEST_USER_ID)}
    mock_todo_id = uuid4()
    
    mock_db_data = create_mock_db_object_data_todo(id=mock_todo_id, overrides={"title": todo_title, "list_id": mock_list_id, "due_date": None, "user_id": TEST_USER_ID})
    mock_create = AsyncMock(return_value=type('MockDBTodo', (), mock_db_data)()) 
    monkeypatch.setattr(todos_api.CRUDTodo, "create", mock_create)
    
    mock_validate_list = AsyncMock()
    monkeypatch.setattr(todos_api, "validate_list_ownership", mock_validate_list)

    response = await client.post(BASE_URL + "/", json=create_payload)

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    expected_response = create_mock_response_data_todo(mock_db_data)
    
    assert response_data.get("id") == expected_response.get("id")
    assert response_data.get("list_id") == str(mock_list_id)
    assert response_data.get("due_date") is None
    
    mock_create.assert_awaited_once()
    call_args, call_kwargs = mock_create.call_args
    assert isinstance(call_kwargs.get('obj_in'), schemas.todos.TodoCreate)
    assert call_kwargs.get('obj_in').list_id == mock_list_id
    assert call_kwargs.get('obj_in').user_id == TEST_USER_ID
    mock_validate_list.assert_awaited_once_with(ANY, mock_list_id, TEST_USER_ID)

@pytest.mark.asyncio
async def test_create_todo_invalid_list(client: AsyncClient, monkeypatch):
    """Test POST /todos/ assigning to an invalid/unowned list."""
    mock_list_id = uuid4()
    create_payload = {"title": "Invalid List", "list_id": str(mock_list_id), "user_id": str(TEST_USER_ID)}
    
    mock_validate_list = AsyncMock(side_effect=HTTPException(status_code=status.HTTP_404_NOT_FOUND))
    monkeypatch.setattr(todos_api, "validate_list_ownership", mock_validate_list)

    mock_create = AsyncMock()
    monkeypatch.setattr(todos_api.CRUDTodo, "create", mock_create)

    response = await client.post(BASE_URL + "/", json=create_payload)

    assert response.status_code == status.HTTP_404_NOT_FOUND
    mock_validate_list.assert_awaited_once_with(ANY, mock_list_id, TEST_USER_ID)
    mock_create.assert_not_awaited()

@pytest.mark.asyncio
async def test_read_todos_all(client: AsyncClient, monkeypatch):
    """Test GET /todos/ (no filter)."""
    mock_todo_id_1 = uuid4()
    mock_todo_id_2 = uuid4()
    mock_list_id = uuid4()
    mock_db_list = [
        type('MockDBTodo1', (), create_mock_db_object_data_todo(id=mock_todo_id_1))(),
        type('MockDBTodo2', (), create_mock_db_object_data_todo(id=mock_todo_id_2, overrides={"title": "Todo 2", "list_id": mock_list_id}))()
    ]
    mock_get_multi = AsyncMock(return_value=mock_db_list)
    monkeypatch.setattr(todos_api.CRUDTodo, "get_multi_by_user", mock_get_multi)

    response = await client.get(f"{BASE_URL}/?user_id={TEST_USER_ID}&limit=10")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 2
    assert response_data[0]["id"] == str(mock_todo_id_1)
    assert response_data[1]["id"] == str(mock_todo_id_2)
    assert response_data[0]["list_id"] is None
    assert response_data[1]["list_id"] == str(mock_list_id)

    # Verify the default call without date filters
    mock_get_multi.assert_awaited_once_with(user_id=TEST_USER_ID, skip=0, limit=10, include_completed=None, list_id=None, before_date=None, after_date=None)

@pytest.mark.asyncio
async def test_read_todos_date_filters(client: AsyncClient, monkeypatch):
    """Test GET /todos/ with before_date and after_date filters."""
    test_date_before = date(2024, 7, 15)
    test_date_after = date(2024, 7, 10)
    
    mock_todo_id = uuid4()
    # Mock data that should match the filter
    mock_db_list = [
        type('MockDBTodoDate', (), create_mock_db_object_data_todo(id=mock_todo_id, overrides={"due_date": date(2024, 7, 12)}))()
    ]
    mock_get_multi = AsyncMock(return_value=mock_db_list)
    monkeypatch.setattr(todos_api.CRUDTodo, "get_multi_by_user", mock_get_multi)

    # Construct query string with date filters
    query_params = f"user_id={TEST_USER_ID}&limit=10&before_date={test_date_before.isoformat()}&after_date={test_date_after.isoformat()}"
    response = await client.get(f"{BASE_URL}/?{query_params}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 1
    assert response_data[0]["id"] == str(mock_todo_id)
    assert response_data[0]["due_date"] == date(2024, 7, 12).isoformat()

    # Verify the CRUD method was called with the correct date filters
    mock_get_multi.assert_awaited_once_with(
        user_id=TEST_USER_ID, 
        skip=0, 
        limit=10, 
        include_completed=None, 
        list_id=None, 
        before_date=test_date_before, 
        after_date=test_date_after
    )

@pytest.mark.asyncio
async def test_read_todos_date_filters_no_match(client: AsyncClient, monkeypatch):
    """Test GET /todos/ with date filters that shouldn't match."""
    test_date_before = date(2024, 7, 9) # Before any reasonable due date
    
    # Mock returns an empty list
    mock_get_multi = AsyncMock(return_value=[])
    monkeypatch.setattr(todos_api.CRUDTodo, "get_multi_by_user", mock_get_multi)

    query_params = f"user_id={TEST_USER_ID}&limit=10&before_date={test_date_before.isoformat()}"
    response = await client.get(f"{BASE_URL}/?{query_params}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 0

    mock_get_multi.assert_awaited_once_with(
        user_id=TEST_USER_ID, 
        skip=0, 
        limit=10, 
        include_completed=None, 
        list_id=None, 
        before_date=test_date_before, 
        after_date=None
    )

@pytest.mark.asyncio
async def test_read_todos_by_list(client: AsyncClient, monkeypatch):
    """Test GET /todos/?list_id=..."""
    mock_todo_id = uuid4()
    mock_list_id = uuid4()
    mock_db_list = [
        type('MockDBTodo1', (), create_mock_db_object_data_todo(id=mock_todo_id, overrides={"list_id": mock_list_id}))()
    ]
    mock_get_multi = AsyncMock(return_value=mock_db_list)
    monkeypatch.setattr(todos_api.CRUDTodo, "get_multi_by_user", mock_get_multi)
    
    mock_validate_list = AsyncMock()
    monkeypatch.setattr(todos_api, "validate_list_ownership", mock_validate_list)

    response = await client.get(f"{BASE_URL}/?user_id={TEST_USER_ID}&list_id={mock_list_id}&limit=10")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 1
    assert response_data[0]["id"] == str(mock_todo_id)
    assert response_data[0]["list_id"] == str(mock_list_id)

    mock_validate_list.assert_awaited_once_with(ANY, mock_list_id, TEST_USER_ID)
    mock_get_multi.assert_awaited_once_with(
        user_id=TEST_USER_ID, 
        skip=0, 
        limit=10, 
        include_completed=None, 
        list_id=mock_list_id, 
        before_date=None,
        after_date=None
    )

@pytest.mark.asyncio
async def test_read_todo(client: AsyncClient, monkeypatch):
    """Test GET /todos/{todo_id}"""
    mock_todo_id = uuid4()
    mock_db_data = create_mock_db_object_data_todo(id=mock_todo_id)
    mock_get = AsyncMock(return_value=type('MockDBTodo', (), mock_db_data)()) 
    monkeypatch.setattr(todos_api.CRUDTodo, "get", mock_get)

    response = await client.get(f"{BASE_URL}/{mock_todo_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    expected_response = create_mock_response_data_todo(mock_db_data)
    assert response_data.get("id") == expected_response.get("id")
    assert response_data.get("title") == expected_response.get("title")
    assert response_data.get("user_id") == str(TEST_USER_ID)
    assert response_data.get("list_id") == expected_response.get("list_id")
    assert response_data.get("due_date") == expected_response.get("due_date")
    assert response_data.get("is_completed") == expected_response.get("is_completed")
    mock_get.assert_awaited_once_with(id=mock_todo_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_read_todo_not_found(client: AsyncClient, monkeypatch):
    """Test GET /todos/{todo_id} for 404"""
    mock_todo_id = uuid4()
    mock_get = AsyncMock(return_value=None)
    monkeypatch.setattr(todos_api.CRUDTodo, "get", mock_get)

    response = await client.get(f"{BASE_URL}/{mock_todo_id}?user_id={TEST_USER_ID}")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    mock_get.assert_awaited_once_with(id=mock_todo_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_update_todo_assign_list_clears_due_date(client: AsyncClient, monkeypatch):
    """Test PUT /todos/{todo_id} assigning list clears due_date."""
    mock_todo_id = uuid4()
    mock_new_list_id = uuid4()
    initial_due = date.today()
    update_payload = {"list_id": str(mock_new_list_id)} # Only sending list_id

    existing_db_data = create_mock_db_object_data_todo(id=mock_todo_id, overrides={"list_id": None, "due_date": initial_due})
    mock_get = AsyncMock(return_value=type('MockDBTodoGet', (), existing_db_data)()) 
    monkeypatch.setattr(todos_api.CRUDTodo, "get", mock_get)

    # Mock the update result: list_id is set, due_date is None
    updated_db_data = create_mock_db_object_data_todo(id=mock_todo_id, overrides={"list_id": mock_new_list_id, "due_date": None, "title": existing_db_data["title"]})
    mock_update = AsyncMock(return_value=type('MockDBTodoUpdate', (), updated_db_data)()) 
    monkeypatch.setattr(todos_api.CRUDTodo, "update", mock_update)
    
    mock_validate_list = AsyncMock()
    monkeypatch.setattr(todos_api, "validate_list_ownership", mock_validate_list)

    response = await client.put(f"{BASE_URL}/{mock_todo_id}?user_id={TEST_USER_ID}", json=update_payload)

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["list_id"] == str(mock_new_list_id)
    assert response_data["due_date"] is None # Crucial check
    assert response_data["title"] == existing_db_data["title"] # Title should be unchanged

    mock_get.assert_awaited_once_with(id=mock_todo_id, user_id=TEST_USER_ID)
    mock_validate_list.assert_awaited_once_with(ANY, str(mock_new_list_id), TEST_USER_ID)
    mock_update.assert_awaited_once()
    # Check that the CRUD update was called correctly
    call_args, call_kwargs = mock_update.call_args
    assert call_kwargs['db_obj'].id == mock_todo_id
    assert isinstance(call_kwargs['obj_in'], schemas.todos.TodoUpdate)
    assert str(call_kwargs['obj_in'].list_id) == str(mock_new_list_id)
    # Check that the mock update function *itself* correctly simulated clearing the due_date
    assert mock_update.return_value.due_date is None

@pytest.mark.asyncio
async def test_update_todo_change_details_keeps_list(client: AsyncClient, monkeypatch):
    """Test PUT /todos/{todo_id} changing title/completion keeps assigned list."""
    mock_todo_id = uuid4()
    mock_list_id = uuid4()
    update_payload = {"title": "Updated Todo Title", "is_completed": True}

    existing_db_data = create_mock_db_object_data_todo(id=mock_todo_id, overrides={"list_id": mock_list_id, "due_date": None, "title": "Old Title"})
    mock_get = AsyncMock(return_value=type('MockDBTodoGet', (), existing_db_data)()) 
    monkeypatch.setattr(todos_api.CRUDTodo, "get", mock_get)

    # Mock the update result
    updated_db_data = create_mock_db_object_data_todo(id=mock_todo_id, overrides={"list_id": mock_list_id, "due_date": None, "title": "Updated Todo Title", "is_completed": True})
    mock_update = AsyncMock(return_value=type('MockDBTodoUpdate', (), updated_db_data)()) 
    monkeypatch.setattr(todos_api.CRUDTodo, "update", mock_update)
    
    # List validation shouldn't be called if list_id not in payload
    mock_validate_list = AsyncMock()
    monkeypatch.setattr(todos_api, "validate_list_ownership", mock_validate_list)

    response = await client.put(f"{BASE_URL}/{mock_todo_id}?user_id={TEST_USER_ID}", json=update_payload)

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["title"] == "Updated Todo Title"
    assert response_data["is_completed"] is True
    assert response_data["list_id"] == str(mock_list_id) # List should be unchanged
    assert response_data["due_date"] is None # Due date unchanged (was None)

    mock_get.assert_awaited_once_with(id=mock_todo_id, user_id=TEST_USER_ID)
    mock_validate_list.assert_not_awaited() # IMPORTANT check
    mock_update.assert_awaited_once()
    call_args, call_kwargs = mock_update.call_args
    assert call_kwargs['db_obj'].id == mock_todo_id
    assert isinstance(call_kwargs['obj_in'], schemas.todos.TodoUpdate)
    assert call_kwargs['obj_in'].title == "Updated Todo Title"
    assert call_kwargs['obj_in'].is_completed is True
    assert call_kwargs['obj_in'].list_id is None # list_id was not in payload

@pytest.mark.asyncio
async def test_update_todo_only_title(client: AsyncClient, monkeypatch):
    """Test PUT /todos/{todo_id} updating only the title."""
    mock_todo_id = uuid4()
    mock_list_id = uuid4()
    original_due_date = date(2024, 8, 1)
    original_title = "Original Title"
    updated_title = "Updated Title Only"
    original_completed = False

    update_payload = {"title": updated_title} # Payload with only title

    existing_db_data = create_mock_db_object_data_todo(
        id=mock_todo_id, 
        overrides={
            "list_id": mock_list_id, 
            "due_date": original_due_date, 
            "title": original_title,
            "is_completed": original_completed
        }
    )
    mock_get = AsyncMock(return_value=type('MockDBTodoGet', (), existing_db_data)()) 
    monkeypatch.setattr(todos_api.CRUDTodo, "get", mock_get)

    # Mock the update result: only title changes
    updated_db_data = create_mock_db_object_data_todo(
        id=mock_todo_id, 
        overrides={
            "list_id": mock_list_id, # Should remain the same
            "due_date": original_due_date, # Should remain the same
            "title": updated_title, # The only change
            "is_completed": original_completed # Should remain the same
            # Other fields like description, priority also remain same as default mock
        }
    )
    mock_update = AsyncMock(return_value=type('MockDBTodoUpdate', (), updated_db_data)()) 
    monkeypatch.setattr(todos_api.CRUDTodo, "update", mock_update)
    
    # List validation shouldn't be called as list_id not in payload
    mock_validate_list = AsyncMock()
    monkeypatch.setattr(todos_api, "validate_list_ownership", mock_validate_list)

    response = await client.put(f"{BASE_URL}/{mock_todo_id}?user_id={TEST_USER_ID}", json=update_payload)

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    expected_response = create_mock_response_data_todo(updated_db_data)

    # Assertions: Check updated title and unchanged fields
    assert response_data.get("id") == str(mock_todo_id)
    assert response_data.get("title") == updated_title
    assert response_data.get("list_id") == str(mock_list_id)
    assert response_data.get("due_date") == original_due_date.isoformat()
    assert response_data.get("is_completed") == original_completed
    # Compare against the expected full response derived from mock
    assert response_data.get("description") == expected_response.get("description")
    assert response_data.get("priority") == expected_response.get("priority")
    assert response_data.get("color_code") == expected_response.get("color_code")


    mock_get.assert_awaited_once_with(id=mock_todo_id, user_id=TEST_USER_ID)
    mock_validate_list.assert_not_awaited() # Crucial: list validation shouldn't run
    mock_update.assert_awaited_once()
    # Verify crud.update was called correctly
    call_args, call_kwargs = mock_update.call_args
    assert call_kwargs['db_obj'].id == mock_todo_id
    assert isinstance(call_kwargs['obj_in'], schemas.todos.TodoUpdate)
    # Ensure the input object passed to crud.update *only* contained title
    assert call_kwargs['obj_in'].model_dump(exclude_unset=True) == {"title": updated_title}

@pytest.mark.asyncio
async def test_delete_todo(client: AsyncClient, monkeypatch):
    """Test DELETE /todos/{todo_id}"""
    mock_todo_id = uuid4()
    existing_db_data = create_mock_db_object_data_todo(id=mock_todo_id)
    mock_remove = AsyncMock(return_value=type('MockDBTodoDelete', (), existing_db_data)()) 
    monkeypatch.setattr(todos_api.CRUDTodo, "remove", mock_remove)

    response = await client.delete(f"{BASE_URL}/{mock_todo_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    expected_response = create_mock_response_data_todo(existing_db_data)
    assert response_data.get("id") == expected_response.get("id")
    assert response_data.get("title") == expected_response.get("title")
    assert response_data.get("user_id") == str(TEST_USER_ID)
    assert response_data.get("list_id") == expected_response.get("list_id")
    assert response_data.get("due_date") == expected_response.get("due_date")
    assert response_data.get("is_completed") == expected_response.get("is_completed")
    mock_remove.assert_awaited_once_with(id=mock_todo_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_delete_todo_not_found(client: AsyncClient, monkeypatch):
    """Test DELETE /todos/{todo_id} for 404"""
    mock_todo_id = uuid4()
    mock_remove = AsyncMock(return_value=None)
    monkeypatch.setattr(todos_api.CRUDTodo, "remove", mock_remove)

    response = await client.delete(f"{BASE_URL}/{mock_todo_id}?user_id={TEST_USER_ID}")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    mock_remove.assert_awaited_once_with(id=mock_todo_id, user_id=TEST_USER_ID)
