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
        # Get the player's numeric ID from the room
        player_numeric_id = None
        for player in room.players.values():
            if player.name == player_id:
                player_numeric_id = player.id
                break
        
        # Send player identity first
        await websocket.send_text(orjson.dumps({
            "type": "player_identity",
            "payload": {
                "player_id": player_numeric_id,
                "player_name": player_id,
                "room_id": room_id
            },
            "timestamp": datetime.now().isoformat()
        }).decode())
        
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
    """Handle tile placement command from a player - TURN-BASED according to GDD"""
    try:
        # Validate required fields
        required_fields = ["x", "y", "tile_type"]
        for field in required_fields:
            if field not in data:
                await send_error_response(websocket, f"Missing required field: {field}", "MISSING_FIELD")
                return

        x = data["x"]
        y = data["y"]
        tile_type = data["tile_type"]
        
        # Validate coordinates
        if not isinstance(x, int) or not isinstance(y, int):
            await send_error_response(websocket, "Coordinates must be integers", "INVALID_COORDINATES")
            return
            
        if x < 0 or x >= room.state.game_settings.map_size or y < 0 or y >= room.state.game_settings.map_size:
            await send_error_response(websocket, "Coordinates out of bounds", "COORDINATES_OUT_OF_BOUNDS")
            return

        # Find the player
        current_player = find_player_by_name(room.state.players, player_id)
        if not current_player:
            await send_error_response(websocket, "Player not found", "PLAYER_NOT_FOUND")
            return

        # **REAL-TIME TILE PLACEMENT**: No turn restriction for placing tiles from personal bank
        # Players can place tiles from their personal bank onto the grid at any time
        # Only tile SELECTION from offers is turn-based (15-second cycles)

        # Check if position is already occupied
        if any(tile.x == x and tile.y == y for tile in room.state.tiles):
            await send_error_response(websocket, "Position already occupied", "POSITION_OCCUPIED")
            return

        # Check adjacency (must touch at least one existing tile)
        if not _has_adjacent_tile(x, y, room.state.tiles):
            await send_error_response(websocket, "Tile must be adjacent to existing tiles", "NOT_ADJACENT")
            return

        # Validate tile type against current tile options
        if tile_type not in room.state.current_tile_options:
            await send_error_response(websocket, f"Invalid tile type: {tile_type}", "INVALID_TILE_TYPE")
            return

        # Get tile cost and validate player can afford it
        tile_cost = _get_tile_cost(tile_type)
        if not _can_afford_tile(current_player, tile_cost):
            await send_error_response(websocket, "Insufficient resources", "INSUFFICIENT_RESOURCES")
            return

        # Deduct resources
        current_player.resources["gold"] -= tile_cost["gold"]
        current_player.resources["food"] -= tile_cost["food"]
        current_player.resources["faith"] -= tile_cost["faith"]

        # Get tile properties
        tile_properties = _get_tile_properties(tile_type)

        # Create new tile with proper type enum
        from .models.tile import TileType
        tile_type_enum = TileType(tile_type)
        
        new_tile = Tile(
            id=f"{x},{y}",
            type=tile_type_enum,
            x=x,
            y=y,
            edges=tile_properties["edges"],
            hp=tile_properties["hp"],
            max_hp=tile_properties["hp"],
            owner=current_player.id,
            resources=tile_properties["resources"],
            placed_at=datetime.now().timestamp(),
            metadata=tile_properties["metadata"]
        )

        # Add to game state
        room.state.tiles.append(new_tile)
        room.state.last_update = datetime.now().timestamp()

        # Update current player's stats
        current_player.stats.tiles_placed += 1

        # **REAL-TIME LOGIC**: No turn advancement for tile placement
        # Turn advancement is handled by the global 15-second timer only

        # Broadcast tile placement to all players in room
        await broadcast_to_room(room, {
            "type": "tile_placed",
            "payload": {
                "player_id": player_id,
                "tile": new_tile.model_dump(),
                "new_resources": current_player.resources
            },
            "timestamp": datetime.now().isoformat()
        })
        
        # Broadcast updated tiles to all clients
        room._broadcast_tiles_update()
        
        logger.info(f"Tile placed by {player_id} at ({x}, {y}) during their turn")

    except Exception as e:
        logger.error(f"Error placing tile: {e}")
        await send_error_response(websocket, f"Tile placement failed: {str(e)}", "TILE_PLACEMENT_ERROR")

