import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from fastapi import status
import os
import sys
from pathlib import Path
from uuid import UUID, uuid4
from datetime import date, datetime, timezone
from dotenv import load_dotenv
from typing import AsyncGenerator, List, Optional, Dict, Any
from unittest.mock import AsyncMock, patch

# --- Add project root to sys.path --- 
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
# -------------------------------------

# Load environment variables from .env file
load_dotenv()

# Import app and schemas
from app.main import app
from app.schemas.five_percent_reviews import (
    FivePercentReviewCreate,
    FivePercentReviewUpdate,
    FivePercentReviewResponse
)
from app.api import five_percent_reviews as five_percent_reviews_api

# --- Test User ID --- 
TEST_USER_ID = uuid4()  # Generate a random UUID for testing
# --------------------

BASE_URL = "/five-percent-reviews"

# --- Fixture for API Client ---
@pytest_asyncio.fixture(scope="function")
async def client():
    """Provide a test client for making API requests to the app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

# --- Helper Functions ---
def create_mock_five_percent_review_data(id: UUID, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    base_data = {
        "id": id,
        "user_id": TEST_USER_ID,
        "review_date": date.today().isoformat(),
        "work_feelings": "Test work feelings",
        "work_headline": "Test work headline", 
        "work_significance": "Test work significance",
        "family_feelings": "Test family feelings",
        "family_headline": "Test family headline",
        "family_significance": "Test family significance",
        "personal_feelings": "Test personal feelings",
        "personal_headline": "Test personal headline",
        "personal_significance": "Test personal significance",
        "next_30_60": "Test next 30-60 days plans",
        "challenge_or_opportunity": "Test challenge or opportunity",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    if overrides:
        base_data.update(overrides)
    return base_data

# --- Test Cases ---
@pytest.mark.asyncio
async def test_create_five_percent_review(client: AsyncClient):
    """Test POST /five-percent-reviews/ for creating a new five percent review."""
    review_id = uuid4()
    current_time = datetime.now(timezone.utc)
    review_data = {
        "user_id": str(TEST_USER_ID),
        "review_date": date.today().isoformat(),
        "work_feelings": "Test work feelings",
        "work_headline": "Test work headline",
        "work_significance": "Test work significance",
        "family_feelings": "Test family feelings",
        "family_headline": "Test family headline",
        "family_significance": "Test family significance",
        "personal_feelings": "Test personal feelings",
        "personal_headline": "Test personal headline",
        "personal_significance": "Test personal significance",
        "next_30_60": "Test next 30-60 days plans",
        "challenge_or_opportunity": "Test challenge or opportunity"
    }
    
    # Mock the database session
    mock_db = AsyncMock()
    mock_db.add = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()
    
    # Create a mock review object with all required fields
    mock_review = {
        'id': review_id,
        'user_id': TEST_USER_ID,
        'review_date': date.today(),
        'work_feelings': "Test work feelings",
        'work_headline': "Test work headline",
        'work_significance': "Test work significance",
        'family_feelings': "Test family feelings",
        'family_headline': "Test family headline",
        'family_significance': "Test family significance",
        'personal_feelings': "Test personal feelings",
        'personal_headline': "Test personal headline",
        'personal_significance': "Test personal significance",
        'next_30_60': "Test next 30-60 days plans",
        'challenge_or_opportunity': "Test challenge or opportunity",
        'created_at': current_time,
        'updated_at': current_time
    }
    
    # Mock the CRUD operations
    with patch('app.api.five_percent_reviews.get_db', return_value=mock_db), \
         patch('app.crud.five_percent_reviews.CRUDFivePercentReview.create', return_value=mock_review):
        
        response = await client.post(BASE_URL + "/", json=review_data)
        
        assert response.status_code == status.HTTP_201_CREATED
        response_data = response.json()
        assert response_data["id"] == str(review_id)
        assert response_data["user_id"] == str(TEST_USER_ID)
        assert response_data["work_feelings"] == "Test work feelings"
        assert response_data["work_headline"] == "Test work headline"
        assert response_data["work_significance"] == "Test work significance"
        assert response_data["family_feelings"] == "Test family feelings"
        assert response_data["family_headline"] == "Test family headline"
        assert response_data["family_significance"] == "Test family significance"
        assert response_data["personal_feelings"] == "Test personal feelings"
        assert response_data["personal_headline"] == "Test personal headline"
        assert response_data["personal_significance"] == "Test personal significance"
        assert response_data["next_30_60"] == "Test next 30-60 days plans"
        assert response_data["challenge_or_opportunity"] == "Test challenge or opportunity"
        assert "created_at" in response_data
        assert "updated_at" in response_data

@pytest.mark.asyncio
async def test_get_five_percent_review(client: AsyncClient):
    """Test GET /five-percent-reviews/{five_percent_review_id}."""
    review_id = uuid4()
    mock_review = type('MockReview', (), create_mock_five_percent_review_data(id=review_id))()
    
    with patch('app.api.five_percent_reviews.get_db', return_value=AsyncMock()), \
         patch('app.crud.five_percent_reviews.CRUDFivePercentReview.get', return_value=mock_review):
        
        response = await client.get(f"{BASE_URL}/{review_id}?user_id={TEST_USER_ID}")
        
        assert response.status_code == status.HTTP_200_OK
        response_data = response.json()
        assert response_data["id"] == str(review_id)
        assert response_data["user_id"] == str(TEST_USER_ID)

@pytest.mark.asyncio
async def test_get_five_percent_reviews(client: AsyncClient):
    """Test GET /five-percent-reviews/ for listing all five percent reviews."""
    review_id1 = uuid4()
    review_id2 = uuid4()
    mock_reviews = [
        type('MockReview', (), create_mock_five_percent_review_data(id=review_id1))(),
        type('MockReview', (), create_mock_five_percent_review_data(id=review_id2, overrides={"work_feelings": "Another feelings"}))()
    ]
    
    with patch('app.api.five_percent_reviews.get_db', return_value=AsyncMock()), \
         patch('app.crud.five_percent_reviews.CRUDFivePercentReview.get_multi_by_user', return_value=mock_reviews):
        
        response = await client.get(f"{BASE_URL}/?user_id={TEST_USER_ID}&limit=10")
        
        assert response.status_code == status.HTTP_200_OK
        response_data = response.json()
        assert len(response_data) == 2
        assert response_data[0]["id"] == str(review_id1)
        assert response_data[1]["work_feelings"] == "Another feelings"

@pytest.mark.asyncio
async def test_update_five_percent_review(client: AsyncClient):
    """Test PUT /five-percent-reviews/{five_percent_review_id}."""
    review_id = uuid4()
    update_data = {
        "work_feelings": "Updated feelings",
        "next_30_60": "Updated next 30-60 days plans"
    }
    mock_review = type('MockReview', (), create_mock_five_percent_review_data(id=review_id))()
    updated_review = type('MockReview', (), {**create_mock_five_percent_review_data(id=review_id), **update_data})()
    
    with patch('app.api.five_percent_reviews.get_db', return_value=AsyncMock()), \
         patch('app.crud.five_percent_reviews.CRUDFivePercentReview.get', return_value=mock_review), \
         patch('app.crud.five_percent_reviews.CRUDFivePercentReview.update', return_value=updated_review):
        
        response = await client.put(
            f"{BASE_URL}/{review_id}?user_id={TEST_USER_ID}",
            json=update_data
        )
        
        assert response.status_code == status.HTTP_200_OK
        response_data = response.json()
        assert response_data["work_feelings"] == update_data["work_feelings"]
        assert response_data["next_30_60"] == update_data["next_30_60"]

@pytest.mark.asyncio
async def test_delete_five_percent_review(client: AsyncClient):
    """Test DELETE /five-percent-reviews/{five_percent_review_id}."""
    review_id = uuid4()
    mock_review = type('MockReview', (), create_mock_five_percent_review_data(id=review_id))()
    
    with patch('app.api.five_percent_reviews.get_db', return_value=AsyncMock()), \
         patch('app.crud.five_percent_reviews.CRUDFivePercentReview.get', return_value=mock_review), \
         patch('app.crud.five_percent_reviews.CRUDFivePercentReview.remove', return_value=None):
        
        response = await client.delete(f"{BASE_URL}/{review_id}?user_id={TEST_USER_ID}")
        
        assert response.status_code == status.HTTP_204_NO_CONTENT 