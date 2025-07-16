"""
FastAPI backend for Carcassonne: War of Ages
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import asyncio
import orjson
from datetime import datetime
from typing import Dict, List, Optional
import uvicorn
import logging
from threading import Lock
import time

from .game_room import room_manager, Room
from .models.websocket_message import WebSocketMessage, MessageType
from .models.tile import Tile, TileType
from .models.unit import Unit, UnitType, Position, UnitStatus
from .pathfinding import Pathfinder

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Lock for thread-safe matchmaking
matchmaking_lock = Lock()

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

# Helper functions
def generate_tile_options(available_tiles: List) -> List[str]:
    """Generate 3 random tile options from available tiles."""
    import random
    
    # Get all tile types that still have count > 0
    available_types = [tile.type for tile in available_tiles if tile.count > 0]
    
    if not available_types:
        return []
    
    # Return up to 3 random options
    return random.sample(available_types, min(3, len(available_types)))

def find_player_by_name(players: List, name: str):
    """Find a player by name."""
    for player in players:
        if player.name == name:
            return player
    return None

def get_unit_cost(unit_type: UnitType):
    """Get the cost to train a unit type."""
    from .models.unit import UnitCost
    
    costs = {
        UnitType.INFANTRY: UnitCost(gold=50, food=25, faith=0),
        UnitType.ARCHER: UnitCost(gold=75, food=15, faith=10),
        UnitType.KNIGHT: UnitCost(gold=100, food=50, faith=25),
        UnitType.SIEGE: UnitCost(gold=150, food=75, faith=50),
    }
    return costs.get(unit_type, UnitCost(gold=50, food=25, faith=0))

def get_unit_training_time(unit_type: UnitType) -> float:
    """Get the time in seconds to train a unit type."""
    times = {
        UnitType.INFANTRY: 10.0,
        UnitType.ARCHER: 15.0,
        UnitType.KNIGHT: 20.0,
        UnitType.SIEGE: 30.0,
    }
    return times.get(unit_type, 10.0)

def get_worker_cost(worker_type):
    """Get the cost to place a worker type."""
    from .models.unit import UnitCost
    from .models.tile import WorkerType
    
    costs = {
        WorkerType.MAGISTRATE: UnitCost(gold=25, food=10, faith=5),
        WorkerType.FARMER: UnitCost(gold=15, food=5, faith=0),
        WorkerType.MONK: UnitCost(gold=20, food=5, faith=10),
        WorkerType.SCOUT: UnitCost(gold=30, food=15, faith=5),
    }
    return costs.get(worker_type, UnitCost(gold=15, food=5, faith=0))

def enhance_tile_resources(tile, worker_type):
    """Enhance tile resource generation based on worker type."""
    from .models.tile import WorkerType
    
    if worker_type == WorkerType.MAGISTRATE:
        tile.resources.gold += 2
    elif worker_type == WorkerType.FARMER:
        tile.resources.food += 3
    elif worker_type == WorkerType.MONK:
        tile.resources.faith += 2
    elif worker_type == WorkerType.SCOUT:
        tile.resources.gold += 1
        tile.resources.food += 1

async def send_error_response(websocket: WebSocket, message: str, error_code: str = "GENERAL_ERROR"):
    """Send a standardized error response to the client."""
    try:
        # Check if WebSocket is still open
        if websocket.client_state.name != "CONNECTED":
            logger.warning(f"Attempted to send error response to closed WebSocket: {message}")
            return
            
        error_response = {
            "type": "error",
            "payload": {
                "message": message,
                "code": error_code
            },
            "timestamp": datetime.now().isoformat()
        }
        await websocket.send_text(orjson.dumps(error_response).decode())
    except Exception as e:
        logger.error(f"Failed to send error response: {e}")

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Carcassonne: War of Ages API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/match")
async def match_player(player_data: dict):
    """Match a player to a game room"""
    try:
        player_id = player_data.get("player_id")
        preferred_room_id = player_data.get("room_id")  # Optional
        
        if not player_id:
            raise HTTPException(status_code=400, detail="player_id is required")
        
        # Use lock for thread-safe matchmaking
        with matchmaking_lock:
            # If player specified a room, try to join it
            if preferred_room_id:
                room = room_manager.get_room(preferred_room_id)
                if room:
                    current_players = len(room.get_active_players())
                    reserved_players = getattr(room, 'reserved_players', 0)
                    total_players = current_players + reserved_players
                    max_players = room.state.game_settings.max_players if room.state and room.state.game_settings else 4
                    
                    if total_players < max_players:
                        # Reserve a spot in the room for this player
                        if not hasattr(room, 'reserved_players'):
                            room.reserved_players = 0
                        room.reserved_players += 1
                        
                        return {"room_id": preferred_room_id, "status": "joined_existing"}
                    else:
                        raise HTTPException(status_code=404, detail="Room not found or full")
                else:
                    raise HTTPException(status_code=404, detail="Room not found or full")
            
            # Find an available room with space
            available_room = None
            for room in room_manager.rooms.values():
                # Count both active players and those reserved via matchmaking
                current_players = len(room.get_active_players())
                reserved_players = getattr(room, 'reserved_players', 0)
                total_players = current_players + reserved_players
                
                max_players = room.state.game_settings.max_players if room.state and room.state.game_settings else 4
                
                if total_players < max_players:
                    # Prioritize rooms that are closer to full
                    if available_room is None or total_players > (len(available_room.get_active_players()) + getattr(available_room, 'reserved_players', 0)):
                        available_room = room
            
            if available_room:
                # Reserve a spot in the room for this player
                if not hasattr(available_room, 'reserved_players'):
                    available_room.reserved_players = 0
                available_room.reserved_players += 1
                
                return {
                    "room_id": available_room.room_id,
                    "status": "joined_existing",
                    "player_count": len(available_room.get_active_players()),
                    "max_players": available_room.state.game_settings.max_players if available_room.state and available_room.state.game_settings else 4
                }
            
            # No available room found, create a new one
            new_room = room_manager.create_room()
            # Reserve a spot in the new room for this player
            new_room.reserved_players = 1
            
            return {
                "room_id": new_room.room_id,
                "status": "created_new",
                "player_count": 0,
                "max_players": 4
            }
        
    except HTTPException:
        raise  # Re-raise HTTPException as-is
    except Exception as e:
        logger.error(f"Error in matchmaking: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/rooms")
async def get_rooms():
    """Get information about active rooms"""
    rooms_info = []
    for room_id, room in room_manager.rooms.items():
        rooms_info.append({
            "room_id": room_id,
            "player_count": len(room.players),
            "max_players": 4,  # Default max players
            "status": room.state.status.value if room.state else "waiting",
            "created_at": room.created_at.isoformat()
        })
    return {"rooms": rooms_info}

@app.websocket("/ws/{room_id}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, player_id: str):
    """WebSocket endpoint for real-time game communication"""
    await websocket.accept()
    logger.info(f"Player {player_id} connecting to room {room_id}")
    
    # Get or create room
    room = room_manager.get_or_create_room(room_id)
    
    # Add player to room
    if not room.add_player(player_id, websocket):
        await websocket.send_text(orjson.dumps({
            "type": "error",
            "payload": {"message": "Room is full"},
            "timestamp": datetime.now().isoformat()
        }).decode())
        await websocket.close()
        return
    
    # Start game loop if not already running
    room.start_game_loop()
    
    try:
        # Send initial game state
        initial_payload = room.state.model_dump() if room.state else {}
        await websocket.send_text(orjson.dumps({
            "type": "game_state",
            "payload": initial_payload,
            "timestamp": datetime.now().isoformat()
        }).decode())
        
        # Notify other players (not the player who just joined)
        await broadcast_to_others(room, player_id, {
            "type": "player_joined",
            "payload": {"player_id": player_id, "player_count": len(room.get_active_players())},
            "timestamp": datetime.now().isoformat()
        })
        
        # Listen for messages
        while True:
            try:
                # Check if WebSocket is still connected before trying to receive
                if websocket.client_state.name != "CONNECTED":
                    logger.info(f"WebSocket for player {player_id} is no longer connected")
                    break
                
                data = await websocket.receive_text()
                
                # Validate message size (prevent DoS attacks)
                if len(data) > 10000:  # 10KB limit
                    await send_error_response(websocket, "Message too large", "MESSAGE_TOO_LARGE")
                    continue
                
                # Parse JSON with better error handling
                try:
                    message = orjson.loads(data)
                except orjson.JSONDecodeError as e:
                    await send_error_response(websocket, f"Invalid JSON: {str(e)}", "INVALID_JSON")
                    continue
                
                await handle_message(room, player_id, message, websocket)
                
            except asyncio.CancelledError:
                logger.info(f"Cancelled message handling for player {player_id}")
                break
            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected for player {player_id}")
                break
            except Exception as e:
                logger.error(f"Error handling message from {player_id}: {e}")
                
                # Only try to send error response if connection is still active
                if websocket.client_state.name == "CONNECTED":
                    await send_error_response(websocket, "Message processing error", "PROCESSING_ERROR")
                else:
                    logger.info(f"Skipping error response for {player_id} - connection closed")
                    break
            
    except WebSocketDisconnect:
        logger.info(f"Player {player_id} disconnected from room {room_id}")
        room.remove_player(player_id)
            
        # Notify other players
        await broadcast_to_others(room, player_id, {
            "type": "player_disconnected",
            "payload": {"player_id": player_id, "player_count": len(room.get_active_players())},
            "timestamp": datetime.now().isoformat()
        })

        # Clean up empty room
        if room.is_empty():
            room.stop_game_loop()

async def handle_message(room: Room, player_id: str, message: dict, websocket: WebSocket):
    """Handle incoming WebSocket messages"""
    try:
        # Validate message structure
        if not isinstance(message, dict):
            await send_error_response(websocket, "Invalid message format: expected JSON object", "INVALID_FORMAT")
            return
        
        message_type = message.get("type")
        if not message_type:
            await send_error_response(websocket, "Missing message type", "MISSING_TYPE")
            return
        
        payload = message.get("payload", {})
        
        # Rate limiting check (simple implementation)
        current_time = time.time()
        if not hasattr(room, 'player_message_times'):
            room.player_message_times = {}
        
        if player_id not in room.player_message_times:
            room.player_message_times[player_id] = []
        
        # Remove old timestamps (older than 1 second)
        room.player_message_times[player_id] = [
            t for t in room.player_message_times[player_id] 
            if current_time - t < 1.0
        ]
        
        # Check rate limit (max 10 messages per second per player)
        if len(room.player_message_times[player_id]) >= 10:
            await send_error_response(websocket, "Rate limit exceeded", "RATE_LIMIT")
            return
        
        room.player_message_times[player_id].append(current_time)
        
        logger.debug(f"Handling message type {message_type} from player {player_id} in room {room.room_id}")
        
        if message_type == "cmd":
            action = payload.get("action")
            if not action:
                await send_error_response(websocket, "Missing action in command", "MISSING_ACTION")
                return
            
            data = payload.get("data", {})
            
            # Command routing with better error handling
            command_handlers = {
                "placeTile": handle_place_tile,
                "moveUnit": handle_move_unit,
                "trainUnit": handle_train_unit,
                "placeWorker": handle_place_worker
            }
            
            handler = command_handlers.get(action)
            if handler:
                await handler(room, player_id, data, websocket)
            else:
                await send_error_response(websocket, f"Unknown action: {action}", "UNKNOWN_ACTION")
        
        elif message_type == "ping":
            await websocket.send_text(orjson.dumps({
                "type": "pong",
                "timestamp": datetime.now().isoformat()
            }).decode())
        
        else:
            await send_error_response(websocket, f"Unknown message type: {message_type}", "UNKNOWN_MESSAGE_TYPE")
    
    except Exception as e:
        logger.error(f"Unexpected error handling message from {player_id}: {e}")
        await send_error_response(websocket, "Internal server error", "INTERNAL_ERROR")

async def handle_place_tile(room: Room, player_id: str, data: dict, websocket: WebSocket):
    """Handle tile placement"""
    try:
        x = data.get("x")
        y = data.get("y") 
        tile_type = data.get("tile_type")
        
        if x is None or y is None or tile_type is None:
            raise ValueError("Missing required fields: x, y, tile_type")
        
        # Validate game state exists and it's the player's turn
        if room.state is None:
            raise ValueError("Game not started yet")
            
        current_player = room.state.players[room.state.current_player]
        if current_player.name != player_id:
            raise ValueError("Not your turn")
        
        # Validate tile type is available
        if room.state.current_tile_options and tile_type not in room.state.current_tile_options:
            raise ValueError(f"Tile type {tile_type} not available in current options")
        
        # Check if position is valid (within bounds)
        if not (0 <= x < room.state.game_settings.map_size and 0 <= y < room.state.game_settings.map_size):
            raise ValueError(f"Position ({x}, {y}) is outside map bounds")
        
        # Check if position is already occupied
        for existing_tile in room.state.tiles:
            if existing_tile.x == x and existing_tile.y == y:
                raise ValueError(f"Position ({x}, {y}) is already occupied")
        
        # Validate tile placement rules (adjacent to existing tiles, except for first tile)
        if len(room.state.tiles) > 0:
            adjacent_found = False
            for existing_tile in room.state.tiles:
                if abs(existing_tile.x - x) + abs(existing_tile.y - y) == 1:
                    adjacent_found = True
                    break
            if not adjacent_found:
                raise ValueError("New tile must be adjacent to existing tiles")
        
        # Create new tile using proper model
        from .models.tile import Resources, TileMetadata
        new_tile = Tile(
            id=f"{x},{y}",
            type=TileType(tile_type),
            x=x,
            y=y,
            edges=["field", "field", "field", "field"],  # Default edges
            hp=100,
            max_hp=100,
            owner=current_player.id,
            resources=Resources(gold=1, food=1, faith=0),  # Default resources
            placed_at=datetime.now().timestamp(),
            metadata=TileMetadata(can_train=(tile_type == "barracks"))
        )
        
        # Add to game state
        room.state.tiles.append(new_tile)
        room.state.last_update = datetime.now().timestamp()
        
        # Update current player's stats
        current_player.stats.tiles_placed += 1
        
        # Generate new tile options for next turn
        room.state.current_tile_options = generate_tile_options(room.state.available_tiles)
        
        # Advance turn to next player
        room.state.current_player = (room.state.current_player + 1) % len(room.state.players)
        room.state.turn_number += 1
    
    # Broadcast to all players in room
        await broadcast_to_room(room, {
            "type": "tile_placed",
            "payload": {
                "player_id": player_id,
                "tile": new_tile.model_dump(),
                "next_player": room.state.current_player
            },
            "timestamp": datetime.now().isoformat()
        })

        logger.info(f"Tile placed by {player_id} at ({x}, {y})")
        
    except Exception as e:
        logger.error(f"Error placing tile: {e}")
        await websocket.send_text(orjson.dumps({
            "type": "error",
            "payload": {"message": f"Tile placement failed: {str(e)}"},
            "timestamp": datetime.now().isoformat()
        }).decode())

async def handle_place_worker(room: Room, player_id: str, data: dict, websocket: WebSocket):
    """Handle worker placement"""
    try:
        worker_type = data.get("worker_type")
        tile_id = data.get("tile_id")
        
        if not worker_type or not tile_id:
            raise ValueError("Missing required fields: worker_type, tile_id")
        
        # Validate game state exists
        if room.state is None:
            raise ValueError("Game not started yet")
        
        # Find the tile by ID
        tile = None
        for t in room.state.tiles:
            if t.id == tile_id:
                tile = t
                break
        
        if not tile:
            raise ValueError(f"Tile {tile_id} not found")
        
        # Validate player ownership of tile
        player = find_player_by_name(room.state.players, player_id)
        if not player or tile.owner != player.id:
            raise ValueError("You don't own this tile")
        
        # Validate worker type
        from .models.tile import WorkerType
        try:
            worker_type_enum = WorkerType(worker_type)
        except ValueError:
            raise ValueError(f"Invalid worker type: {worker_type}")
        
        # Check if tile already has a worker
        if tile.worker is not None:
            raise ValueError(f"Tile {tile_id} already has a worker")
        
        # Check if player has enough resources to place worker
        worker_cost = get_worker_cost(worker_type_enum)
        if (player.resources.get("gold", 0) < worker_cost.gold or
            player.resources.get("food", 0) < worker_cost.food or
            player.resources.get("faith", 0) < worker_cost.faith):
            raise ValueError("Insufficient resources to place worker")
        
        # Deduct resources
        player.resources["gold"] -= worker_cost.gold
        player.resources["food"] -= worker_cost.food
        player.resources["faith"] -= worker_cost.faith
        
        # Create new worker
        from .models.tile import Worker
        new_worker = Worker(
            id=len(room.state.units) + 1,  # Simple ID generation
            type=worker_type_enum,
            owner=player.id
        )
        
        # Add worker to tile
        tile.worker = new_worker
        
        # Update tile's resource generation based on worker
        enhance_tile_resources(tile, worker_type_enum)
        
        room.state.last_update = datetime.now().timestamp()
        
        # Broadcast to all players in room
        await broadcast_to_room(room, {
            "type": "worker_placed",
            "payload": {
                "player_id": player_id,
                "worker_type": worker_type,
                "tile_id": tile_id,
                "worker_id": new_worker.id,
                "new_resources": tile.resources.model_dump()
            },
            "timestamp": datetime.now().isoformat()
        })
        
        logger.info(f"Worker placed by {player_id}: {worker_type} on {tile_id}")
        
    except Exception as e:
        logger.error(f"Error placing worker: {e}")
        await websocket.send_text(orjson.dumps({
            "type": "error",
            "payload": {"message": f"Worker placement failed: {str(e)}"},
            "timestamp": datetime.now().isoformat()
        }).decode())

async def handle_train_unit(room: Room, player_id: str, data: dict, websocket: WebSocket):
    """Handle unit training"""
    try:
        unit_type = data.get("unit_type")
        tile_id = data.get("tile_id")
        
        if not unit_type or not tile_id:
            raise ValueError("Missing required fields: unit_type, tile_id")
        
        # Validate game state exists
        if room.state is None:
            raise ValueError("Game not started yet")
        
        # Find the tile by ID
        tile = None
        for t in room.state.tiles:
            if t.id == tile_id:
                tile = t
                break
        
        if not tile:
            raise ValueError(f"Tile {tile_id} not found")
        
        # Validate player ownership of tile
        player = find_player_by_name(room.state.players, player_id)
        if not player or tile.owner != player.id:
            raise ValueError("You don't own this tile")
        
        # Validate tile can train units
        if not tile.metadata.can_train:
            raise ValueError(f"Tile type {tile.type} cannot train units")
        
        # Validate unit type
        try:
            unit_type_enum = UnitType(unit_type)
        except ValueError:
            raise ValueError(f"Invalid unit type: {unit_type}")
        
        # Check if player has enough resources
        unit_cost = get_unit_cost(unit_type_enum)
        if (player.resources.get("gold", 0) < unit_cost.gold or
            player.resources.get("food", 0) < unit_cost.food or
            player.resources.get("faith", 0) < unit_cost.faith):
            raise ValueError("Insufficient resources to train unit")
        
        # Deduct resources
        player.resources["gold"] -= unit_cost.gold
        player.resources["food"] -= unit_cost.food
        player.resources["faith"] -= unit_cost.faith
        
        # Create new unit
        new_unit = Unit.create_unit(
            unit_type=unit_type_enum,
            owner=player.id,
            position=Position(x=tile.x, y=tile.y)
        )
        # Override status for training
        new_unit.status = UnitStatus.TRAINING
        
        # Add unit to game state
        room.state.units.append(new_unit)
        room.state.last_update = datetime.now().timestamp()
        
        # Update player stats
        player.stats.units_created += 1
        
        # Broadcast to all players in room
        await broadcast_to_room(room, {
            "type": "unit_training_started",
            "payload": {
                "player_id": player_id,
                "unit_type": unit_type,
                "tile_id": tile_id,
                "unit_id": new_unit.id,
                "training_time": new_unit.metadata.training_time
            },
            "timestamp": datetime.now().isoformat()
        })
        
        logger.info(f"Unit training started by {player_id}: {unit_type} at {tile_id}")
        
    except Exception as e:
        logger.error(f"Error training unit: {e}")
        await websocket.send_text(orjson.dumps({
            "type": "error",
            "payload": {"message": f"Unit training failed: {str(e)}"},
            "timestamp": datetime.now().isoformat()
        }).decode())

async def handle_move_unit(room: Room, player_id: str, data: dict, websocket: WebSocket):
    """Handle unit movement"""
    try:
        unit_id = data.get("unit_id")
        target_x = data.get("target_x")
        target_y = data.get("target_y")
        
        if not unit_id or target_x is None or target_y is None:
            raise ValueError("Missing required fields: unit_id, target_x, target_y")
        
        # Validate game state exists
        if room.state is None:
            raise ValueError("Game not started yet")
        
        # Find the unit by ID
        unit = None
        for u in room.state.units:
            if u.id == unit_id:
                unit = u
                break
        
        if not unit:
            raise ValueError(f"Unit {unit_id} not found")
        
        # Validate unit ownership
        player = find_player_by_name(room.state.players, player_id)
        if not player or unit.owner != player.id:
            raise ValueError("You don't own this unit")
        
        # Validate unit is not already moving or dead
        if unit.status in [UnitStatus.MOVING, UnitStatus.DEAD]:
            raise ValueError(f"Unit is {unit.status} and cannot move")
        
        # Validate target position is within bounds
        if not (0 <= target_x < room.state.game_settings.map_size and 0 <= target_y < room.state.game_settings.map_size):
            raise ValueError(f"Target position ({target_x}, {target_y}) is outside map bounds")
        
        # Create pathfinder and find path
        pathfinder = Pathfinder(room.state.game_settings.map_size, room.state.game_settings.map_size)
        
        # Set terrain weights based on tiles
        for tile in room.state.tiles:
            weight = 1.0
            if tile.type in [TileType.MARSH]:
                weight = 2.0  # Marsh is harder to traverse
            elif tile.type in [TileType.FIELD]:
                weight = 0.8  # Field is easier to traverse
            pathfinder.set_terrain_weight(Position(x=tile.x, y=tile.y), weight)
        
        # Find path from unit current position to target
        path = pathfinder.find_path(unit.position, Position(x=target_x, y=target_y))
        
        if not path:
            raise ValueError("No valid path to target position")
        
        # Update unit status and target
        from .models.unit import Target
        unit.status = UnitStatus.MOVING
        unit.target = Target(
            type="tile", 
            id=f"{target_x},{target_y}", 
            position=Position(x=target_x, y=target_y)
        )
        unit.last_action = datetime.now().timestamp()
        
        # Broadcast to all players in room
        await broadcast_to_room(room, {
            "type": "unit_move_started",
            "payload": {
                "player_id": player_id,
                "unit_id": unit_id,
                "target_x": target_x,
                "target_y": target_y,
                "path": [pos.model_dump() for pos in path]
            },
            "timestamp": datetime.now().isoformat()
        })
        
        logger.info(f"Unit movement started by {player_id}: {unit_id} to ({target_x}, {target_y})")
        
    except Exception as e:
        logger.error(f"Error moving unit: {e}")
        await websocket.send_text(orjson.dumps({
            "type": "error",
            "payload": {"message": f"Unit movement failed: {str(e)}"},
            "timestamp": datetime.now().isoformat()
        }).decode())

async def broadcast_to_room(room: Room, message: dict):
    """Broadcast message to all connections in a room"""
    if not room.connections:
        return
        
    message_str = orjson.dumps(message).decode()
    disconnected = []
        
    for player_id, connection in room.connections.items():
        try:
            await connection.send_text(message_str)
        except Exception as e:
            logger.warning(f"Failed to send message to {player_id}: {e}")
            disconnected.append(player_id)
        
    # Remove disconnected connections
    for player_id in disconnected:
        room.remove_player(player_id)

async def broadcast_to_others(room: Room, exclude_player_id: str, message: dict):
    """Broadcast message to all connections in a room except the specified player"""
    if not room.connections:
        return
        
    message_str = orjson.dumps(message).decode()
    disconnected = []
    
    for player_id, connection in room.connections.items():
        if player_id == exclude_player_id:
            continue  # Skip the excluded player
        
        # Check if connection is still open before sending
        if connection.client_state.name != "CONNECTED":
            logger.warning(f"Skipping message to {player_id} - connection closed")
            disconnected.append(player_id)
            continue
            
        try:
            await connection.send_text(message_str)
        except Exception as e:
            logger.warning(f"Failed to send message to {player_id}: {e}")
            disconnected.append(player_id)
    
    # Remove disconnected connections
    for player_id in disconnected:
        room.remove_player(player_id)

@app.on_event("startup")
async def startup_event():
    """Start background tasks"""
    logger.info("Starting Carcassonne: War of Ages backend server")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on shutdown"""
    logger.info("Shutting down server - cleaning up rooms")
    for room in room_manager.rooms.values():
        room.stop_game_loop()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True) 