def _has_adjacent_tile(x: int, y: int, tiles) -> bool:
    """Check if position has at least one adjacent tile."""
    if not tiles:  # First tile can be placed anywhere
        return True
        
    adjacent_positions = [
        (x - 1, y),  # West
        (x + 1, y),  # East
        (x, y - 1),  # North
        (x, y + 1)   # South
    ]
    
    for tile in tiles:
        if (tile.x, tile.y) in adjacent_positions:
            return True
    return False

def _get_tile_cost(tile_type: str) -> dict:
    """Get the resource cost for placing a tile."""
    tile_costs = {
        "field": {"gold": 10, "food": 0, "faith": 0},
        "city": {"gold": 50, "food": 20, "faith": 0},
        "monastery": {"gold": 30, "food": 10, "faith": 20},
        "barracks": {"gold": 80, "food": 40, "faith": 0},
        "watchtower": {"gold": 60, "food": 30, "faith": 10},
        "mine": {"gold": 40, "food": 20, "faith": 0},
        "orchard": {"gold": 30, "food": 10, "faith": 0},
        "marsh": {"gold": 5, "food": 0, "faith": 0}
    }
    
    return tile_costs.get(tile_type, {"gold": 20, "food": 10, "faith": 0})

def _can_afford_tile(player, cost: dict) -> bool:
    """Check if player can afford the tile cost."""
    return (player.resources["gold"] >= cost["gold"] and
            player.resources["food"] >= cost["food"] and
            player.resources["faith"] >= cost["faith"])

