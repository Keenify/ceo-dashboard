import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from fastapi import status
import os
import sys
import asyncio
from pathlib import Path
from uuid import UUID, uuid4
from datetime import datetime, timezone
from dotenv import load_dotenv
from typing import AsyncGenerator, List, Optional, Dict, Any
from unittest.mock import AsyncMock
from sqlalchemy import select, delete

# Add the project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.database import AsyncSessionLocal, get_db
from app.crud.bucket_list_items import CRUDBucketListItems
from app.models.bucket_list_items import BucketListItems as BucketListItemsModel
from app.main import app
from app.schemas.bucket_list_items import (
    BucketListItems,
    BucketListItemsCreate,
    BucketListItemsUpdate,
    BucketReorderRequest,
    BucketPositionUpdate
)
from app.api import bucket_list_items

# Load environment variables from .env file
load_dotenv()

# --- Test User ID --- 
TEST_USER_ID_STR = os.getenv("TEST_USER_ID")
if not TEST_USER_ID_STR:
    raise ValueError("TEST_USER_ID environment variable not set or empty")
try:
    TEST_USER_ID = UUID(TEST_USER_ID_STR)
except ValueError:
    raise ValueError(f"Invalid UUID format for TEST_USER_ID: {TEST_USER_ID_STR}")
# --------------------

# Base URL for API endpoints
BASE_URL = "/api"

# --- Database Dependency Override ---
async def override_get_db():
    async with AsyncSessionLocal() as session:
        yield session

# --- Fixture for API Client ---
@pytest_asyncio.fixture(scope="function")
async def client():
    """Provide a test client for making API requests to the app."""
    # Create a fresh FastAPI application for testing
    from fastapi import FastAPI
    test_app = FastAPI()
    
    # Include the bucket list items router directly
    test_app.include_router(
        bucket_list_items.router,
        prefix="/api"
    )
    
    # Override the database dependency
    test_app.dependency_overrides[get_db] = override_get_db
    
    # Use ASGITransport explicitly as per deprecation warning
    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test"
    ) as ac:
        yield ac

