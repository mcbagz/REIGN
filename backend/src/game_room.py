"""
Room management for multiplayer games in Carcassonne: War of Ages
"""
from dataclasses import dataclass, field
from typing import Dict, Set, List, Optional
from datetime import datetime
import uuid
import asyncio
from fastapi import WebSocket

from .models.game_state import GameState, Player, GameStatus, GameSettings, TechLevel
from .models.unit import Unit, UnitSystem
from .models.tile import Tile


@dataclass
class Room:
    """Represents a game room with players and game state."""
    room_id: str
    players: Dict[str, Player] = field(default_factory=dict)  # player_id -> Player
    connections: Dict[str, WebSocket] = field(default_factory=dict)  # player_id -> WebSocket
    state: Optional[GameState] = field(default=None)
    tick: int = 0
    created_at: datetime = field(default_factory=datetime.now)
    last_activity: datetime = field(default_factory=datetime.now)
    loop_task: Optional[asyncio.Task] = None
    unit_system: UnitSystem = field(default_factory=UnitSystem)

    def __post_init__(self):
        """Initialize room after creation."""
        # Initialize basic state without players (will be created when players join)
        self.state = None
        
    def add_player(self, player_id: str, websocket: WebSocket) -> bool:
        """Add a player to the room. Returns True if successful."""
        max_players = 4  # Default max players
        if self.state and self.state.game_settings:
            max_players = self.state.game_settings.max_players
            
        if len(self.players) >= max_players:
            return False
            
        if player_id in self.players:
            # Player reconnecting
            self.connections[player_id] = websocket
            return True
            
        # New player
        player = Player(
            id=len(self.players),
            name=player_id,
            color=f"#{''.join([f'{i:02x}' for i in [hash(player_id) % 256, (hash(player_id) * 2) % 256, (hash(player_id) * 3) % 256]])}",
            is_connected=True,
            is_eliminated=False,
            resources={
                "gold": 100,
                "food": 100,
                "faith": 0
            },
            tech_level=TechLevel.MANOR,
            capital_city=None,
            stats=None
        )
        
        self.players[player_id] = player
        self.connections[player_id] = websocket
        self.last_activity = datetime.now()
        
        # Decrease reserved player count when player actually joins
        if hasattr(self, 'reserved_players') and self.reserved_players > 0:
            self.reserved_players -= 1
        
        # Initialize game state when we have enough players
        if len(self.players) >= 2 and self.state is None:
            self._initialize_game_state()
        elif self.state and len(self.players) >= 2 and self.state.status == GameStatus.WAITING:
            self.state.status = GameStatus.PLAYING
            self.state.game_start_time = datetime.now().timestamp()
            
        # Add player to state if it exists
        if self.state:
            self.state.players.append(player)
            
        return True
    
    def remove_player(self, player_id: str) -> bool:
        """Remove a player from the room. Returns True if successful."""
        if player_id not in self.players:
            return False
            
        # Remove connection
        if player_id in self.connections:
            del self.connections[player_id]
            
        # Mark player as eliminated but keep in game state for now
        if player_id in self.players:
            self.players[player_id].is_eliminated = True
            
        self.last_activity = datetime.now()
        return True
    
    def _initialize_game_state(self):
        """Initialize the game state with current players."""
        if len(self.players) < 2:
            return
            
        self.state = GameState(
            game_id=self.room_id,
            status=GameStatus.WAITING,
            current_player=0,
            turn_number=0,
            turn_time_remaining=15.0,
            game_start_time=datetime.now().timestamp(),
            last_update=datetime.now().timestamp(),
            players=list(self.players.values()),
            tiles=[],
            units=[],
            available_tiles=[],
            current_tile_options=None,
            winner=None,
            game_settings=GameSettings(
                max_players=4,
                turn_duration=15.0,
                max_game_duration=1800.0,
                map_size=40,
                resource_update_interval=1.0
            ),
            events=[]
        )
    
    def get_active_players(self) -> List[Player]:
        """Get all non-eliminated players."""
        return [player for player in self.players.values() if not player.is_eliminated]
    
    def get_player_connections(self) -> List[WebSocket]:
        """Get all active WebSocket connections."""
        return [conn for player_id, conn in self.connections.items() 
                if player_id in self.players and not self.players[player_id].is_eliminated]
    
    def is_empty(self) -> bool:
        """Check if room has no active players."""
        return len(self.players) == 0
    
    def should_cleanup(self) -> bool:
        """Check if room should be cleaned up (empty for too long)."""
        if self.is_empty():
            inactive_time = datetime.now() - self.last_activity
            return inactive_time.total_seconds() > 300  # 5 minutes
        return False
    
    def start_game_loop(self):
        """Start the game loop for this room."""
        if self.loop_task is None or self.loop_task.done():
            self.loop_task = asyncio.create_task(self._game_loop())
    
    def stop_game_loop(self):
        """Stop the game loop for this room."""
        if self.loop_task and not self.loop_task.done():
            self.loop_task.cancel()
    
    async def _game_loop(self):
        """Internal game loop running at 10 FPS."""
        try:
            last_broadcast_tick = 0
            while not self.is_empty():
                # Update game state
                await self._update_game_state()
                
                # Only broadcast state when necessary (performance optimization)
                # Broadcast every 3 ticks (0.3 seconds) instead of every tick
                if self.tick - last_broadcast_tick >= 3:
                    await self._broadcast_state()
                    last_broadcast_tick = self.tick
                
                # Wait for next tick (10 FPS = 100ms)
                await asyncio.sleep(0.1)
                self.tick += 1
                
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Error in game loop for room {self.room_id}: {e}")
    
    async def _update_game_state(self):
        """Update the game state for one tick."""
        if self.state is None:
            return
            
        now = datetime.now().timestamp()
        self.state.last_update = now
        
        # Update turn timer
        if self.state.status == GameStatus.PLAYING:
            self.state.turn_time_remaining -= 0.1
            if self.state.turn_time_remaining <= 0:
                self._advance_turn()
        
        # Update unit movements and combat
        if self.state.units:
            self.unit_system.update_units(0.1)  # deltaTime = 0.1 seconds
        
        # Update resource generation (every second)
        if self.tick % 10 == 0:  # 10 ticks = 1 second at 10 FPS
            self._update_resources()
    
    def _advance_turn(self):
        """Advance to the next player's turn."""
        if self.state is None:
            return
            
        active_players = self.get_active_players()
        if not active_players:
            return
            
        # Find next active player
        current_player_id = self.state.current_player
        next_player_id = (current_player_id + 1) % len(self.state.players)
        
        # Skip eliminated players
        attempts = 0
        while attempts < len(self.state.players):
            if not self.state.players[next_player_id].is_eliminated:
                break
            next_player_id = (next_player_id + 1) % len(self.state.players)
            attempts += 1
        
        self.state.current_player = next_player_id
        self.state.turn_number += 1
        self.state.turn_time_remaining = self.state.game_settings.turn_duration
    
    def _update_resources(self):
        """Update resource generation for all players."""
        if self.state is None:
            return
            
        for player in self.state.players:
            if player.is_eliminated:
                continue
                
            # Calculate resource generation based on tiles and workers
            # This is a simplified version - full implementation would check connected tiles
            player.resources["gold"] = min(player.resources["gold"] + 10, 500)
            player.resources["food"] = min(player.resources["food"] + 10, 500)
            player.resources["faith"] = min(player.resources["faith"] + 5, 500)
    
    async def _broadcast_state(self):
        """Broadcast current game state to all connected players."""
        if not self.connections or self.state is None:
            return
            
        message = {
            "type": "state",
            "payload": self.state.model_dump(),
            "timestamp": datetime.now().isoformat(),
            "tick": self.tick
        }
        
        import orjson
        message_str = orjson.dumps(message).decode()
        
        # Send to all connected players
        disconnected = []
        for player_id, connection in self.connections.items():
            try:
                await connection.send_text(message_str)
            except Exception as e:
                print(f"Failed to send to player {player_id}: {e}")
                disconnected.append(player_id)
        
        # Remove disconnected players
        for player_id in disconnected:
            self.remove_player(player_id)