def _get_tile_properties(tile_type: str) -> dict:
    """Get the properties for a tile type."""
    from .models.tile import Resources, TileMetadata
    
    properties = {
        "field": {
            "edges": ["field", "field", "field", "field"],
            "hp": 30,
            "resources": Resources(gold=0, food=10, faith=0),
            "metadata": TileMetadata(can_train=False, worker_capacity=1)
        },
        "city": {
            "edges": ["city", "city", "city", "city"],
            "hp": 100,
            "resources": Resources(gold=20, food=20, faith=0),
            "metadata": TileMetadata(can_train=True, worker_capacity=2)
        },
        "monastery": {
            "edges": ["monastery", "monastery", "monastery", "monastery"],
            "hp": 80,
            "resources": Resources(gold=0, food=0, faith=30),
            "metadata": TileMetadata(can_train=False, worker_capacity=1)
        },
        "barracks": {
            "edges": ["barracks", "barracks", "barracks", "barracks"],
            "hp": 120,
            "resources": Resources(gold=0, food=0, faith=0),
            "metadata": TileMetadata(can_train=True, worker_capacity=0)
        },
        "watchtower": {
            "edges": ["watchtower", "watchtower", "watchtower", "watchtower"],
            "hp": 150,
            "resources": Resources(gold=0, food=0, faith=0),
            "metadata": TileMetadata(can_train=False, worker_capacity=0, defense_bonus=0.25)
        },
        "mine": {
            "edges": ["mine", "mine", "mine", "mine"],
            "hp": 60,
            "resources": Resources(gold=40, food=0, faith=0),
            "metadata": TileMetadata(can_train=False, worker_capacity=0)
        },
        "orchard": {
            "edges": ["orchard", "orchard", "orchard", "orchard"],
            "hp": 60,
            "resources": Resources(gold=0, food=40, faith=0),
            "metadata": TileMetadata(can_train=False, worker_capacity=0)
        },
        "marsh": {
            "edges": ["marsh", "marsh", "marsh", "marsh"],
            "hp": 20,
            "resources": Resources(gold=0, food=0, faith=0),
            "metadata": TileMetadata(can_train=False, worker_capacity=0, speed_multiplier=0.3)
        }
    }
    
    return properties.get(tile_type, properties["field"])

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
    """Handle unit training command from a player"""
    try:
        # Validate required fields
        required_fields = ["unit_type", "tile_id"]
        for field in required_fields:
            if field not in data:
                await send_error_response(websocket, f"Missing required field: {field}", "MISSING_FIELD")
                return

        unit_type = data["unit_type"]
        tile_id = data["tile_id"]
        
        # Validate unit type
        valid_unit_types = ["infantry", "archer", "knight", "siege"]
        if unit_type not in valid_unit_types:
            await send_error_response(websocket, f"Invalid unit type: {unit_type}", "INVALID_UNIT_TYPE")
            return

        # Find the player
        player = None
        for p in room.state.players:
            if p.name == player_id:
                player = p
                break
        
        if not player:
            await send_error_response(websocket, "Player not found", "PLAYER_NOT_FOUND")
            return

        # Find the tile
        tile = None
        for t in room.state.tiles:
            if t.id == tile_id:
                tile = t
                break
        
        if not tile:
            await send_error_response(websocket, "Tile not found", "TILE_NOT_FOUND")
            return

        # Validate tile ownership
        if tile.owner != player.id:
            await send_error_response(websocket, "You don't own this tile", "TILE_NOT_OWNED")
            return

        # Validate tile can train units
        if not tile.metadata or not tile.metadata.can_train:
            await send_error_response(websocket, "This tile cannot train units", "TILE_CANNOT_TRAIN")
            return

        # Check unit training costs
        unit_cost = _get_unit_cost(unit_type)
        if not _can_afford_unit(player, unit_cost):
            await send_error_response(websocket, "Insufficient resources", "INSUFFICIENT_RESOURCES")
            return

        # Check if tile is already training a unit
        if any(unit.status == UnitStatus.TRAINING and unit.position.x == tile.x and unit.position.y == tile.y 
               for unit in room.state.units):
            await send_error_response(websocket, "Tile is already training a unit", "TILE_ALREADY_TRAINING")
            return

        # Deduct resources
        player.resources["gold"] -= unit_cost["gold"]
        player.resources["food"] -= unit_cost["food"]
        player.resources["faith"] -= unit_cost["faith"]

        # Create training unit
        unit_properties = _get_unit_properties(unit_type)
        new_unit = Unit.create_unit(
            unit_type=UnitType(unit_type),
            owner=player.id,
            position=Position(x=tile.x, y=tile.y)
        )
        
        # Set training status and time
        new_unit.status = UnitStatus.TRAINING
        training_time = unit_properties["training_time"]
        
        # Apply barracks training speed bonus if training at barracks
        if tile.type == TileType.BARRACKS:
            training_time *= 0.5  # 50% faster training (0.5x multiplier)
            
        new_unit.metadata.training_time = training_time
        new_unit.metadata.training_started = datetime.now().timestamp()
        
        # Add unit to game state
        room.state.units.append(new_unit)
        room.state.last_update = datetime.now().timestamp()

        # Update player stats
        player.stats.units_created += 1

        # Broadcast unit update to all clients
        room._broadcast_unit_update()

        # Broadcast to all players in room
        await broadcast_to_room(room, {
            "type": "unit_training_started",
            "payload": {
                "player_id": player_id,
                "unit_type": unit_type,
                "tile_id": tile_id,
                "unit_id": new_unit.id,
                "training_time": new_unit.metadata.training_time,
                "new_resources": player.resources
            },
            "timestamp": datetime.now().isoformat()
        })

        logger.info(f"Unit training started by {player_id}: {unit_type} at {tile_id}")

    except Exception as e:
        logger.error(f"Error training unit: {e}")
        await send_error_response(websocket, f"Unit training failed: {str(e)}", "UNIT_TRAINING_ERROR")

