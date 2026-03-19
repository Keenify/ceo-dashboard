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
from app.schemas.networth_entries import (
    NetworthEntryCreate,
    NetworthEntryUpdate,
    NetworthEntryResponse,
    NetworthType,
    NetworthCategory
)
# Import the specific API module to mock its CRUD operations
from app.api import networth_entries as networth_entries_api

# --- Test User ID ---
TEST_USER_ID_STR = os.getenv("TEST_USER_ID")
if not TEST_USER_ID_STR:
    raise ValueError("TEST_USER_ID environment variable not set or empty")
try:
    TEST_USER_ID = UUID(TEST_USER_ID_STR)
except ValueError:
    raise ValueError(f"Invalid UUID format for TEST_USER_ID: {TEST_USER_ID_STR}")
# --------------------

BASE_URL = "/networth-entries" # Matches the prefix in api_router.py

# --- Fixture for API Client ---
@pytest_asyncio.fixture(scope="function")
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Provide a test client for making API requests to the app."""
    transport = ASGITransport(app=app) # type: ignore
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

# --- Helper Function to create mock NetworthEntry data (as dict) ---
def create_mock_networth_entry_dict(
    id: UUID,
    user_id: UUID,
    entry_type: NetworthType,
    category: NetworthCategory,
    section: str,
    snapshot_date: Optional[date] = None,
    name: Optional[str] = None,
    value: Optional[Decimal] = None,
    overrides: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Creates mock data dictionary representing a NetworthEntry DB object attributes."""
    base_data = {
        "id": id,
        "user_id": user_id,
        "type": entry_type,
        "category": category,
        "snapshot_date": snapshot_date if snapshot_date else date.today() - timedelta(days=1),
        "section": section,
        "name": name if name is not None else (f"Mock {category} item" if category == 'asset' else f"Mock {category} item"),
        "value": value if value is not None else (Decimal("1000.00") if category == 'asset' else Decimal("500.00")),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    if overrides:
        for key, val in overrides.items():
            if key == "value" and val is not None:
                base_data[key] = Decimal(val) if not isinstance(val, Decimal) else val
            elif key == "snapshot_date" and val is not None:
                base_data[key] = date.fromisoformat(str(val)) if not isinstance(val, date) else val
            else:
                base_data[key] = val

    # Convert types for final JSON-like dict representation (as would come from DB model)
    final_dict = {}
    for key, val in base_data.items():
        if isinstance(val, Decimal):
            final_dict[key] = str(val)
        elif isinstance(val, datetime):
            final_dict[key] = val.isoformat().replace("+00:00", "Z")
        elif isinstance(val, date):
            final_dict[key] = val.isoformat()
        elif isinstance(val, UUID):
            final_dict[key] = str(val)
        else:
            final_dict[key] = val
    return final_dict

# --- Utility to convert mock data dict back to a mock object ---
def dict_to_mock_networth_object(data: Dict[str, Any]) -> Any:
    """Converts a dictionary (potentially with stringified types) back to a mock object with correct types."""
    typed_data = {}
    for k, v in data.items():
        if v is None:
            typed_data[k] = None
            continue
        if k in ('id', 'user_id'):
            typed_data[k] = UUID(v)
        elif k == 'value':
            typed_data[k] = Decimal(v) if v is not None else None
        elif k == 'snapshot_date':
            typed_data[k] = date.fromisoformat(v)
        elif k in ('created_at', 'updated_at'):
            iso_str = v.replace('Z', '+00:00')
            typed_data[k] = datetime.fromisoformat(iso_str)
        else: # type, category, section, name are likely strings or enums (which are strings)
            typed_data[k] = v
    return type('MockDBNetworthEntry', (), typed_data)()


# --- Test Cases ---

@pytest.mark.asyncio
async def test_create_networth_entry_full(client: AsyncClient, monkeypatch) -> None:
    """Test POST /networth-entries/ for creating a full entry."""
    record_id = uuid4()
    today = date.today()
    post_data = {
        "user_id": str(TEST_USER_ID),
        "type": "personal",
        "category": "asset",
        "snapshot_date": (today - timedelta(days=5)).isoformat(),
        "section": "Bank Accounts",
        "name": "Savings Account",
        "value": "10000.50"
    }
    mock_created_object_attrs = create_mock_networth_entry_dict(
        id=record_id, user_id=TEST_USER_ID, entry_type="personal", category="asset",
        section="Bank Accounts", snapshot_date=today - timedelta(days=5),
        name="Savings Account", value=Decimal("10000.50"),
        overrides=post_data # ensure created_at/updated_at are generated by helper
    )
    mock_created_object = dict_to_mock_networth_object(mock_created_object_attrs)

    mock_create = AsyncMock(return_value=mock_created_object)
    monkeypatch.setattr(networth_entries_api.CRUDNetworthEntry, "create", mock_create)

    response = await client.post(BASE_URL + "/", json=post_data)

    assert response.status_code == status.HTTP_201_CREATED, response.text
    response_data = response.json()
    assert response_data["id"] == str(record_id)
    assert response_data["type"] == "personal"
    assert response_data["category"] == "asset"
    assert response_data["section"] == "Bank Accounts"
    assert response_data["name"] == "Savings Account"
    assert response_data["value"] == "10000.50"

    mock_create.assert_awaited_once()
    call_args, call_kwargs = mock_create.call_args
    assert isinstance(call_kwargs["obj_in"], NetworthEntryCreate)
    assert call_kwargs["obj_in"].value == Decimal("10000.50")

@pytest.mark.asyncio
async def test_create_networth_entry_section_only(client: AsyncClient, monkeypatch) -> None:
    """Test POST /networth-entries/ for creating an entry with only section, type, category, date."""
    record_id = uuid4()
    today = date.today()
    post_data = {
        "user_id": str(TEST_USER_ID),
        "type": "business",
        "category": "liability",
        "snapshot_date": today.isoformat(),
        "section": "Credit Cards",
        # Name and Value are omitted
    }
    mock_created_object_attrs = create_mock_networth_entry_dict(
        id=record_id, user_id=TEST_USER_ID, entry_type="business", category="liability",
        section="Credit Cards", snapshot_date=today,
        name=None, value=None, # Explicitly pass None as per schema
        overrides=post_data
    )
    # Adjust mock_created_object to reflect that Pydantic model will have None for name/value if not provided
    mock_created_object_attrs["name"] = None
    mock_created_object_attrs["value"] = None # Stored as None in DB, will be returned as None
    mock_created_object = dict_to_mock_networth_object(mock_created_object_attrs)


    mock_create = AsyncMock(return_value=mock_created_object)
    monkeypatch.setattr(networth_entries_api.CRUDNetworthEntry, "create", mock_create)

    response = await client.post(BASE_URL + "/", json=post_data)

    assert response.status_code == status.HTTP_201_CREATED, response.text
    response_data = response.json()
    assert response_data["id"] == str(record_id)
    assert response_data["section"] == "Credit Cards"
    assert response_data["name"] is None
    assert response_data["value"] is None

    mock_create.assert_awaited_once()
    call_args, call_kwargs = mock_create.call_args
    assert isinstance(call_kwargs["obj_in"], NetworthEntryCreate)
    assert call_kwargs["obj_in"].name is None
    assert call_kwargs["obj_in"].value is None
    assert call_kwargs["obj_in"].section == "Credit Cards"

@pytest.mark.asyncio
async def test_get_networth_entry(client: AsyncClient, monkeypatch) -> None:
    """Test GET /networth-entries/{entry_id}."""
    record_id = uuid4()
    mock_data_dict = create_mock_networth_entry_dict(id=record_id, user_id=TEST_USER_ID, entry_type='personal', category='asset', section="Real Estate")
    mock_get_return = dict_to_mock_networth_object(mock_data_dict)

    mock_get = AsyncMock(return_value=mock_get_return)
    monkeypatch.setattr(networth_entries_api.CRUDNetworthEntry, "get", mock_get)

    response = await client.get(f"{BASE_URL}/{record_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_200_OK, response.text
    response_data = response.json()
    assert response_data["id"] == str(record_id)
    assert response_data["type"] == mock_data_dict["type"]
    assert response_data["value"] == mock_data_dict["value"]

    mock_get.assert_awaited_once_with(id=record_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_get_networth_entries_paginated(client: AsyncClient, monkeypatch) -> None:
    """Test GET /networth-entries/ without filters, using pagination."""
    id1, id2 = uuid4(), uuid4()
    # Mock data creation needs to be careful about snapshot_date for ordering
    mock_data1_dict = create_mock_networth_entry_dict(id=id1, user_id=TEST_USER_ID, entry_type='personal', category='asset', section="Investments", snapshot_date=date.today() - timedelta(days=2))
    mock_data2_dict = create_mock_networth_entry_dict(id=id2, user_id=TEST_USER_ID, entry_type='personal', category='liability', section="Loans", snapshot_date=date.today() - timedelta(days=1)) # More recent

    mock_obj1 = dict_to_mock_networth_object(mock_data1_dict)
    mock_obj2 = dict_to_mock_networth_object(mock_data2_dict)

    # Simulate ordering: most recent snapshot_date first
    mock_get_multi = AsyncMock(return_value=[mock_obj2, mock_obj1])
    monkeypatch.setattr(networth_entries_api.CRUDNetworthEntry, "get_multi_by_user", mock_get_multi)

    response = await client.get(f"{BASE_URL}/?user_id={TEST_USER_ID}&skip=0&limit=10")

    assert response.status_code == status.HTTP_200_OK, response.text
    response_data = response.json()
    assert len(response_data) == 2
    assert response_data[0]["id"] == str(id2) # mock_obj2 is more recent
    assert response_data[1]["id"] == str(id1)

    mock_get_multi.assert_awaited_once_with(
        user_id=TEST_USER_ID, skip=0, limit=10,
        entry_type=None, category=None, section=None,
        start_date=None, end_date=None, return_all=False
    )

@pytest.mark.asyncio
@pytest.mark.parametrize(
    "query_params, expected_crud_params",
    [
        ("type=personal", {"entry_type": "personal"}),
        ("category=liability", {"category": "liability"}),
        ("section=Bank%20Accounts", {"section": "Bank Accounts"}),
        ("return_all=true", {"return_all": True}),
        ("type=business&category=asset&return_all=true", {"entry_type": "business", "category": "asset", "return_all": True}),
        (f"start_date={(date.today() - timedelta(days=5)).isoformat()}", {"start_date": date.today() - timedelta(days=5)}),
        (f"end_date={date.today().isoformat()}", {"end_date": date.today()}),
        ("limit=5", {"limit": 5}),
    ]
)
async def test_get_networth_entries_with_filters(client: AsyncClient, monkeypatch, query_params, expected_crud_params) -> None:
    """Test GET /networth-entries/ with various filters."""
    mock_get_multi = AsyncMock(return_value=[]) # Return empty list, just check call args
    monkeypatch.setattr(networth_entries_api.CRUDNetworthEntry, "get_multi_by_user", mock_get_multi)

    response = await client.get(f"{BASE_URL}/?user_id={TEST_USER_ID}&{query_params}")
    assert response.status_code == status.HTTP_200_OK, response.text

    # Base expected args, will be updated by expected_crud_params
    expected_call_args = {
        "user_id": TEST_USER_ID, "skip": 0, "limit": 100, # Defaults
        "entry_type": None, "category": None, "section": None,
        "start_date": None, "end_date": None, "return_all": False # Defaults
    }
    expected_call_args.update(expected_crud_params) # Apply specific params for this test case

    mock_get_multi.assert_awaited_once_with(**expected_call_args)


@pytest.mark.asyncio
async def test_update_networth_entry_section(client: AsyncClient, monkeypatch) -> None:
    """Test PUT /networth-entries/{entry_id} to update only the section."""
    record_id = uuid4()
    update_payload = {"section": "Updated Real Estate"}

    mock_initial_dict = create_mock_networth_entry_dict(id=record_id, user_id=TEST_USER_ID, entry_type='personal', category='asset', section="Old Real Estate", name="Primary Home", value=Decimal("500000"))
    mock_get_return = dict_to_mock_networth_object(mock_initial_dict)
    mock_get = AsyncMock(return_value=mock_get_return)
    monkeypatch.setattr(networth_entries_api.CRUDNetworthEntry, "get", mock_get)

    updated_attrs_dict = mock_initial_dict.copy()
    updated_attrs_dict["section"] = update_payload["section"]
    updated_attrs_dict["updated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    mock_update_return = dict_to_mock_networth_object(updated_attrs_dict)

    mock_update = AsyncMock(return_value=mock_update_return)
    monkeypatch.setattr(networth_entries_api.CRUDNetworthEntry, "update", mock_update)

    response = await client.put(f"{BASE_URL}/{record_id}?user_id={TEST_USER_ID}", json=update_payload)

    assert response.status_code == status.HTTP_200_OK, response.text
    response_data = response.json()
    assert response_data["id"] == str(record_id)
    assert response_data["section"] == update_payload["section"]
    assert response_data["name"] == mock_initial_dict["name"] # Unchanged
    assert response_data["value"] == mock_initial_dict["value"] # Unchanged

    mock_get.assert_awaited_once_with(id=record_id, user_id=TEST_USER_ID)
    mock_update.assert_awaited_once()
    call_args, call_kwargs = mock_update.call_args
    assert call_kwargs["db_obj"] == mock_get_return
    assert isinstance(call_kwargs["obj_in"], NetworthEntryUpdate)
    assert call_kwargs["obj_in"].section == update_payload["section"]
    assert call_kwargs["obj_in"].name is None # Only section was in payload

@pytest.mark.asyncio
async def test_update_networth_entry_name_value(client: AsyncClient, monkeypatch) -> None:
    """Test PUT /networth-entries/{entry_id} to update name and value."""
    record_id = uuid4()
    update_payload = {"name": "Updated Investment Account", "value": "12345.67"}

    mock_initial_dict = create_mock_networth_entry_dict(id=record_id, user_id=TEST_USER_ID, entry_type='personal', category='asset', section="Investments", name="Old Investment", value=Decimal("10000.00"))
    mock_get_return = dict_to_mock_networth_object(mock_initial_dict)
    mock_get = AsyncMock(return_value=mock_get_return)
    monkeypatch.setattr(networth_entries_api.CRUDNetworthEntry, "get", mock_get)

    updated_attrs_dict = mock_initial_dict.copy()
    updated_attrs_dict["name"] = update_payload["name"]
    updated_attrs_dict["value"] = update_payload["value"] # String form for dict, Decimal for model
    updated_attrs_dict["updated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    mock_update_return = dict_to_mock_networth_object(updated_attrs_dict)

    mock_update = AsyncMock(return_value=mock_update_return)
    monkeypatch.setattr(networth_entries_api.CRUDNetworthEntry, "update", mock_update)

    response = await client.put(f"{BASE_URL}/{record_id}?user_id={TEST_USER_ID}", json=update_payload)

    assert response.status_code == status.HTTP_200_OK, response.text
    response_data = response.json()
    assert response_data["name"] == update_payload["name"]
    assert response_data["value"] == update_payload["value"]
    assert response_data["section"] == mock_initial_dict["section"] # Unchanged

    mock_get.assert_awaited_once_with(id=record_id, user_id=TEST_USER_ID)
    mock_update.assert_awaited_once()
    call_args, call_kwargs = mock_update.call_args
    assert isinstance(call_kwargs["obj_in"], NetworthEntryUpdate)
    assert call_kwargs["obj_in"].name == update_payload["name"]
    assert call_kwargs["obj_in"].value == Decimal(update_payload["value"])
    assert call_kwargs["obj_in"].section is None # Not in payload

@pytest.mark.asyncio
async def test_delete_networth_entry(client: AsyncClient, monkeypatch) -> None:
    """Test DELETE /networth-entries/{entry_id}."""
    record_id = uuid4()

    mock_data_dict = create_mock_networth_entry_dict(id=record_id, user_id=TEST_USER_ID, entry_type='business', category='liability', section="Office Lease")
    mock_get_return = dict_to_mock_networth_object(mock_data_dict) # Used by API to pre-fetch
    mock_remove_return = dict_to_mock_networth_object(mock_data_dict) # CRUD remove returns deleted obj

    mock_get = AsyncMock(return_value=mock_get_return)
    monkeypatch.setattr(networth_entries_api.CRUDNetworthEntry, "get", mock_get)

    mock_remove = AsyncMock(return_value=mock_remove_return)
    monkeypatch.setattr(networth_entries_api.CRUDNetworthEntry, "remove", mock_remove)

    response = await client.delete(f"{BASE_URL}/{record_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_204_NO_CONTENT, response.text
    # GET is called by the API endpoint before calling remove
    mock_get.assert_awaited_once_with(id=record_id, user_id=TEST_USER_ID)
    mock_remove.assert_awaited_once_with(id=record_id, user_id=TEST_USER_ID)

# --- Test Not Found Cases ---

@pytest.mark.asyncio
async def test_get_networth_entry_not_found(client: AsyncClient, monkeypatch) -> None:
    """Test GET /networth-entries/{entry_id} when record doesn't exist."""
    record_id = uuid4()
    mock_get = AsyncMock(return_value=None)
    monkeypatch.setattr(networth_entries_api.CRUDNetworthEntry, "get", mock_get)

    response = await client.get(f"{BASE_URL}/{record_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_404_NOT_FOUND, response.text
    mock_get.assert_awaited_once_with(id=record_id, user_id=TEST_USER_ID)

@pytest.mark.asyncio
async def test_update_networth_entry_not_found(client: AsyncClient, monkeypatch) -> None:
    """Test PUT /networth-entries/{entry_id} when record doesn't exist."""
    record_id = uuid4()
    update_payload = {"section": "Does not matter"}
    mock_get = AsyncMock(return_value=None) # Simulate get returning None
    monkeypatch.setattr(networth_entries_api.CRUDNetworthEntry, "get", mock_get)
    mock_update = AsyncMock() # This should not be called
    monkeypatch.setattr(networth_entries_api.CRUDNetworthEntry, "update", mock_update)

    response = await client.put(f"{BASE_URL}/{record_id}?user_id={TEST_USER_ID}", json=update_payload)

    assert response.status_code == status.HTTP_404_NOT_FOUND, response.text
    mock_get.assert_awaited_once_with(id=record_id, user_id=TEST_USER_ID)
    mock_update.assert_not_awaited()

@pytest.mark.asyncio
async def test_delete_networth_entry_not_found(client: AsyncClient, monkeypatch) -> None:
    """Test DELETE /networth-entries/{entry_id} when record doesn't exist."""
    record_id = uuid4()
    mock_get = AsyncMock(return_value=None) # Simulate get returning None
    monkeypatch.setattr(networth_entries_api.CRUDNetworthEntry, "get", mock_get)
    mock_remove = AsyncMock() # This should not be called
    monkeypatch.setattr(networth_entries_api.CRUDNetworthEntry, "remove", mock_remove)

    response = await client.delete(f"{BASE_URL}/{record_id}?user_id={TEST_USER_ID}")

    assert response.status_code == status.HTTP_404_NOT_FOUND, response.text
    mock_get.assert_awaited_once_with(id=record_id, user_id=TEST_USER_ID)
    mock_remove.assert_not_awaited()

@pytest.mark.asyncio
async def test_create_networth_entry_invalid_type(client: AsyncClient, monkeypatch) -> None:
    """Test POST /networth-entries/ with invalid 'type' enum."""
    post_data = {
        "user_id": str(TEST_USER_ID),
        "type": "invalid_type", # Invalid enum
        "category": "asset",
        "snapshot_date": date.today().isoformat(),
        "section": "Test Section"
    }
    # No need to mock CRUD here as Pydantic validation should catch this first in the API layer.
    # However, if CRUD handles it, the mock setup would be similar to successful creates.

    response = await client.post(BASE_URL + "/", json=post_data)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY # FastAPI's validation error
    response_data = response.json()
    assert "detail" in response_data
    assert any("Input should be 'personal' or 'business'" in err["msg"] for err in response_data["detail"] if err["loc"] == ["body", "type"])


@pytest.mark.asyncio
async def test_create_networth_entry_missing_required_field(client: AsyncClient, monkeypatch) -> None:
    """Test POST /networth-entries/ missing a required field like 'section'."""
    post_data = {
        "user_id": str(TEST_USER_ID),
        "type": "personal",
        "category": "asset",
        "snapshot_date": date.today().isoformat(),
        # "section": "This is missing"
    }
    response = await client.post(BASE_URL + "/", json=post_data)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    response_data = response.json()
    assert "detail" in response_data
    assert any(err["type"] == "missing" and err["loc"] == ["body", "section"] for err in response_data["detail"])

@pytest.mark.asyncio
async def test_bulk_delete_networth_entries_by_name_and_section(client: AsyncClient, monkeypatch) -> None:
    """Test DELETE /networth-entries/bulk-delete-by-name-section."""
    from uuid import uuid4
    from datetime import date
    from decimal import Decimal
    # Setup test data
    record_id1 = uuid4()
    record_id2 = uuid4()
    test_name = "BulkDeleteTestItem"
    test_section = "BulkDeleteTestSection"
    today = date.today()
    # Mock get_multi_by_user to return two entries before deletion, none after
    mock_entry1 = dict_to_mock_networth_object(create_mock_networth_entry_dict(
        id=record_id1, user_id=TEST_USER_ID, entry_type="personal", category="asset",
        section=test_section, name=test_name, snapshot_date=today, value=Decimal("100.00")
    ))
    mock_entry2 = dict_to_mock_networth_object(create_mock_networth_entry_dict(
        id=record_id2, user_id=TEST_USER_ID, entry_type="personal", category="asset",
        section=test_section, name=test_name, snapshot_date=today, value=Decimal("200.00")
    ))
    # Mock remove_all_by_name_and_section to return 2
    mock_remove_all = AsyncMock(return_value=2)
    monkeypatch.setattr(networth_entries_api.CRUDNetworthEntry, "remove_all_by_name_and_section", mock_remove_all)
    # Call the endpoint
    response = await client.delete(
        f"{BASE_URL}/bulk-delete-by-name-section",
        params={"user_id": str(TEST_USER_ID), "name": test_name, "section": test_section}
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert "deleted_count" in data
    assert data["deleted_count"] >= 2
    mock_remove_all.assert_awaited_once_with(user_id=TEST_USER_ID, name=test_name, section=test_section)

@pytest.mark.asyncio
async def test_bulk_delete_networth_entries_by_section(client: AsyncClient, monkeypatch) -> None:
    """Test DELETE /networth-entries/bulk-delete-by-section."""
    from uuid import uuid4
    from datetime import date
    from decimal import Decimal
    # Setup test data
    record_id1 = uuid4()
    record_id2 = uuid4()
    record_id3 = uuid4()
    test_section = "BulkDeleteSectionTest"
    test_type = "personal"
    test_category = "asset"
    today = date.today()
    # Mock multiple entries in the same section with different names
    mock_entry1 = dict_to_mock_networth_object(create_mock_networth_entry_dict(
        id=record_id1, user_id=TEST_USER_ID, entry_type=test_type, category=test_category,
        section=test_section, name="Item1", snapshot_date=today, value=Decimal("100.00")
    ))
    mock_entry2 = dict_to_mock_networth_object(create_mock_networth_entry_dict(
        id=record_id2, user_id=TEST_USER_ID, entry_type=test_type, category=test_category,
        section=test_section, name="Item2", snapshot_date=today, value=Decimal("200.00")
    ))
    mock_entry3 = dict_to_mock_networth_object(create_mock_networth_entry_dict(
        id=record_id3, user_id=TEST_USER_ID, entry_type=test_type, category=test_category,
        section=test_section, name="Item3", snapshot_date=today, value=Decimal("300.00")
    ))
    # Mock remove_all_by_section to return 3 (all items in section)
    mock_remove_all_section = AsyncMock(return_value=3)
    monkeypatch.setattr(networth_entries_api.CRUDNetworthEntry, "remove_all_by_section", mock_remove_all_section)
    # Call the endpoint
    response = await client.delete(
        f"{BASE_URL}/bulk-delete-by-section",
        params={
            "user_id": str(TEST_USER_ID), 
            "section": test_section, 
            "entry_type": test_type, 
            "entry_category": test_category
        }
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert "deleted_count" in data
    assert data["deleted_count"] == 3
    assert data["section"] == test_section
    assert data["entry_type"] == test_type
    assert data["entry_category"] == test_category
    mock_remove_all_section.assert_awaited_once_with(
        user_id=TEST_USER_ID, 
        section=test_section, 
        entry_type=test_type, 
        entry_category=test_category
    )


