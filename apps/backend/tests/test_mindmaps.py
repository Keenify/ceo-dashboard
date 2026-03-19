import pytest
from httpx import AsyncClient, ASGITransport
from uuid import uuid4, UUID
from unittest.mock import AsyncMock
from datetime import datetime, timezone
from app.main import app
from app.api import mindmaps as mindmaps_api

@pytest.mark.asyncio
async def test_create_mindmap(monkeypatch):
    test_user_id = str(uuid4())
    
    mindmap_data = {
        "title": "Test Mindmap",
        "description": "Test Description",
        "mindmap": {
            "nodes": [{"id": "root", "data": {"label": "Root"}}],
            "edges": []
        },
        "user_id": test_user_id
    }
    
    # Mock the created mindmap object with all required fields
    mock_mindmap_id = UUID(str(uuid4()))
    mock_created_mindmap = {
        "id": mock_mindmap_id,
        "title": "Test Mindmap",
        "description": "Test Description",
        "mindmap": {"nodes": [{"id": "root", "data": {"label": "Root"}}], "edges": []},
        "user_id": UUID(test_user_id),
        "updated_by": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None
    }
    
    # Mock the CRUD create operation
    mock_create = AsyncMock(return_value=type('MockMindmap', (), mock_created_mindmap)())
    monkeypatch.setattr(mindmaps_api.CRUDMindmap, "create", mock_create)
    
    # Mock the CRUD remove operation for cleanup
    mock_remove = AsyncMock(return_value=type('MockMindmap', (), mock_created_mindmap)())
    monkeypatch.setattr(mindmaps_api.CRUDMindmap, "remove", mock_remove)
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/mindmaps/", json=mindmap_data)
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Test Mindmap"
        assert data["user_id"] == test_user_id
        
        # Cleanup call
        cleanup_response = await ac.delete(f"/mindmaps/{data['id']}")
        # Don't assert cleanup response since it might not be implemented

@pytest.mark.asyncio
async def test_get_user_mindmaps(monkeypatch):
    test_user_id = str(uuid4())
    
    # Mock the mindmaps list with all required fields
    mock_mindmaps = [
        {
            "id": UUID(str(uuid4())),
            "title": "Test Mindmap 1",
            "description": "Description 1",
            "mindmap": {"nodes": [], "edges": []},
            "user_id": UUID(test_user_id),
            "updated_by": None,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "deleted_at": None
        },
        {
            "id": UUID(str(uuid4())),
            "title": "Test Mindmap 2", 
            "description": "Description 2",
            "mindmap": {"nodes": [], "edges": []},
            "user_id": UUID(test_user_id),
            "updated_by": None,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "deleted_at": None
        }
    ]
    
    # Mock the CRUD get_multi_by_user operation
    mock_get_multi = AsyncMock(return_value=[
        type('MockMindmap1', (), mock_mindmaps[0])(),
        type('MockMindmap2', (), mock_mindmaps[1])()
    ])
    monkeypatch.setattr(mindmaps_api.CRUDMindmap, "get_multi_by_user", mock_get_multi)
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get(f"/mindmaps/user/{test_user_id}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 2
        assert data[0]["title"] == "Test Mindmap 1"
        assert data[1]["title"] == "Test Mindmap 2" 