def _get_unit_cost(unit_type: str) -> dict:
    """Get the resource cost for training a unit."""
    unit_costs = {
        "infantry": {"gold": 50, "food": 30, "faith": 0},
        "archer": {"gold": 60, "food": 20, "faith": 10},
        "knight": {"gold": 100, "food": 40, "faith": 20},
        "siege": {"gold": 120, "food": 60, "faith": 30}
    }
    
    return unit_costs.get(unit_type, {"gold": 50, "food": 30, "faith": 0})

def _can_afford_unit(player, cost: dict) -> bool:
    """Check if player can afford the unit cost."""
    return (player.resources["gold"] >= cost["gold"] and
            player.resources["food"] >= cost["food"] and
            player.resources["faith"] >= cost["faith"])

def _get_unit_properties(unit_type: str) -> dict:
    """Get the properties for a unit type."""
    properties = {
        "infantry": {
            "training_time": 30.0,  # 30 seconds
            "hp": 100,
            "max_hp": 100,
            "attack": 20,
            "defense": 15,
            "speed": 1.0,
            "range": 1
        },
        "archer": {
            "training_time": 25.0,  # 25 seconds
            "hp": 75,
            "max_hp": 75,
            "attack": 25,
            "defense": 10,
            "speed": 1.5,
            "range": 2
        },
        "knight": {
            "training_time": 45.0,  # 45 seconds
            "hp": 150,
            "max_hp": 150,
            "attack": 30,
            "defense": 20,
            "speed": 0.8,
            "range": 1
        },
        "siege": {
            "training_time": 60.0,  # 60 seconds
            "hp": 120,
            "max_hp": 120,
            "attack": 50,
            "defense": 5,
            "speed": 0.5,
            "range": 2
        }
    }
    
    return properties.get(unit_type, properties["infantry"])