# --- Helper Functions ---
def create_mock_bucket_list_item_data(id: UUID, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates mock DB data."""
    base_data = {
        "id": id,
        "user_id": TEST_USER_ID,
        "category": "Travel",
        "items": [
            {"text": "Japan", "completed": False},
            {"text": "Iceland", "completed": True},
            {"text": "New Zealand", "completed": False}
        ],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    if overrides:
        base_data.update(overrides)
    return base_data

def create_bucket_list_item_api_payload(overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Creates API payload."""
    payload = {
        "category": "Travel",
        "items": [
            {"text": "Japan", "completed": False},
            {"text": "Iceland", "completed": True},
            {"text": "New Zealand", "completed": False}
        ],
        "user_id": str(TEST_USER_ID)
    }
    if overrides:
        payload.update(overrides)
    return payload

# --- Test Cases ---
@pytest.mark.asyncio
async def test_create_bucket_list_item(client: AsyncClient, monkeypatch):
    """Test POST /bucket-list-items/ for creating a new bucket list item."""
    bucket_list_item_id = uuid4()
    create_payload = create_bucket_list_item_api_payload()
    
    mock_db_data = create_mock_bucket_list_item_data(id=bucket_list_item_id, overrides={
        "category": create_payload["category"],
        "items": create_payload["items"],
        "user_id": TEST_USER_ID
    })
    
    mock_create = AsyncMock(return_value=type('MockDBBucketListItem', (), mock_db_data)())
    monkeypatch.setattr(bucket_list_items.crud_bucket_list_items, "create_bucket_list_item", mock_create)
    mock_get_by_category = AsyncMock(return_value=None)
    monkeypatch.setattr(bucket_list_items.crud_bucket_list_items, "get_bucket_list_item_by_category", mock_get_by_category)

    response = await client.post(
        f"{BASE_URL}/",
        params={"user_id": TEST_USER_ID},
        json=create_payload
    )

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    assert response_data["id"] == str(bucket_list_item_id)
    assert response_data["user_id"] == str(TEST_USER_ID)
    assert response_data["category"] == create_payload["category"]
    assert response_data["items"] == create_payload["items"]

@pytest.mark.asyncio
async def test_get_bucket_list_item(client: AsyncClient, monkeypatch):
    """Test GET /bucket-list-items/{bucket_list_item_id}."""
    bucket_list_item_id = uuid4()
    mock_db_data = create_mock_bucket_list_item_data(id=bucket_list_item_id)
    mock_get = AsyncMock(return_value=type('MockDBBucketListItem', (), mock_db_data)())
    monkeypatch.setattr(bucket_list_items.crud_bucket_list_items, "get_bucket_list_item", mock_get)

    response = await client.get(
        f"{BASE_URL}/{bucket_list_item_id}",
        params={"user_id": TEST_USER_ID}
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(bucket_list_item_id)
    assert response_data["category"] == "Travel"

@pytest.mark.asyncio
async def test_get_bucket_list_item_by_category(client: AsyncClient, monkeypatch):
    """Test GET /bucket-list-items/by-category/{category}."""
    bucket_list_item_id = uuid4()
    category = "Travel"
    mock_db_data = create_mock_bucket_list_item_data(
        id=bucket_list_item_id,
        overrides={"category": category}
    )
    mock_get_by_category = AsyncMock(return_value=type('MockDBBucketListItem', (), mock_db_data)())
    monkeypatch.setattr(bucket_list_items.crud_bucket_list_items, "get_bucket_list_item_by_category", mock_get_by_category)

    response = await client.get(
        f"{BASE_URL}/by-category/{category}",
        params={"user_id": TEST_USER_ID}
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(bucket_list_item_id)
    assert response_data["category"] == category

@pytest.mark.asyncio
async def test_list_bucket_list_items(client: AsyncClient, monkeypatch):
    """Test GET /bucket-list-items/."""
    bucket_list_item_id1 = uuid4()
    bucket_list_item_id2 = uuid4()
    mock_db_list = [
        type('MockDBBucketListItem', (), create_mock_bucket_list_item_data(
            id=bucket_list_item_id1,
            overrides={"category": "Travel"}
        ))(),
        type('MockDBBucketListItem', (), create_mock_bucket_list_item_data(
            id=bucket_list_item_id2,
            overrides={"category": "Books", "items": [
                {"text": "1984", "completed": True},
                {"text": "The Alchemist", "completed": False}
            ]}
        ))()
    ]
    mock_get_multi = AsyncMock(return_value=mock_db_list)
    monkeypatch.setattr(bucket_list_items.crud_bucket_list_items, "get_bucket_list_items", mock_get_multi)

    response = await client.get(
        f"{BASE_URL}/",
        params={
            "user_id": TEST_USER_ID,
            "skip": 0,
            "limit": 10
        }
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert len(response_data) == 2
    assert response_data[0]["category"] == "Travel"
    assert response_data[1]["category"] == "Books"

@pytest.mark.asyncio
async def test_update_bucket_list_item(client: AsyncClient, monkeypatch):
    """Test PUT /bucket-list-items/{bucket_list_item_id}."""
    bucket_list_item_id = uuid4()
    update_payload = {
        "category": "Adventure Travel",
        "items": {
            "items": ["Japan", "Iceland", "New Zealand", "Norway"],
            "completed": ["Iceland", "Norway"]
        }
    }
    
    mock_db_data = create_mock_bucket_list_item_data(id=bucket_list_item_id)
    mock_get = AsyncMock(return_value=type('MockDBBucketListItem', (), mock_db_data)())
    monkeypatch.setattr(bucket_list_items.crud_bucket_list_items, "get_bucket_list_item", mock_get)
    
    mock_update = AsyncMock(return_value=type('MockDBBucketListItem', (), {**mock_db_data, **update_payload})())
    monkeypatch.setattr(bucket_list_items.crud_bucket_list_items, "update_bucket_list_item", mock_update)

    response = await client.put(
        f"{BASE_URL}/{bucket_list_item_id}",
        params={"user_id": TEST_USER_ID},
        json=update_payload
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["category"] == "Adventure Travel"

@pytest.mark.asyncio
async def test_delete_bucket_list_item(client: AsyncClient, monkeypatch):
    """Test DELETE /bucket-list-items/{bucket_list_item_id}."""
    bucket_list_item_id = uuid4()
    mock_db_data = create_mock_bucket_list_item_data(id=bucket_list_item_id)
    
    mock_get = AsyncMock(return_value=type('MockDBBucketListItem', (), mock_db_data)())
    monkeypatch.setattr(bucket_list_items.crud_bucket_list_items, "get_bucket_list_item", mock_get)
    
    mock_delete = AsyncMock(return_value=type('MockDBBucketListItem', (), mock_db_data)())
    monkeypatch.setattr(bucket_list_items.crud_bucket_list_items, "delete_bucket_list_item", mock_delete)

    response = await client.delete(
        f"{BASE_URL}/{bucket_list_item_id}",
        params={"user_id": TEST_USER_ID}
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["id"] == str(bucket_list_item_id)

@pytest.mark.asyncio
async def test_create_bucket_list_item_duplicate_category(client: AsyncClient, monkeypatch):
    """Test POST /bucket-list-items/ with duplicate category."""
    create_payload = create_bucket_list_item_api_payload()
    
    # Create a mock existing item with the same category
    mock_existing = AsyncMock(return_value=type('MockDBBucketListItem', (), create_mock_bucket_list_item_data(
        id=uuid4(),
        overrides={"category": create_payload["category"]}
    ))())
    
    # Mock the get_bucket_list_item_by_category to return the existing item
    monkeypatch.setattr(
        bucket_list_items.crud_bucket_list_items,
        "get_bucket_list_item_by_category",
        AsyncMock(return_value=mock_existing.return_value)
    )
    
    response = await client.post(
        f"{BASE_URL}/",
        params={"user_id": TEST_USER_ID},
        json=create_payload
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    response_data = response.json()
    assert "already exists" in response_data["detail"]
    assert create_payload["category"] in response_data["detail"]

@pytest.mark.asyncio
async def test_get_bucket_list_item_not_found(client: AsyncClient, monkeypatch):
    """Test GET /bucket-list-items/{bucket_list_item_id} with non-existent ID."""
    bucket_list_item_id = uuid4()
    mock_get = AsyncMock(return_value=None)
    monkeypatch.setattr(bucket_list_items.crud_bucket_list_items, "get_bucket_list_item", mock_get)

    response = await client.get(
        f"{BASE_URL}/{bucket_list_item_id}",
        params={"user_id": TEST_USER_ID}
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    response_data = response.json()
    assert "not found" in response_data["detail"]

@pytest.mark.asyncio
async def test_get_bucket_list_item_wrong_user(client: AsyncClient, monkeypatch):
    """Test GET /bucket-list-items/{bucket_list_item_id} with wrong user."""
    bucket_list_item_id = uuid4()
    different_user_id = uuid4()
    mock_db_data = create_mock_bucket_list_item_data(
        id=bucket_list_item_id,
        overrides={"user_id": different_user_id}
    )
    mock_get = AsyncMock(return_value=type('MockDBBucketListItem', (), mock_db_data)())
    monkeypatch.setattr(bucket_list_items.crud_bucket_list_items, "get_bucket_list_item", mock_get)

    response = await client.get(
        f"{BASE_URL}/{bucket_list_item_id}",
        params={"user_id": TEST_USER_ID}
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    response_data = response.json()
    assert "not found" in response_data["detail"]

@pytest.mark.asyncio
async def test_get_bucket_list_item_by_category_not_found(client: AsyncClient, monkeypatch):
    """Test GET /bucket-list-items/by-category/{category} with non-existent category."""
    category = "NonExistentCategory"
    mock_get_by_category = AsyncMock(return_value=None)
    monkeypatch.setattr(bucket_list_items.crud_bucket_list_items, "get_bucket_list_item_by_category", mock_get_by_category)

    response = await client.get(
        f"{BASE_URL}/by-category/{category}",
        params={"user_id": TEST_USER_ID}
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    response_data = response.json()
    assert "not found" in response_data["detail"]
    assert category in response_data["detail"]

@pytest.mark.asyncio
async def test_update_bucket_list_item_not_found(client: AsyncClient, monkeypatch):
    """Test PUT /bucket-list-items/{bucket_list_item_id} with non-existent ID."""
    bucket_list_item_id = uuid4()
    update_payload = {"category": "Updated Category"}
    
    mock_get = AsyncMock(return_value=None)
    monkeypatch.setattr(bucket_list_items.crud_bucket_list_items, "get_bucket_list_item", mock_get)

    response = await client.put(
        f"{BASE_URL}/{bucket_list_item_id}",
        params={"user_id": TEST_USER_ID},
        json=update_payload
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    response_data = response.json()
    assert "not found" in response_data["detail"]

@pytest.mark.asyncio
async def test_delete_bucket_list_item_not_found(client: AsyncClient, monkeypatch):
    """Test DELETE /bucket-list-items/{bucket_list_item_id} with non-existent ID."""
    bucket_list_item_id = uuid4()
    
    mock_get = AsyncMock(return_value=None)
    monkeypatch.setattr(bucket_list_items.crud_bucket_list_items, "get_bucket_list_item", mock_get)

    response = await client.delete(
        f"{BASE_URL}/{bucket_list_item_id}",
        params={"user_id": TEST_USER_ID}
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    response_data = response.json()
    assert "not found" in response_data["detail"]

@pytest.mark.asyncio
async def test_create_bucket_list_item_books_category(client: AsyncClient, monkeypatch):
    """Test POST /bucket-list-items/ for creating a Books category."""
    bucket_list_item_id = uuid4()
    create_payload = create_bucket_list_item_api_payload(overrides={
        "category": "Books",
        "items": [
            {"text": "1984", "completed": False},
            {"text": "Rich Dad Poor Dad", "completed": True},
            {"text": "The Alchemist", "completed": False}
        ]
    })
    
    mock_db_data = create_mock_bucket_list_item_data(id=bucket_list_item_id, overrides={
        "category": create_payload["category"],
        "items": create_payload["items"],
        "user_id": TEST_USER_ID
    })
    
    mock_create = AsyncMock(return_value=type('MockDBBucketListItem', (), mock_db_data)())
    monkeypatch.setattr(bucket_list_items.crud_bucket_list_items, "create_bucket_list_item", mock_create)
    mock_get_by_category = AsyncMock(return_value=None)
    monkeypatch.setattr(bucket_list_items.crud_bucket_list_items, "get_bucket_list_item_by_category", mock_get_by_category)

    response = await client.post(
        f"{BASE_URL}/",
        params={"user_id": TEST_USER_ID},
        json=create_payload
    )

    assert response.status_code == status.HTTP_201_CREATED
    response_data = response.json()
    assert response_data["category"] == "Books"
    assert any(item["text"] == "1984" for item in response_data["items"])
    assert any(item["text"] == "Rich Dad Poor Dad" and item["completed"] for item in response_data["items"])

# --- Bucket Positioning Tests ---

@pytest.mark.asyncio
async def test_auto_position_assignment_on_create():
    """Test that new buckets get automatically assigned the next available position."""
    async with AsyncSessionLocal() as db:
        crud = CRUDBucketListItems(db)
        
        # Clean up existing test data
        await cleanup_test_data(db)
        
        # Create first bucket - should get position 0
        bucket1_data = BucketListItemsCreate(
            category="Travel",
            items=[{"text": "Visit Japan", "completed": False}]
        )
        bucket1 = await crud.create_bucket_list_item(
            bucket_list_item=bucket1_data, 
            user_id=TEST_USER_ID
        )
        assert bucket1.sort_order == 0
        
        # Create second bucket - should get position 1
        bucket2_data = BucketListItemsCreate(
            category="Books", 
            items=[{"text": "Read 1984", "completed": False}]
        )
        bucket2 = await crud.create_bucket_list_item(
            bucket_list_item=bucket2_data,
            user_id=TEST_USER_ID
        )
        assert bucket2.sort_order == 1
        
        # Create third bucket - should get position 2
        bucket3_data = BucketListItemsCreate(
            category="Health",
            items=[{"text": "Run marathon", "completed": False}]
        )
        bucket3 = await crud.create_bucket_list_item(
            bucket_list_item=bucket3_data,
            user_id=TEST_USER_ID
        )
        assert bucket3.sort_order == 2
        
        print(f"✅ Auto-position assignment test passed: {bucket1.sort_order}, {bucket2.sort_order}, {bucket3.sort_order}")

@pytest.mark.asyncio
async def test_get_buckets_returns_sorted_by_position():
    """Test that get_bucket_list_items returns buckets sorted by sort_order."""
    async with AsyncSessionLocal() as db:
        crud = CRUDBucketListItems(db)
        
        # Get all buckets for user
        buckets = await crud.get_bucket_list_items(user_id=TEST_USER_ID)
        
        # Verify they are sorted by sort_order
        previous_order = -1
        for bucket in buckets:
            assert bucket.sort_order >= previous_order, f"Buckets not sorted: {bucket.sort_order} < {previous_order}"
            previous_order = bucket.sort_order
            
        print(f"✅ Bucket sorting test passed: Found {len(buckets)} buckets in correct order")

@pytest.mark.asyncio
async def test_reorder_bucket_positions():
    """Test reordering buckets by changing their sort_order values."""
    async with AsyncSessionLocal() as db:
        crud = CRUDBucketListItems(db)
        
        # Get existing buckets
        buckets = await crud.get_bucket_list_items(user_id=TEST_USER_ID)
        assert len(buckets) >= 3, "Need at least 3 buckets for reorder test"
        
        # Get the first 3 buckets
        bucket1, bucket2, bucket3 = buckets[0], buckets[1], buckets[2]
        original_order = [bucket1.sort_order, bucket2.sort_order, bucket3.sort_order]
        
        # Reorder: move bucket3 to position 0, bucket1 to position 1, bucket2 to position 2
        new_positions = [
            {"bucket_id": bucket3.id, "sort_order": 0},
            {"bucket_id": bucket1.id, "sort_order": 1}, 
            {"bucket_id": bucket2.id, "sort_order": 2}
        ]
        
        # Perform reorder
        updated_buckets = await crud.reorder_bucket_list_items(
            user_id=TEST_USER_ID,
            bucket_positions=new_positions
        )
        
        assert len(updated_buckets) == 3
        
        # Verify positions were updated
        updated_bucket_map = {bucket.id: bucket.sort_order for bucket in updated_buckets}
        assert updated_bucket_map[bucket3.id] == 0
        assert updated_bucket_map[bucket1.id] == 1
        assert updated_bucket_map[bucket2.id] == 2
        
        # Verify new order is reflected when getting buckets
        reordered_buckets = await crud.get_bucket_list_items(user_id=TEST_USER_ID)
        
        # The first 3 buckets should now be in new order
        assert reordered_buckets[0].id == bucket3.id
        assert reordered_buckets[1].id == bucket1.id  
        assert reordered_buckets[2].id == bucket2.id
        
        print(f"✅ Reorder test passed: {original_order} -> [0, 1, 2]")

@pytest.mark.asyncio
async def test_reorder_api_endpoint(client: AsyncClient):
    """Test the reorder API endpoint."""
    # First, get current buckets to work with
    response = await client.get(
        f"{BASE_URL}/bucket-list-items/",
        params={"user_id": TEST_USER_ID}
    )
    assert response.status_code == status.HTTP_200_OK
    buckets = response.json()
    
    if len(buckets) < 2:
        pytest.skip("Need at least 2 buckets for reorder API test")
    
    # Take first 2 buckets and reverse their order
    bucket1, bucket2 = buckets[0], buckets[1]
    
    reorder_payload = {
        "bucket_positions": [
            {"bucket_id": bucket2["id"], "sort_order": 0},
            {"bucket_id": bucket1["id"], "sort_order": 1}
        ]
    }
    
    # Mock the CRUD reorder method
    mock_updated_buckets = [
        type('MockBucket', (), {
            'id': UUID(bucket2["id"]),
            'category': bucket2["category"], 
            'items': bucket2["items"],
            'sort_order': 0,
            'user_id': TEST_USER_ID,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        })(),
        type('MockBucket', (), {
            'id': UUID(bucket1["id"]),
            'category': bucket1["category"],
            'items': bucket1["items"], 
            'sort_order': 1,
            'user_id': TEST_USER_ID,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        })()
    ]
    
    # Mock the reorder method
    async def mock_reorder(*args, **kwargs):
        return mock_updated_buckets
    
    import pytest
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(bucket_list_items.crud_bucket_list_items, "reorder_bucket_list_items", mock_reorder)
    
    response = await client.put(
        f"{BASE_URL}/bucket-list-items/reorder",
        params={"user_id": TEST_USER_ID},
        json=reorder_payload
    )
    
    assert response.status_code == status.HTTP_200_OK
    updated_buckets = response.json()
    assert len(updated_buckets) == 2
    
    # Verify order in response 
    assert updated_buckets[0]["id"] == bucket2["id"]
    assert updated_buckets[0]["sort_order"] == 0
    assert updated_buckets[1]["id"] == bucket1["id"] 
    assert updated_buckets[1]["sort_order"] == 1
    
    print("✅ Reorder API endpoint test passed")

@pytest.mark.asyncio
async def test_user_isolation_in_positioning():
    """Test that positioning is isolated per user."""
    async with AsyncSessionLocal() as db:
        crud = CRUDBucketListItems(db)
        
        # Create a different test user
        other_user_id = uuid4()
        
        # Create bucket for other user - should start at position 0
        other_bucket_data = BucketListItemsCreate(
            category="Other User Category",
            items=[{"text": "Other user item", "completed": False}]
        )
        other_bucket = await crud.create_bucket_list_item(
            bucket_list_item=other_bucket_data,
            user_id=other_user_id
        )
        assert other_bucket.sort_order == 0
        
        # Get buckets for original user - should still have their positions
        original_user_buckets = await crud.get_bucket_list_items(user_id=TEST_USER_ID)
        
        # Get buckets for other user - should only have 1 bucket at position 0
        other_user_buckets = await crud.get_bucket_list_items(user_id=other_user_id)
        assert len(other_user_buckets) == 1
        assert other_user_buckets[0].sort_order == 0
        assert other_user_buckets[0].id == other_bucket.id
        
        # Clean up other user's data
        await crud.delete_bucket_list_item(bucket_list_item_id=other_bucket.id)
        
        print("✅ User isolation test passed")

# Helper function for cleanup
async def cleanup_test_data(db):
    """Clean up test data before running positioning tests."""
    stmt = delete(BucketListItemsModel).where(BucketListItemsModel.user_id == TEST_USER_ID)
    await db.execute(stmt)
    await db.commit() 