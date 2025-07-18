"""
Game state model for Carcassonne: War of Ages.
"""

from typing import Optional, List, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field
from .tile import Tile, TileType
from .unit import Unit, Position
from .follower import Follower
from .tech_tree import TechTree, TechLevel


class GameStatus(str, Enum):
    """Available game statuses."""
    WAITING = "waiting"
    STARTING = "starting"
    PLAYING = "playing"
    PAUSED = "paused"
    FINISHED = "finished"




class PlayerStats(BaseModel):
    """Player statistics."""
    tiles_placed: int = Field(ge=0, default=0)
    units_created: int = Field(ge=0, default=0)
    units_killed: int = Field(ge=0, default=0)
    tiles_destroyed: int = Field(ge=0, default=0)


class Player(BaseModel):
    """A player in the game."""
    id: int = Field(ge=0, description="Player ID")
    name: str = Field(description="Player name")
    color: str = Field(description="Player color (hex code)")
    is_connected: bool = Field(description="Whether player is currently connected")
    is_eliminated: bool = Field(description="Whether player has been eliminated")
    resources: Dict[str, int] = Field(description="Current resources")
    tech_level: TechLevel = Field(default=TechLevel.MANOR, description="Current technology level")
    tech_tree: Optional[TechTree] = Field(default=None, description="Player's tech tree")
    capital_city: Optional[Position] = Field(default=None, description="Position of capital city, null if eliminated")
    stats: Optional[PlayerStats] = Field(default=None, description="Player statistics")
    capital_hp: int = Field(ge=0, default=100, description="Current hit points of player's capital city")
    stored_placements: int = Field(ge=0, le=3, default=0, description="Number of stored tile placements (max 3)")
    followers_available: int = Field(ge=0, le=8, default=8, description="Number of followers in player's pool")

    class Config:
        """Pydantic configuration."""
        use_enum_values = True


class AvailableTile(BaseModel):
    """Available tile type and count."""
    type: TileType = Field(description="Type of tile")
    count: int = Field(ge=0, description="Number of tiles remaining")


class GameEvent(BaseModel):
    """A game event for logging/replay."""
    id: str = Field(description="Unique event identifier")
    type: str = Field(description="Type of event")
    player_id: Optional[int] = Field(ge=0, default=None, description="ID of player who triggered the event")
    timestamp: float = Field(description="When the event occurred")
    data: Dict[str, Any] = Field(description="Event-specific data")


class GameSettings(BaseModel):
    """Game configuration settings."""
    max_players: int = Field(ge=2, le=4, default=4, description="Maximum number of players in the game")
    turn_duration: float = Field(ge=1, default=15.0, description="Turn duration in seconds")
    max_game_duration: float = Field(ge=1, default=1800.0, description="Maximum game duration in seconds")
    map_size: int = Field(ge=10, le=100, default=20, description="Size of the square map")
    resource_update_interval: float = Field(ge=0.1, default=1.0, description="How often resources are updated in seconds")


class GameState(BaseModel):
    """Complete game state for Carcassonne: War of Ages."""
    game_id: str = Field(description="Unique identifier for the game session")
    status: GameStatus = Field(description="Current game status")
    current_player: int = Field(ge=0, description="ID of the player whose turn it is")
    turn_number: int = Field(ge=0, description="Current turn number")
    turn_time_remaining: float = Field(ge=0, description="Time remaining for current turn in seconds")
    game_start_time: float = Field(description="Timestamp when game started")
    last_update: float = Field(description="Timestamp of last state update")
    players: List[Player] = Field(min_length=2, max_length=4, description="Array of players in the game")
    tiles: List[Tile] = Field(description="Array of all tiles placed on the board")
    units: List[Unit] = Field(description="Array of all units on the board")
    followers: List[Follower] = Field(default_factory=list, description="Array of all followers in the game")
    available_tiles: List[AvailableTile] = Field(description="Remaining tiles in the deck")
    current_tile_options: Optional[List[TileType]] = Field(default=None, min_length=3, max_length=3, description="Three tile options for current player")
    winner: Optional[int] = Field(ge=0, default=None, description="ID of winning player, null if game not finished")
    game_settings: Optional[GameSettings] = Field(default=None, description="Game configuration settings")
    events: Optional[List[GameEvent]] = Field(default=None, description="Recent game events for replay/logging")

    class Config:
        """Pydantic configuration."""
        use_enum_values = True
        validate_assignment = True
        schema_extra = {
            "example": {
                "game_id": "game_12345",
                "status": "playing",
                "current_player": 1,
                "turn_number": 10,
                "turn_time_remaining": 12.5,
                "game_start_time": 1640995200.0,
                "last_update": 1640995800.0,
                "players": [
                    {
                        "id": 1,
                        "name": "Alice",
                        "color": "#FF0000",
                        "is_connected": True,
                        "is_eliminated": False,
                        "resources": {
                            "gold": 100,
                            "food": 50,
                            "faith": 25
                        },
                        "tech_level": "manor",
                        "capital_city": {
                            "x": 20,
                            "y": 20
                        },
                        "stats": {
                            "tiles_placed": 5,
                            "units_created": 3,
                            "units_killed": 1,
                            "tiles_destroyed": 0
                        }
                    }
                ],
                "tiles": [],
                "units": [],
                "available_tiles": [
                    {
                        "type": "city",
                        "count": 15
                    }
                ],
                "current_tile_options": ["city", "field", "monastery"],
                "winner": None,
                "game_settings": {
                    "turn_duration": 15.0,
                    "max_game_duration": 1800.0,
                    "map_size": 20,
                    "resource_update_interval": 1.0
                },
                "events": []
            }
        } 