"""
Tile model for Carcassonne: War of Ages.
"""

from typing import Optional, List
from enum import Enum
from pydantic import BaseModel, Field
from datetime import datetime


class TileType(str, Enum):
    """Available tile types in the game."""
    CAPITAL_CITY = "capital_city"
    CITY = "city"
    FIELD = "field"
    MONASTERY = "monastery"
    MARSH = "marsh"
    MINE = "mine"
    ORCHARD = "orchard"
    BARRACKS = "barracks"
    WATCHTOWER = "watchtower"


class WorkerType(str, Enum):
    """Available worker types in the game."""
    MAGISTRATE = "magistrate"
    FARMER = "farmer"
    MONK = "monk"
    SCOUT = "scout"


class Resources(BaseModel):
    """Resource generation of a tile."""
    gold: int = Field(ge=0, description="Gold generation per second")
    food: int = Field(ge=0, description="Food generation per second")
    faith: int = Field(ge=0, description="Faith generation per second")


class Worker(BaseModel):
    """Worker placed on a tile."""
    id: int = Field(description="Worker ID")
    type: WorkerType = Field(description="Worker type")
    owner: int = Field(ge=0, description="Player ID who owns this worker")


class TileMetadata(BaseModel):
    """Additional tile metadata."""
    can_train: bool = Field(default=False, description="Whether units can be trained at this tile")
    worker_capacity: int = Field(ge=0, default=1, description="Maximum number of workers this tile can hold")
    defense_bonus: float = Field(ge=0, default=0, description="Defense bonus provided by this tile")
    speed_multiplier: float = Field(ge=0, default=1.0, description="Speed multiplier for units passing through")
    aura_radius: int = Field(ge=0, default=2, description="Aura radius for watchtower tiles (defense buff range)")


class Tile(BaseModel):
    """A tile in the Carcassonne: War of Ages game."""
    id: str = Field(description="Unique identifier for the tile (e.g., '10,15')")
    type: TileType = Field(description="Type of tile")
    x: int = Field(ge=0, le=39, description="X coordinate on the 40x40 grid")
    y: int = Field(ge=0, le=39, description="Y coordinate on the 40x40 grid")
    edges: List[str] = Field(min_length=4, max_length=4, description="Edges of the tile [North, East, South, West]")
    hp: int = Field(ge=0, description="Current hit points")
    max_hp: int = Field(ge=1, description="Maximum hit points")
    owner: Optional[int] = Field(ge=0, default=None, description="Player ID who owns this tile, null if unowned")
    worker: Optional[Worker] = Field(default=None, description="Worker placed on this tile, null if no worker")
    resources: Resources = Field(description="Resource generation of this tile")
    placed_at: float = Field(description="Timestamp when tile was placed")
    metadata: Optional[TileMetadata] = Field(default=None, description="Additional tile metadata")
    capturable: bool = Field(default=False, description="Whether this tile can be captured by other players")

    class Config:
        """Pydantic configuration."""
        use_enum_values = True
        validate_assignment = True
        schema_extra = {
            "example": {
                "id": "10,15",
                "type": "city",
                "x": 10,
                "y": 15,
                "edges": ["city", "field", "city", "field"],
                "hp": 100,
                "max_hp": 100,
                "owner": 1,
                "worker": {
                    "id": 1,
                    "type": "magistrate",
                    "owner": 1
                },
                "resources": {
                    "gold": 2,
                    "food": 0,
                    "faith": 0
                },
                "placed_at": 1640995200.0,
                "metadata": {
                    "can_train": True,
                    "worker_capacity": 1,
                    "defense_bonus": 0.2,
                    "speed_multiplier": 1.0
                }
            }
        } 