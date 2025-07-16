"""
Tests for the matchmaking endpoint functionality.
"""
import pytest
from fastapi.testclient import TestClient
from src.main import app
from src.game_room import room_manager

client = TestClient(app)

def test_matchmaking_basic():
    """Test basic matchmaking functionality."""
    # Clear any existing rooms
    room_manager.rooms.clear()
    
    response = client.post("/match", json={"player_id": "test_player_1"})
    assert response.status_code == 200
    
    data = response.json()
    assert "room_id" in data
    assert "status" in data
    assert data["status"] == "created_new"
    assert data["player_count"] == 0
    assert data["max_players"] == 4

def test_matchmaking_missing_player_id():
    """Test matchmaking with missing player_id."""
    response = client.post("/match", json={})
    assert response.status_code == 400
    assert "player_id is required" in response.json()["detail"]

def test_matchmaking_join_existing_room():
    """Test joining an existing room."""
    # Clear any existing rooms
    room_manager.rooms.clear()
    
    # Create first room
    response1 = client.post("/match", json={"player_id": "test_player_1"})
    assert response1.status_code == 200
    room_id = response1.json()["room_id"]
    
    # Second player should join the same room
    response2 = client.post("/match", json={"player_id": "test_player_2"})
    assert response2.status_code == 200
    
    data2 = response2.json()
    assert data2["room_id"] == room_id
    assert data2["status"] == "joined_existing"

def test_matchmaking_preferred_room():
    """Test joining a specific room by ID."""
    # Clear any existing rooms
    room_manager.rooms.clear()
    
    # Create a room
    response1 = client.post("/match", json={"player_id": "test_player_1"})
    assert response1.status_code == 200
    room_id = response1.json()["room_id"]
    
    # Try to join the specific room
    response2 = client.post("/match", json={"player_id": "test_player_2", "room_id": room_id})
    assert response2.status_code == 200
    
    data2 = response2.json()
    assert data2["room_id"] == room_id
    assert data2["status"] == "joined_existing"

def test_matchmaking_room_not_found():
    """Test joining a non-existent room."""
    response = client.post("/match", json={"player_id": "test_player_1", "room_id": "non_existent_room"})
    assert response.status_code == 404
    assert "Room not found or full" in response.json()["detail"]

def test_matchmaking_concurrent_requests():
    """Test concurrent matchmaking requests."""
    # Clear any existing rooms
    room_manager.rooms.clear()
    
    # Make multiple requests to test thread safety
    responses = []
    for i in range(5):
        response = client.post("/match", json={"player_id": f"concurrent_player_{i}"})
        responses.append(response)
    
    # All requests should succeed
    for response in responses:
        assert response.status_code == 200
        data = response.json()
        assert "room_id" in data
        assert "status" in data
        assert data["status"] in ["created_new", "joined_existing"]

def test_rooms_endpoint():
    """Test the rooms listing endpoint."""
    # Clear any existing rooms
    room_manager.rooms.clear()
    
    # Create some rooms
    client.post("/match", json={"player_id": "test_player_1"})
    client.post("/match", json={"player_id": "test_player_2"})
    
    response = client.get("/rooms")
    assert response.status_code == 200
    
    data = response.json()
    assert "rooms" in data
    assert isinstance(data["rooms"], list) 