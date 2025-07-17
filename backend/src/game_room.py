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
        from .models.game_state import PlayerStats
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
            stats=PlayerStats()  # Initialize stats to prevent None access
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
        """Initialize the game state with current players and complete game map."""
        if len(self.players) < 2:
            return
            
        # Initialize basic game state structure
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
        
        # Initialize the actual game map with capitals and resources
        self._initialize_game_map()
        
        # Generate initial tile options for the first player
        self.state.current_tile_options = self._generate_tile_options()
        
        # Generate initial tile offers for the first player
        self._generate_tile_offers_for_player(self.state.current_player)
        
        print(f"Game state initialized with {len(self.state.tiles)} tiles")
        
    def _initialize_game_map(self):
        """Initialize the game map with capitals, resources, and initial tiles."""
        from .models.tile import Resources, TileMetadata, TileType
        
        # Place capital cities in quadrants
        self._place_capital_cities()
        
        # Place field tiles around capitals
        self._place_field_tiles_around_capitals()
        
        # Place some city tiles for variety
        self._place_city_tiles()
        
        # Scatter resource tiles randomly
        self._scatter_resource_tiles()
        
        print(f"Game map initialized with {len(self.state.tiles)} tiles")
        
    def _place_capital_cities(self):
        """Place capital cities in the four quadrants of the map."""
        from .models.tile import Resources, TileMetadata, TileType
        
        # Capital positions matching client layout
        capital_positions = [
            {"x": 10, "y": 10},  # Top-left quadrant
            {"x": 30, "y": 10},  # Top-right quadrant  
            {"x": 10, "y": 30},  # Bottom-left quadrant
            {"x": 30, "y": 30}   # Bottom-right quadrant
        ]
        
        for index, pos in enumerate(capital_positions):
            # Only place capitals for active players
            owner_id = index if index < len(self.state.players) else None
            
            capital = Tile(
                id=f"{pos['x']},{pos['y']}",
                type=TileType.CAPITAL_CITY,
                x=pos['x'],
                y=pos['y'],
                edges=["city", "city", "city", "city"],  # All sides are city
                hp=1000,
                max_hp=1000,
                owner=owner_id,
                resources=Resources(gold=2, food=0, faith=0),
                placed_at=datetime.now().timestamp(),
                metadata=TileMetadata(can_train=True, worker_capacity=2)
            )
            
            self.state.tiles.append(capital)
            
            # Set capital position for player
            if owner_id is not None and owner_id < len(self.state.players):
                from .models.unit import Position
                self.state.players[owner_id].capital_city = Position(x=pos['x'], y=pos['y'])
                
        print(f"Placed {len(capital_positions)} capital cities")
        
    def _place_field_tiles_around_capitals(self):
        """Place field tiles around each capital city."""
        from .models.tile import Resources, TileMetadata, TileType
        
        capital_positions = [
            {"x": 10, "y": 10},
            {"x": 30, "y": 10},
            {"x": 10, "y": 30},
            {"x": 30, "y": 30}
        ]
        
        for capital_index, capital in enumerate(capital_positions):
            # 8 surrounding positions
            positions = [
                {"x": capital['x'] - 1, "y": capital['y']},      # West
                {"x": capital['x'] + 1, "y": capital['y']},      # East
                {"x": capital['x'], "y": capital['y'] - 1},      # North
                {"x": capital['x'], "y": capital['y'] + 1},      # South
                {"x": capital['x'] - 1, "y": capital['y'] - 1},  # Northwest
                {"x": capital['x'] + 1, "y": capital['y'] - 1},  # Northeast
                {"x": capital['x'] - 1, "y": capital['y'] + 1},  # Southwest
                {"x": capital['x'] + 1, "y": capital['y'] + 1}   # Southeast
            ]
            
            for pos_index, pos in enumerate(positions):
                # Check bounds and avoid duplicates
                if (0 <= pos['x'] < self.state.game_settings.map_size and 
                    0 <= pos['y'] < self.state.game_settings.map_size and
                    not self._is_position_occupied(pos['x'], pos['y'])):
                    
                    field_tile = Tile(
                        id=f"{pos['x']},{pos['y']}",
                        type=TileType.FIELD,
                        x=pos['x'],
                        y=pos['y'],
                        edges=["field", "field", "field", "field"],
                        hp=30,
                        max_hp=30,
                        owner=None,
                        resources=Resources(gold=0, food=20, faith=0),
                        placed_at=datetime.now().timestamp(),
                        metadata=TileMetadata(can_train=False, worker_capacity=1)
                    )
                    
                    self.state.tiles.append(field_tile)
                    
        print("Placed field tiles around capitals")
        
    def _place_city_tiles(self):
        """Place city tiles at strategic positions."""
        from .models.tile import Resources, TileMetadata, TileType
        
        city_positions = [
            {"x": 15, "y": 15},
            {"x": 25, "y": 15},
            {"x": 15, "y": 25},
            {"x": 25, "y": 25}
        ]
        
        for index, pos in enumerate(city_positions):
            if not self._is_position_occupied(pos['x'], pos['y']):
                city_tile = Tile(
                    id=f"{pos['x']},{pos['y']}",
                    type=TileType.CITY,
                    x=pos['x'],
                    y=pos['y'],
                    edges=["city", "city", "city", "city"],
                    hp=60,
                    max_hp=60,
                    owner=None,
                    resources=Resources(gold=30, food=30, faith=0),
                    placed_at=datetime.now().timestamp(),
                    metadata=TileMetadata(can_train=True, worker_capacity=1)
                )
                
                self.state.tiles.append(city_tile)
                
        print("Placed city tiles")
        
    def _scatter_resource_tiles(self):
        """Scatter resource tiles randomly across the map."""
        from .models.tile import Resources, TileMetadata, TileType
        import random
        
        resource_types = [
            TileType.MINE,
            TileType.ORCHARD,
            TileType.MONASTERY,
            TileType.MARSH
        ]
        
        tiles_per_type = 3  # 3 tiles per resource type
        
        for tile_type in resource_types:
            for i in range(tiles_per_type):
                attempts = 0
                while attempts < 100:
                    x = random.randint(0, self.state.game_settings.map_size - 1)
                    y = random.randint(0, self.state.game_settings.map_size - 1)
                    
                    if not self._is_position_occupied(x, y) and not self._is_near_capital(x, y):
                        # Create resource tile with appropriate properties
                        resources, hp, metadata = self._get_resource_tile_properties(tile_type)
                        
                        resource_tile = Tile(
                            id=f"{x},{y}",
                            type=tile_type,
                            x=x,
                            y=y,
                            edges=self._get_tile_edges(tile_type),
                            hp=hp,
                            max_hp=hp,
                            owner=None,
                            resources=resources,
                            placed_at=datetime.now().timestamp(),
                            metadata=metadata
                        )
                        
                        self.state.tiles.append(resource_tile)
                        break
                        
                    attempts += 1
                    
        print("Scattered resource tiles")
        
    def _is_position_occupied(self, x: int, y: int) -> bool:
        """Check if a position is already occupied by a tile."""
        for tile in self.state.tiles:
            if tile.x == x and tile.y == y:
                return True
        return False
        
    def _is_near_capital(self, x: int, y: int) -> bool:
        """Check if position is too close to a capital city."""
        min_distance = 3
        capital_positions = [
            {"x": 10, "y": 10},
            {"x": 30, "y": 10},
            {"x": 10, "y": 30},
            {"x": 30, "y": 30}
        ]
        
        for capital in capital_positions:
            distance = abs(x - capital['x']) + abs(y - capital['y'])
            if distance < min_distance:
                return True
        return False
        
    def _get_resource_tile_properties(self, tile_type):
        """Get properties for resource tiles."""
        from .models.tile import Resources, TileMetadata, TileType
        
        properties = {
            TileType.MINE: {
                "resources": Resources(gold=2, food=0, faith=0),  # Changed from 50 to 2 as per GDD
                "hp": 150,
                "metadata": TileMetadata(can_train=False, worker_capacity=0)
            },
            TileType.ORCHARD: {
                "resources": Resources(gold=0, food=2, faith=0),  # Changed from 50 to 2 as per GDD
                "hp": 150,
                "metadata": TileMetadata(can_train=False, worker_capacity=0)
            },
            TileType.MONASTERY: {
                "resources": Resources(gold=0, food=0, faith=50),
                "hp": 300,
                "metadata": TileMetadata(can_train=False, worker_capacity=1)
            },
            TileType.MARSH: {
                "resources": Resources(gold=0, food=0, faith=0),
                "hp": 30,
                "metadata": TileMetadata(can_train=False, worker_capacity=0, speed_multiplier=0.3)
            }
        }
        
        props = properties.get(tile_type, {
            "resources": Resources(gold=0, food=0, faith=0),
            "hp": 50,
            "metadata": TileMetadata(can_train=False, worker_capacity=0)
        })
        
        return props["resources"], props["hp"], props["metadata"]
        
    def _get_tile_edges(self, tile_type):
        """Get appropriate edges for tile type."""
        from .models.tile import TileType
        
        edge_mappings = {
            TileType.MINE: ["mine", "mine", "mine", "mine"],
            TileType.ORCHARD: ["orchard", "orchard", "orchard", "orchard"],
            TileType.MONASTERY: ["monastery", "monastery", "monastery", "monastery"],
            TileType.MARSH: ["marsh", "marsh", "marsh", "marsh"],
            TileType.FIELD: ["field", "field", "field", "field"],
            TileType.CITY: ["city", "city", "city", "city"],
            TileType.BARRACKS: ["barracks", "barracks", "barracks", "barracks"],
            TileType.WATCHTOWER: ["watchtower", "watchtower", "watchtower", "watchtower"]
        }
        
        return edge_mappings.get(tile_type, ["field", "field", "field", "field"])
        
    def _generate_tile_options(self):
        """Generate 3 random tile options for the current player."""
        from .models.tile import TileType
        import random
        
        # Available tile types for placement (excluding capitals)
        available_types = [
            TileType.CITY,
            TileType.FIELD,
            TileType.MONASTERY,
            TileType.BARRACKS,
            TileType.WATCHTOWER
        ]
        
        # Return 3 random options as string values (for validation consistency)
        selected_types = random.sample(available_types, min(3, len(available_types)))
        return [tile_type.value for tile_type in selected_types]
    
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
        
        # Update unit training
        self._update_unit_training(now)
        
        # Update unit movements and combat
        if self.state.units:
            self.unit_system.update_units(0.1)  # deltaTime = 0.1 seconds
        
        # Update resource generation (every second)
        if self.tick % 10 == 0:  # 10 ticks = 1 second at 10 FPS
            self._update_resources()
            
    def _update_unit_training(self, current_time: float):
        """Update unit training progress and complete training when ready."""
        from .models.unit import UnitStatus
        
        units_completed = []
        
        for unit in self.state.units:
            if unit.status == UnitStatus.TRAINING:
                # Check if training is complete
                if (unit.metadata.training_started and 
                    current_time - unit.metadata.training_started >= unit.metadata.training_time):
                    
                    # Complete training
                    unit.status = UnitStatus.IDLE
                    unit.metadata.training_started = None
                    unit.metadata.training_time = None
                    units_completed.append(unit)
                    
        # Broadcast unit training completions
        if units_completed:
            for unit in units_completed:
                asyncio.create_task(self._broadcast_unit_training_complete(unit))
            
            # Also broadcast updated unit list to all clients
            self._broadcast_unit_update()
                
    async def _broadcast_unit_training_complete(self, unit):
        """Broadcast unit training completion to all players."""
        import orjson
        
        message = {
            "type": "unit_training_complete",
            "payload": {
                "unit_id": unit.id,
                "unit_type": unit.type,
                "position": {"x": unit.position.x, "y": unit.position.y},
                "owner": unit.owner
            },
            "timestamp": datetime.now().isoformat()
        }
        
        message_str = orjson.dumps(message).decode()
        
        # Send to all connected players
        disconnected = []
        for player_id, connection in self.connections.items():
            if connection.client_state.name != "CONNECTED":
                disconnected.append(player_id)
                continue
                
            try:
                await connection.send_text(message_str)
            except Exception as e:
                print(f"Failed to send unit training complete to {player_id}: {e}")
                disconnected.append(player_id)
        
        # Remove disconnected players
        for player_id in disconnected:
            self.remove_player(player_id)
    
    def _broadcast_unit_update(self):
        """Broadcast updated unit list to all connected clients."""
        if not self.state or not self.state.units:
            return
            
        # Convert units to serializable format
        units_data = []
        for unit in self.state.units:
            unit_data = {
                "id": unit.id,
                "type": unit.type.value,
                "owner": unit.owner,
                "position": {"x": unit.position.x, "y": unit.position.y},
                "status": unit.status.value,
                "hp": unit.hp,
                "max_hp": unit.max_hp,
                "attack": unit.attack,
                "defense": unit.defense,
                "movement": unit.movement,
                "range": unit.range
            }
            units_data.append(unit_data)
        
        # Create message payload
        message = {
            "type": "state",
            "payload": {
                "units": units_data
            }
        }
        
        # Broadcast to all clients
        for player_id, connection in self.connections.items():
            try:
                import orjson
                message_str = orjson.dumps(message).decode()
                asyncio.create_task(connection.send_text(message_str))
            except Exception as e:
                print(f"Failed to send unit update to {player_id}: {e}")
        
        print(f"Broadcast unit update to {len(self.connections)} clients")
        
    def _broadcast_tiles_update(self):
        """Broadcast updated tiles list to all connected clients."""
        if not self.state or not self.state.tiles:
            return
            
        # Convert tiles to serializable format
        tiles_data = []
        for tile in self.state.tiles:
            tile_data = {
                "id": tile.id,
                "type": tile.type.value,
                "x": tile.x,
                "y": tile.y,
                "edges": tile.edges,
                "hp": tile.hp,
                "max_hp": tile.max_hp,
                "owner": tile.owner,
                "resources": {
                    "gold": tile.resources.gold,
                    "food": tile.resources.food,
                    "faith": tile.resources.faith
                },
                "placed_at": tile.placed_at,
                "metadata": {
                    "can_train": tile.metadata.can_train if tile.metadata else False,
                    "worker_capacity": tile.metadata.worker_capacity if tile.metadata else 0
                }
            }
            
            # Add worker info if present
            if tile.worker:
                tile_data["worker"] = {
                    "id": tile.worker.id,
                    "type": tile.worker.type.value,
                    "owner": tile.worker.owner
                }
            else:
                tile_data["worker"] = None
                
            tiles_data.append(tile_data)
        
        # Create message payload
        message = {
            "type": "state",
            "payload": {
                "tiles": tiles_data
            }
        }
        
        # Broadcast to all clients
        for player_id, connection in self.connections.items():
            try:
                import orjson
                message_str = orjson.dumps(message).decode()
                asyncio.create_task(connection.send_text(message_str))
            except Exception as e:
                print(f"Failed to send tiles update to {player_id}: {e}")
        
        print(f"Broadcast tiles update to {len(self.connections)} clients")
    
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
        
        # Generate tile offers for the new active player
        self._generate_tile_offers_for_player(next_player_id)
        
        # Broadcast turn change and tile offers
        self._broadcast_turn_change()
        
    def _generate_tile_offers_for_player(self, player_id: int):
        """Generate 3 tile offers for the specified player."""
        from .models.tile import TileType
        import random
        
        # Available tile types for placement
        available_types = [
            TileType.CITY,
            TileType.FIELD,
            TileType.MONASTERY,
            TileType.BARRACKS,
            TileType.WATCHTOWER
        ]
        
        # Generate 3 random tile offers
        tile_offers = []
        tile_types_for_validation = []
        
        for i in range(3):
            tile_type = random.choice(available_types)
            tile_offer = {
                "id": f"offer_{self.state.turn_number}_{i}",
                "type": tile_type.value,
                "resources": self._get_tile_resource_generation(tile_type),
                "hp": self._get_tile_hp(tile_type),
                "can_train": self._can_tile_train(tile_type)
            }
            tile_offers.append(tile_offer)
            tile_types_for_validation.append(tile_type.value)  # Store string values for validation
        
        # Store offers in game state (use string values for validation)
        self.state.current_tile_options = tile_types_for_validation
        
        # Send tile offers to the active player
        self._send_tile_offers_to_player(player_id, tile_offers)
        
        print(f"Generated tile offers for player {player_id}: {tile_types_for_validation}")
        
    def _send_tile_offers_to_player(self, player_id: int, tile_offers: list):
        """Send tile offers to all players (for visibility), but only the active player can place them."""
        # Create tile offer message
        message = {
            "type": "state",
            "payload": {
                "tileOffer": {
                    "playerId": player_id,
                    "tiles": tile_offers,
                    "isMyTurn": False  # Will be set to True for the active player
                }
            }
        }
        
        # Send to all players, marking if it's their turn
        for pid, connection in self.connections.items():
            # Check if this player is the active player
            player = self.players.get(pid)
            if player and player.id == player_id:
                # This is the active player's turn
                message["payload"]["tileOffer"]["isMyTurn"] = True
            else:
                # This is not the active player's turn
                message["payload"]["tileOffer"]["isMyTurn"] = False
            
            try:
                import orjson
                message_str = orjson.dumps(message).decode()
                asyncio.create_task(connection.send_text(message_str))
            except Exception as e:
                print(f"Failed to send tile offers to {pid}: {e}")
        
        print(f"Sent tile offers to all players (active player: {player_id})")
            
    def _broadcast_turn_change(self):
        """Broadcast turn change to all players."""
        if not self.state:
            return
            
        message = {
            "type": "state",
            "payload": {
                "current_player": self.state.current_player,
                "turn_number": self.state.turn_number,
                "turn_time_remaining": self.state.turn_time_remaining
            }
        }
        
        # Broadcast to all clients
        for player_id, connection in self.connections.items():
            try:
                import orjson
                message_str = orjson.dumps(message).decode()
                asyncio.create_task(connection.send_text(message_str))
            except Exception as e:
                print(f"Failed to broadcast turn change to {player_id}: {e}")
                
    def _get_tile_resource_generation(self, tile_type):
        """Get resource generation for a tile type."""
        from .models.tile import TileType
        
        resource_generation = {
            TileType.CITY: {"gold": 30, "food": 30, "faith": 0},
            TileType.FIELD: {"gold": 10, "food": 10, "faith": 0},
            TileType.MONASTERY: {"gold": 0, "food": 0, "faith": 50},
            TileType.BARRACKS: {"gold": 0, "food": 0, "faith": 0},
            TileType.WATCHTOWER: {"gold": 0, "food": 0, "faith": 0}
        }
        
        return resource_generation.get(tile_type, {"gold": 0, "food": 0, "faith": 0})
        
    def _get_tile_hp(self, tile_type):
        """Get HP for a tile type."""
        from .models.tile import TileType
        
        tile_hp = {
            TileType.CITY: 60,
            TileType.FIELD: 40,
            TileType.MONASTERY: 80,
            TileType.BARRACKS: 100,
            TileType.WATCHTOWER: 120
        }
        
        return tile_hp.get(tile_type, 40)
        
    def _can_tile_train(self, tile_type):
        """Check if a tile type can train units."""
        from .models.tile import TileType
        
        training_tiles = [TileType.CITY, TileType.BARRACKS, TileType.CAPITAL_CITY]
        return tile_type in training_tiles
    
    def _update_resources(self):
        """Update resources for all players based on tiles and workers."""
        if not self.state or not self.state.players:
            return
            
        # Update resources for each player
        for player in self.state.players:
            if player.is_eliminated:
                continue
                
            generation = self._calculate_player_resource_generation(player.id)
            
            # Apply generation with caps
            for resource_type, amount in generation.items():
                current = player.resources.get(resource_type, 0)
                new_amount = min(current + amount, 500)  # Cap at 500
                player.resources[resource_type] = new_amount
            
            # Log resource update
            print(f"Player {player.id} resources updated: {player.resources}")
        
        # Broadcast resource updates to all clients
        self._broadcast_resource_update()
        
    def _broadcast_resource_update(self):
        """Broadcast resource updates to all connected clients."""
        if not self.state or not self.state.players:
            return
            
        # Prepare resource data for all players
        resource_data = {}
        for player in self.state.players:
            resource_data[str(player.id)] = player.resources
        
        # Create message payload
        message = {
            "type": "state",
            "payload": {
                "resources": resource_data
            }
        }
        
        # Broadcast to all clients in the room
        for player_id, connection in self.connections.items():
            try:
                import orjson
                message_str = orjson.dumps(message).decode()
                asyncio.create_task(connection.send_text(message_str))
            except Exception as e:
                print(f"Failed to send resource update to {player_id}: {e}")
        
        print(f"Broadcast resource update to {len(self.connections)} clients")
    
    def _calculate_player_resource_generation(self, player_id: int) -> dict:
        """Calculate resource generation for a specific player based on their tiles."""
        total_resources = {"gold": 0, "food": 0, "faith": 0}
        
        # Get all tiles owned by this player
        player_tiles = [tile for tile in self.state.tiles if tile.owner == player_id]
        
        # Group connected tiles by type for additive resource generation
        visited_tiles = set()
        
        for tile in player_tiles:
            if tile.id in visited_tiles:
                continue
                
            # Find connected component of same type
            connected_tiles = self._find_connected_tiles_of_type(tile, player_tiles, visited_tiles)
            
            # Calculate resources for this connected component
            component_resources = self._calculate_component_resources(connected_tiles)
            
            # Add to total resources
            total_resources["gold"] += component_resources["gold"]
            total_resources["food"] += component_resources["food"]
            total_resources["faith"] += component_resources["faith"]
            
        return total_resources
        
    def _find_connected_tiles_of_type(self, start_tile, player_tiles, visited_tiles):
        """Find all tiles of the same type connected to the start tile."""
        from .models.tile import TileType
        
        connected = []
        queue = [start_tile]
        component_visited = set()
        
        while queue:
            current = queue.pop(0)
            
            if current.id in component_visited:
                continue
                
            component_visited.add(current.id)
            visited_tiles.add(current.id)
            connected.append(current)
            
            # Find adjacent tiles of the same type
            for tile in player_tiles:
                if (tile.id not in component_visited and 
                    tile.type == current.type and
                    self._are_tiles_adjacent(current, tile)):
                    queue.append(tile)
                    
        return connected
        
    def _are_tiles_adjacent(self, tile1, tile2):
        """Check if two tiles are adjacent (orthogonally connected)."""
        dx = abs(tile1.x - tile2.x)
        dy = abs(tile1.y - tile2.y)
        return (dx == 1 and dy == 0) or (dx == 0 and dy == 1)
        
    def _calculate_component_resources(self, connected_tiles):
        """Calculate resources for a connected component of tiles."""
        component_resources = {"gold": 0, "food": 0, "faith": 0}
        has_worker = False
        
        # Check if any tile in the component has a worker
        for tile in connected_tiles:
            if tile.worker is not None:
                has_worker = True
                break
                
        # Only generate resources if component has a worker (except for resource tiles)
        if has_worker or self._is_resource_tile(connected_tiles[0]):
            for tile in connected_tiles:
                # Base resource generation from tile
                component_resources["gold"] += tile.resources.gold
                component_resources["food"] += tile.resources.food
                component_resources["faith"] += tile.resources.faith
                
                # Additional bonus from worker if present
                if tile.worker is not None:
                    worker_bonus = self._get_worker_bonus(tile.worker.type)
                    component_resources["gold"] += worker_bonus["gold"]
                    component_resources["food"] += worker_bonus["food"]
                    component_resources["faith"] += worker_bonus["faith"]
                    
        return component_resources
        
    def _is_resource_tile(self, tile):
        """Check if a tile is a resource tile that doesn't need workers."""
        from .models.tile import TileType
        
        resource_tiles = [TileType.MINE, TileType.ORCHARD]
        return tile.type in resource_tiles
        
    def _get_worker_bonus(self, worker_type):
        """Get resource bonus provided by a worker type."""
        from .models.tile import WorkerType
        
        worker_bonuses = {
            WorkerType.MAGISTRATE: {"gold": 2, "food": 0, "faith": 0},
            WorkerType.FARMER: {"gold": 0, "food": 3, "faith": 0},
            WorkerType.MONK: {"gold": 0, "food": 0, "faith": 2},
            WorkerType.SCOUT: {"gold": 1, "food": 1, "faith": 0}
        }
        
        return worker_bonuses.get(worker_type, {"gold": 0, "food": 0, "faith": 0})
    
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
            # Check if connection is still open before sending
            if connection.client_state.name != "CONNECTED":
                print(f"Skipping broadcast to {player_id} - connection closed")
                disconnected.append(player_id)
                continue
                
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