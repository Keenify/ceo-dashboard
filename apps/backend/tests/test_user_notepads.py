import pytest
from uuid import uuid4
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_create_user_notepad():
    """Test creating a new User Notepad."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        user_id = str(uuid4())
        response = await ac.put(
            f"/user-notepads/{user_id}",
            json={
                "user_id": user_id,
                "content": "Test notepad content"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == user_id
        assert data["content"] == "Test notepad content"
        assert "updated_at" in data

@pytest.mark.asyncio
async def test_get_user_notepad():
    """Test getting a User Notepad."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        user_id = str(uuid4())
        
        # First create a notepad
        await ac.put(
            f"/user-notepads/{user_id}",
            json={
                "user_id": user_id,
                "content": "Test content"
            }
        )
        
        # Then get it
        response = await ac.get(f"/user-notepads/{user_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == user_id
        assert data["content"] == "Test content"

@pytest.mark.asyncio
async def test_update_user_notepad():
    """Test updating a User Notepad."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        user_id = str(uuid4())
        
        # First create a notepad
        await ac.put(
            f"/user-notepads/{user_id}",
            json={
                "user_id": user_id,
                "content": "Initial content"
            }
        )
        
        # Then update it
        response = await ac.patch(
            f"/user-notepads/{user_id}",
            json={
                "content": "Updated content"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["content"] == "Updated content"

@pytest.mark.asyncio
async def test_clear_user_notepad():
    """Test clearing a User Notepad."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        user_id = str(uuid4())
        
        # First create a notepad with content
        await ac.put(
            f"/user-notepads/{user_id}",
            json={
                "user_id": user_id,
                "content": "Content to clear"
            }
        )
        
        # Then clear it
        response = await ac.delete(f"/user-notepads/{user_id}/clear")
        assert response.status_code == 200
        data = response.json()
        assert data["content"] == ""

@pytest.mark.asyncio
async def test_get_nonexistent_notepad():
    """Test getting a notepad that doesn't exist."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        user_id = str(uuid4())
        response = await ac.get(f"/user-notepads/{user_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == user_id
        assert data["content"] == ""

@pytest.mark.asyncio
async def test_check_notepad_exists():
    """Test checking if a notepad exists."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        user_id = str(uuid4())
        
        # Check before creating
        response = await ac.get(f"/user-notepads/{user_id}/exists")
        assert response.status_code == 200
        data = response.json()
        assert data["exists"] == False
        
        # Create a notepad
        await ac.put(
            f"/user-notepads/{user_id}",
            json={
                "user_id": user_id,
                "content": "Test content"
            }
        )
        
        # Check after creating
        response = await ac.get(f"/user-notepads/{user_id}/exists")
        assert response.status_code == 200
        data = response.json()
        assert data["exists"] == True

@pytest.mark.asyncio
async def test_get_notepad_count():
    """Test getting notepad count for a user."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        user_id = str(uuid4())
        
        # Check before creating
        response = await ac.get(f"/user-notepads/{user_id}/count")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 0
        
        # Create a notepad
        await ac.put(
            f"/user-notepads/{user_id}",
            json={
                "user_id": user_id,
                "content": "Test content"
            }
        )
        
        # Check after creating
        response = await ac.get(f"/user-notepads/{user_id}/count")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 1 