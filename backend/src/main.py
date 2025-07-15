"""
FastAPI backend for Carcassonne: War of Ages
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import asyncio
import orjson
from datetime import datetime
from typing import Dict, List, Optional
import uvicorn

app = FastAPI(
    title="Carcassonne: War of Ages API",
    description="Backend API for the Carcassonne: War of Ages game",
    version="1.0.0"
)

# CORS middleware for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8080", "http://127.0.0.1:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Game state storage (in-memory for now)
game_rooms: Dict[str, dict] = {}
active_connections: Dict[str, List[WebSocket]] = {}

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Carcassonne: War of Ages API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/docs", response_class=HTMLResponse)
async def docs():
    """API documentation"""
    return """
    <html>
        <head>
            <title>Carcassonne: War of Ages API</title>
        </head>
        <body>
            <h1>Carcassonne: War of Ages API</h1>
            <p>FastAPI backend for the medieval conquest game</p>
            <a href="/docs">Interactive API Documentation</a>
        </body>
    </html>
    """

@app.websocket("/ws/{room_id}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, player_id: str):
    """WebSocket endpoint for real-time game communication"""
    await websocket.accept()
    
    # Initialize room if it doesn't exist
    if room_id not in game_rooms:
        game_rooms[room_id] = {
            "players": {},
            "game_state": {},
            "created_at": datetime.now().isoformat()
        }
        active_connections[room_id] = []
    
    # Add connection to room
    active_connections[room_id].append(websocket)
    
    try:
        # Send initial game state
        await websocket.send_text(orjson.dumps({
            "type": "game_state",
            "payload": game_rooms[room_id]["game_state"],
            "timestamp": datetime.now().isoformat()
        }).decode())
        
        # Listen for messages
        while True:
            data = await websocket.receive_text()
            message = orjson.loads(data)
            
            # Handle different message types
            await handle_message(room_id, player_id, message, websocket)
            
    except WebSocketDisconnect:
        # Remove connection from room
        if room_id in active_connections:
            active_connections[room_id].remove(websocket)
            
        # Notify other players
        await broadcast_to_room(room_id, {
            "type": "player_disconnected",
            "payload": {"player_id": player_id},
            "timestamp": datetime.now().isoformat()
        })

async def handle_message(room_id: str, player_id: str, message: dict, websocket: WebSocket):
    """Handle incoming WebSocket messages"""
    message_type = message.get("type")
    payload = message.get("payload", {})
    
    if message_type == "place_tile":
        await handle_place_tile(room_id, player_id, payload, websocket)
    elif message_type == "place_worker":
        await handle_place_worker(room_id, player_id, payload, websocket)
    elif message_type == "train_unit":
        await handle_train_unit(room_id, player_id, payload, websocket)
    elif message_type == "move_unit":
        await handle_move_unit(room_id, player_id, payload, websocket)
    elif message_type == "ping":
        await websocket.send_text(orjson.dumps({
            "type": "pong",
            "timestamp": datetime.now().isoformat()
        }).decode())
    else:
        await websocket.send_text(orjson.dumps({
            "type": "error",
            "payload": {"message": f"Unknown message type: {message_type}"},
            "timestamp": datetime.now().isoformat()
        }).decode())

async def handle_place_tile(room_id: str, player_id: str, payload: dict, websocket: WebSocket):
    """Handle tile placement"""
    # TODO: Implement tile placement logic
    x = payload.get("x")
    y = payload.get("y")
    tile_type = payload.get("tile_type")
    
    # Validate placement
    # ... validation logic ...
    
    # Update game state
    # ... game state update ...
    
    # Broadcast to all players in room
    await broadcast_to_room(room_id, {
        "type": "tile_placed",
        "payload": {
            "player_id": player_id,
            "x": x,
            "y": y,
            "tile_type": tile_type
        },
        "timestamp": datetime.now().isoformat()
    })

async def handle_place_worker(room_id: str, player_id: str, payload: dict, websocket: WebSocket):
    """Handle worker placement"""
    # TODO: Implement worker placement logic
    pass

async def handle_train_unit(room_id: str, player_id: str, payload: dict, websocket: WebSocket):
    """Handle unit training"""
    # TODO: Implement unit training logic
    pass

async def handle_move_unit(room_id: str, player_id: str, payload: dict, websocket: WebSocket):
    """Handle unit movement"""
    # TODO: Implement unit movement logic
    pass

async def broadcast_to_room(room_id: str, message: dict):
    """Broadcast message to all connections in a room"""
    if room_id in active_connections:
        message_str = orjson.dumps(message).decode()
        disconnected = []
        
        for connection in active_connections[room_id]:
            try:
                await connection.send_text(message_str)
            except:
                disconnected.append(connection)
        
        # Remove disconnected connections
        for connection in disconnected:
            active_connections[room_id].remove(connection)

# Game loop task
async def game_loop():
    """Main game loop for updating game state"""
    while True:
        # Update all active rooms
        for room_id, room_data in game_rooms.items():
            # TODO: Update game state
            # - Process resource generation
            # - Update unit movements
            # - Process combat
            # - Check win conditions
            pass
        
        await asyncio.sleep(0.1)  # 10 FPS

@app.on_event("startup")
async def startup_event():
    """Start background tasks"""
    asyncio.create_task(game_loop())

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True) 