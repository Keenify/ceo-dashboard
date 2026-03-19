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
from app.schemas.future_letters import (
    FutureLetterCreate,
    FutureLetterUpdate,
    FutureLetterResponse
)
from app.api import future_letters as future_letters_api

# --- Test User ID --- 
TEST_USER_ID = uuid4()  # Generate a random UUID for testing
# --------------------

BASE_URL = "/future-letters"

# --- Fixture for API Client ---
@pytest_asyncio.fixture(scope="function")
async def client():
    """Provide a test client for making API requests to the app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

# --- Helper Functions ---
def create_mock_future_letter_data(id: UUID, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    base_data = {
        "id": id,
        "user_id": TEST_USER_ID,
        "recipient_email": "future@example.com",
        "email_subject": "Letter to my future self",
        "email_content": "Dear Future Me, This is a test letter to my future self.",
        "attachment_urls": ["https://example.com/file1.pdf", "https://example.com/file2.jpg"],
        "send_date": date.today().isoformat(),
        "send_status": "scheduled",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    if overrides:
        base_data.update(overrides)
    return base_data

# --- Test Cases ---
@pytest.mark.asyncio
async def test_create_future_letter(client: AsyncClient):
    """Test POST /future-letters/ for creating a new future letter."""
    letter_id = uuid4()
    current_time = datetime.now(timezone.utc)
    letter_data = {
        "user_id": str(TEST_USER_ID),
        "recipient_email": "future@example.com",
        "email_subject": "Letter to my future self",
        "email_content": "Dear Future Me, This is a test letter to my future self.",
        "attachment_urls": ["https://example.com/file1.pdf", "https://example.com/file2.jpg"],
        "send_date": date.today().isoformat(),
        "send_status": "scheduled"
    }
    
    # Mock the database session
    mock_db = AsyncMock()
    mock_db.add = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()
    
    # Create a mock letter object with all required fields
    mock_letter = {
        'id': letter_id,
        'user_id': TEST_USER_ID,
        'recipient_email': "future@example.com",
        'email_subject': "Letter to my future self",
        'email_content': "Dear Future Me, This is a test letter to my future self.",
        'attachment_urls': ["https://example.com/file1.pdf", "https://example.com/file2.jpg"],
        'send_date': date.today(),
        'send_status': "scheduled",
        'created_at': current_time,
        'updated_at': current_time
    }
    
    # Mock the CRUD operations
    with patch('app.api.future_letters.get_db', return_value=mock_db), \
         patch('app.crud.future_letters.CRUDFutureLetter.create', return_value=mock_letter):
        
        response = await client.post(BASE_URL + "/", json=letter_data)
        
        assert response.status_code == status.HTTP_201_CREATED
        response_data = response.json()
        assert response_data["id"] == str(letter_id)
        assert response_data["user_id"] == str(TEST_USER_ID)
        assert response_data["recipient_email"] == "future@example.com"
        assert "created_at" in response_data
        assert "updated_at" in response_data

@pytest.mark.asyncio
async def test_get_future_letter(client: AsyncClient):
    """Test GET /future-letters/{future_letter_id}."""
    letter_id = uuid4()
    mock_letter = type('MockLetter', (), create_mock_future_letter_data(id=letter_id))()
    
    with patch('app.api.future_letters.get_db', return_value=AsyncMock()), \
         patch('app.crud.future_letters.CRUDFutureLetter.get', return_value=mock_letter):
        
        response = await client.get(f"{BASE_URL}/{letter_id}?user_id={TEST_USER_ID}")
        
        assert response.status_code == status.HTTP_200_OK
        response_data = response.json()
        assert response_data["id"] == str(letter_id)
        assert response_data["user_id"] == str(TEST_USER_ID)

@pytest.mark.asyncio
async def test_get_future_letters(client: AsyncClient):
    """Test GET /future-letters/ for listing all future letters."""
    letter_id1 = uuid4()
    letter_id2 = uuid4()
    mock_letters = [
        type('MockLetter', (), create_mock_future_letter_data(id=letter_id1))(),
        type('MockLetter', (), create_mock_future_letter_data(id=letter_id2, overrides={"email_subject": "Another letter"}))()
    ]
    
    with patch('app.api.future_letters.get_db', return_value=AsyncMock()), \
         patch('app.crud.future_letters.CRUDFutureLetter.get_multi_by_user', return_value=mock_letters):
        
        response = await client.get(f"{BASE_URL}/?user_id={TEST_USER_ID}&limit=10")
        
        assert response.status_code == status.HTTP_200_OK
        response_data = response.json()
        assert len(response_data) == 2
        assert response_data[0]["id"] == str(letter_id1)
        assert response_data[1]["email_subject"] == "Another letter"

@pytest.mark.asyncio
async def test_update_future_letter(client: AsyncClient):
    """Test PUT /future-letters/{future_letter_id}."""
    letter_id = uuid4()
    update_data = {
        "email_subject": "Updated subject"
    }
    mock_letter = type('MockLetter', (), create_mock_future_letter_data(id=letter_id))()
    updated_letter = type('MockLetter', (), {**create_mock_future_letter_data(id=letter_id), **update_data})()
    
    with patch('app.api.future_letters.get_db', return_value=AsyncMock()), \
         patch('app.crud.future_letters.CRUDFutureLetter.get', return_value=mock_letter), \
         patch('app.crud.future_letters.CRUDFutureLetter.update', return_value=updated_letter):
        
        response = await client.put(
            f"{BASE_URL}/{letter_id}?user_id={TEST_USER_ID}",
            json=update_data
        )
        
        assert response.status_code == status.HTTP_200_OK
        response_data = response.json()
        assert response_data["email_subject"] == update_data["email_subject"]

@pytest.mark.asyncio
async def test_delete_future_letter(client: AsyncClient):
    """Test DELETE /future-letters/{future_letter_id}."""
    letter_id = uuid4()
    mock_letter = type('MockLetter', (), create_mock_future_letter_data(id=letter_id))()
    
    with patch('app.api.future_letters.get_db', return_value=AsyncMock()), \
         patch('app.crud.future_letters.CRUDFutureLetter.get', return_value=mock_letter), \
         patch('app.crud.future_letters.CRUDFutureLetter.remove', return_value=None):
        
        response = await client.delete(f"{BASE_URL}/{letter_id}?user_id={TEST_USER_ID}")
        
        assert response.status_code == status.HTTP_204_NO_CONTENT