async def handle_move_unit(room: Room, player_id: str, data: dict, websocket: WebSocket):
    """Handle unit movement command from a player"""
    try:
        # Validate required fields
        required_fields = ["unit_id", "target_x", "target_y"]
        for field in required_fields:
            if field not in data:
                await send_error_response(websocket, f"Missing required field: {field}", "MISSING_FIELD")
                return

        unit_id = data["unit_id"]
        target_x = data["target_x"]
        target_y = data["target_y"]
        
        # Validate coordinates
        if not isinstance(target_x, int) or not isinstance(target_y, int):
            await send_error_response(websocket, "Target coordinates must be integers", "INVALID_COORDINATES")
            return
            
        if target_x < 0 or target_x >= room.state.game_settings.map_size or target_y < 0 or target_y >= room.state.game_settings.map_size:
            await send_error_response(websocket, "Target coordinates out of bounds", "COORDINATES_OUT_OF_BOUNDS")
            return

        # Find the unit
        unit = None
        for u in room.state.units:
            if u.id == unit_id:
                unit = u
                break
        
        if not unit:
            await send_error_response(websocket, "Unit not found", "UNIT_NOT_FOUND")
            return

        # Find the player
        player = None
        for p in room.state.players:
            if p.name == player_id:
                player = p
                break
        
        if not player:
            await send_error_response(websocket, "Player not found", "PLAYER_NOT_FOUND")
            return

        # Validate unit ownership
        if unit.owner != player.id:
            await send_error_response(websocket, "You don't own this unit", "UNIT_NOT_OWNED")
            return

        # Validate unit can move (not training, dead, or already moving)
        if unit.status == UnitStatus.TRAINING:
            await send_error_response(websocket, "Unit is still training", "UNIT_TRAINING")
            return
        if unit.status == UnitStatus.DEAD:
            await send_error_response(websocket, "Unit is dead", "UNIT_DEAD")
            return
        if unit.status == UnitStatus.MOVING:
            await send_error_response(websocket, "Unit is already moving", "UNIT_ALREADY_MOVING")
            return

        # Check if target position is the same as current position
        if unit.position.x == target_x and unit.position.y == target_y:
            await send_error_response(websocket, "Unit is already at target position", "ALREADY_AT_TARGET")
            return

        # Check if target position is occupied by another unit
        if any(other_unit.position.x == target_x and other_unit.position.y == target_y and other_unit.id != unit_id
               for other_unit in room.state.units if other_unit.status != UnitStatus.DEAD):
            await send_error_response(websocket, "Target position is occupied by another unit", "POSITION_OCCUPIED")
            return

        # Calculate movement distance and validate range
        distance = abs(unit.position.x - target_x) + abs(unit.position.y - target_y)
        max_move_distance = _get_unit_move_distance(unit.type)
        
        if distance > max_move_distance:
            await send_error_response(websocket, f"Target too far. Max distance: {max_move_distance}", "TARGET_TOO_FAR")
            return

        # Use pathfinding to find route
        pathfinder = Pathfinder(room.state.game_settings.map_size, room.state.game_settings.map_size)
        
        # Add obstacles (other units and impassable tiles)
        obstacles = []
        for other_unit in room.state.units:
            if other_unit.id != unit_id and other_unit.status != UnitStatus.DEAD:
                obstacles.append((other_unit.position.x, other_unit.position.y))
        
        # Add impassable tiles (if any)
        for tile in room.state.tiles:
            if tile.metadata and tile.metadata.speed_multiplier == 0:
                obstacles.append((tile.x, tile.y))
        
        # Find path
        path = pathfinder.find_path(
            (unit.position.x, unit.position.y),
            (target_x, target_y),
            obstacles
        )
        
        if not path:
            await send_error_response(websocket, "No valid path to target", "NO_PATH")
            return

        # Update unit position and status
        unit.position.x = target_x
        unit.position.y = target_y
        unit.status = UnitStatus.IDLE  # Unit completes movement instantly for now
        
        # Calculate movement cost (could be based on terrain)
        movement_cost = _calculate_movement_cost(unit, path, room.state.tiles)
        
        # Update last update time
        room.state.last_update = datetime.now().timestamp()

        # Broadcast unit update to all clients
        room._broadcast_unit_update()

        # Broadcast movement to all players
        await broadcast_to_room(room, {
            "type": "unit_moved",
            "payload": {
                "player_id": player_id,
                "unit_id": unit_id,
                "from_x": path[0][0],
                "from_y": path[0][1],
                "to_x": target_x,
                "to_y": target_y,
                "path": path,
                "movement_cost": movement_cost
            },
            "timestamp": datetime.now().isoformat()
        })

        logger.info(f"Unit moved by {player_id}: {unit_id} to ({target_x}, {target_y})")

    except Exception as e:
        logger.error(f"Error moving unit: {e}")
        await send_error_response(websocket, f"Unit movement failed: {str(e)}", "UNIT_MOVEMENT_ERROR")

def _get_unit_move_distance(unit_type: str) -> int:
    """Get the maximum movement distance for a unit type."""
    move_distances = {
        "infantry": 3,
        "archer": 4,
        "knight": 2,
        "siege": 1
    }
    
    return move_distances.get(unit_type, 2)

def _calculate_movement_cost(unit, path, tiles) -> int:
    """Calculate the movement cost based on terrain."""
    cost = len(path) - 1  # Base cost is path length
    
    # Add terrain modifiers
    for x, y in path[1:]:  # Skip starting position
        # Find tile at position
        tile = None
        for t in tiles:
            if t.x == x and t.y == y:
                tile = t
                break
        
        if tile and tile.metadata and tile.metadata.speed_multiplier < 1.0:
            cost += int(1 / tile.metadata.speed_multiplier)
    
    return cost

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