class RoomManager:
    """Manages all active game rooms."""
    
    def __init__(self):
        self.rooms: Dict[str, Room] = {}
        self.cleanup_task: Optional[asyncio.Task] = None
    
    def create_room(self, room_id: Optional[str] = None) -> Room:
        """Create a new room."""
        if room_id is None:
            room_id = str(uuid.uuid4())
            
        room = Room(room_id=room_id)
        self.rooms[room_id] = room
        
        # Start cleanup task if not running
        if self.cleanup_task is None or self.cleanup_task.done():
            self.cleanup_task = asyncio.create_task(self._cleanup_loop())
        
        return room
    
    def get_room(self, room_id: str) -> Optional[Room]:
        """Get a room by ID."""
        return self.rooms.get(room_id)
    
    def get_or_create_room(self, room_id: str) -> Room:
        """Get existing room or create new one."""
        room = self.get_room(room_id)
        if room is None:
            room = self.create_room(room_id)
        return room
    
    def remove_room(self, room_id: str) -> bool:
        """Remove a room."""
        if room_id in self.rooms:
            room = self.rooms[room_id]
            room.stop_game_loop()
            del self.rooms[room_id]
            return True
        return False
    
    def get_active_rooms(self) -> List[Room]:
        """Get all active rooms."""
        return [room for room in self.rooms.values() if not room.is_empty()]
    
    async def _cleanup_loop(self):
        """Periodically clean up inactive rooms."""
        try:
            while True:
                await asyncio.sleep(60)  # Check every minute
                
                rooms_to_remove = []
                for room_id, room in self.rooms.items():
                    if room.should_cleanup():
                        rooms_to_remove.append(room_id)
                
                for room_id in rooms_to_remove:
                    print(f"Cleaning up inactive room: {room_id}")
                    self.remove_room(room_id)
                    
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Error in cleanup loop: {e}")


# Global room manager instance
room_manager = RoomManager() 