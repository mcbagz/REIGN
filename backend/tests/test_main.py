"""
Basic tests for the FastAPI backend
"""
import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_root_endpoint():
    """Test the root endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Carcassonne: War of Ages API", "version": "1.0.0"}

def test_health_check():
    """Test the health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data

def test_docs_endpoint():
    """Test the docs endpoint"""
    response = client.get("/docs")
    assert response.status_code == 200
    assert "Carcassonne: War of Ages API" in response.text

def test_websocket_connection():
    """Test WebSocket connection"""
    with client.websocket_connect("/ws/test-room/player1") as websocket:
        # Should receive initial game state
        data = websocket.receive_json()
        assert data["type"] == "game_state"
        assert "payload" in data
        assert "timestamp" in data
        
        # Send ping
        websocket.send_json({"type": "ping"})
        
        # Should receive pong
        data = websocket.receive_json()
        assert data["type"] == "pong"

def test_invalid_websocket_message():
    """Test handling of invalid WebSocket messages"""
    with client.websocket_connect("/ws/test-room/player1") as websocket:
        # Skip initial game state message
        websocket.receive_json()
        
        # Send invalid message
        websocket.send_json({"type": "invalid_message"})
        
        # Should receive error
        data = websocket.receive_json()
        assert data["type"] == "error"
        assert "Unknown message type" in data["payload"]["message"] 