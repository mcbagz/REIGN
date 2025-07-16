"""
Simple test to debug WebSocket connection issues
"""
import asyncio
from fastapi.testclient import TestClient
from src.main import app
from src.game_room import room_manager

def test_simple_websocket():
    """Simple WebSocket test"""
    client = TestClient(app)
    
    print("Testing WebSocket connection...")
    
    try:
        with client.websocket_connect("/ws/test-room/player1") as websocket:
            print("WebSocket connected successfully")
            
            # Try to receive the initial message
            data = websocket.receive_json()
            print(f"Received data: {data}")
            
            # Send a ping
            websocket.send_json({"type": "ping"})
            response = websocket.receive_json()
            print(f"Ping response: {response}")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_simple_websocket() 