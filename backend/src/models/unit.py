"""
Unit model for Carcassonne: War of Ages.
"""

from typing import Optional, Dict
from enum import Enum
from pydantic import BaseModel, Field


class UnitType(str, Enum):
    """Available unit types in the game."""
    INFANTRY = "infantry"
    ARCHER = "archer"
    KNIGHT = "knight"
    SIEGE = "siege"


class UnitStatus(str, Enum):
    """Available unit statuses."""
    IDLE = "idle"
    MOVING = "moving"
    ATTACKING = "attacking"
    DEAD = "dead"
    TRAINING = "training"


class Position(BaseModel):
    """Position on the game board."""
    x: int = Field(ge=0, le=39, description="X coordinate on the 40x40 grid")
    y: int = Field(ge=0, le=39, description="Y coordinate on the 40x40 grid")


class Target(BaseModel):
    """Target for unit action."""
    type: str = Field(description="Type of target (tile or unit)")
    id: str = Field(description="ID of the target")
    position: Position = Field(description="Position of the target")


class UnitCost(BaseModel):
    """Resource cost to train a unit."""
    gold: int = Field(ge=0, default=0)
    food: int = Field(ge=0, default=0)
    faith: int = Field(ge=0, default=0)


class CombatEffectiveness(BaseModel):
    """Combat effectiveness against different unit types."""
    infantry: float = Field(description="Damage multiplier vs infantry")
    archer: float = Field(description="Damage multiplier vs archer")
    knight: float = Field(description="Damage multiplier vs knight")
    siege: float = Field(description="Damage multiplier vs siege")


class UnitMetadata(BaseModel):
    """Additional unit metadata."""
    training_time: Optional[float] = Field(default=None, description="Time in seconds to train this unit")
    cost: Optional[UnitCost] = Field(default=None, description="Resource cost to train this unit")
    effectiveness: Optional[CombatEffectiveness] = Field(default=None, description="Combat effectiveness against different unit types")


class Unit(BaseModel):
    """A unit in the Carcassonne: War of Ages game."""
    id: str = Field(description="Unique identifier for the unit")
    type: UnitType = Field(description="Type of unit")
    owner: int = Field(ge=0, description="Player ID who owns this unit")
    position: Position = Field(description="Current position of the unit")
    hp: int = Field(ge=0, description="Current hit points")
    max_hp: int = Field(ge=1, description="Maximum hit points")
    attack: int = Field(ge=0, description="Attack damage")
    defense: int = Field(ge=0, description="Defense rating")
    speed: float = Field(ge=0, description="Movement speed in tiles per second")
    range: int = Field(ge=1, description="Attack range in tiles")
    status: UnitStatus = Field(description="Current status of the unit")
    target: Optional[Target] = Field(default=None, description="Current target for movement or attack, null if none")
    created_at: float = Field(description="Timestamp when unit was created")
    last_action: Optional[float] = Field(default=None, description="Timestamp of last action, null if no action taken")
    metadata: Optional[UnitMetadata] = Field(default=None, description="Additional unit metadata")

    class Config:
        """Pydantic configuration."""
        use_enum_values = True
        validate_assignment = True
        schema_extra = {
            "example": {
                "id": "unit_1",
                "type": "infantry",
                "owner": 1,
                "position": {
                    "x": 10,
                    "y": 15
                },
                "hp": 100,
                "max_hp": 100,
                "attack": 20,
                "defense": 15,
                "speed": 1.0,
                "range": 1,
                "status": "idle",
                "target": None,
                "created_at": 1640995200.0,
                "last_action": None,
                "metadata": {
                    "training_time": 5.0,
                    "cost": {
                        "gold": 50,
                        "food": 20,
                        "faith": 0
                    },
                    "effectiveness": {
                        "infantry": 1.0,
                        "archer": 1.2,
                        "knight": 0.8,
                        "siege": 1.5
                    }
                }
            }
        } 