"""
Unit model for Carcassonne: War of Ages.
"""

from typing import Optional, Dict, List, Set, TYPE_CHECKING
from enum import Enum
from pydantic import BaseModel, Field
import time

if TYPE_CHECKING:
    from src.pathfinding import Pathfinder, MovementSystem

# Module-level unit ID counter
_next_unit_id = 1


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
    """Combat effectiveness against different unit types and buildings."""
    infantry: float = Field(description="Damage multiplier vs infantry")
    archer: float = Field(description="Damage multiplier vs archer")
    knight: float = Field(description="Damage multiplier vs knight")
    siege: float = Field(description="Damage multiplier vs siege")
    building: float = Field(default=1.0, description="Damage multiplier vs buildings/tiles")


class UnitMetadata(BaseModel):
    """Additional unit metadata."""
    training_time: Optional[float] = Field(default=None, description="Time in seconds to train this unit")
    training_started: Optional[float] = Field(default=None, description="Timestamp when training started")
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

    def get_combat_multiplier(self, target_type: str) -> float:
        """Get combat effectiveness multiplier against target type."""
        if not self.metadata or not self.metadata.effectiveness:
            return 1.0
        
        effectiveness = self.metadata.effectiveness.model_dump()
        return effectiveness.get(target_type, 1.0)

    def calculate_damage(self, target: 'Unit') -> int:
        """Calculate damage this unit would deal to a target unit."""
        base_damage = self.attack
        multiplier = self.get_combat_multiplier(target.type)
        return int(base_damage * multiplier)
    
    def calculate_building_damage(self, target_tile_type: str = None) -> int:
        """Calculate damage this unit would deal to a building/tile."""
        base_damage = self.attack
        multiplier = self.get_combat_multiplier("building")
        return int(base_damage * multiplier)

    def is_in_range(self, target_pos: Position) -> bool:
        """Check if target position is within attack range."""
        distance = abs(self.position.x - target_pos.x) + abs(self.position.y - target_pos.y)
        return distance <= self.range

    def take_damage(self, damage: int) -> bool:
        """Apply damage to this unit. Returns True if unit dies."""
        self.hp = max(0, self.hp - damage)
        if self.hp <= 0:
            self.status = UnitStatus.DEAD
            return True
        return False

    @classmethod
    def create_unit(cls, unit_type: UnitType, owner: int, position: Position) -> 'Unit':
        """Create a new unit with default stats based on type."""
        global _next_unit_id
        
        # Default unit stats (matching frontend config)
        unit_stats = {
            UnitType.INFANTRY: {
                "hp": 100, "attack": 20, "defense": 15, "speed": 1.0, "range": 1,
                "cost": UnitCost(gold=50, food=20),
                "training_time": 10.0,
                "effectiveness": CombatEffectiveness(
                    infantry=1.0, archer=1.5, knight=0.5, siege=1.5
                )
            },
            UnitType.ARCHER: {
                "hp": 75, "attack": 25, "defense": 10, "speed": 1.5, "range": 2,
                "cost": UnitCost(gold=60, food=30),
                "training_time": 12.0,
                "effectiveness": CombatEffectiveness(
                    infantry=0.5, archer=1.0, knight=1.5, siege=1.2
                )
            },
            UnitType.KNIGHT: {
                "hp": 150, "attack": 30, "defense": 20, "speed": 0.8, "range": 1,
                "cost": UnitCost(gold=100, food=50),
                "training_time": 15.0,
                "effectiveness": CombatEffectiveness(
                    infantry=1.5, archer=0.5, knight=1.0, siege=1.0
                )
            },
            UnitType.SIEGE: {
                "hp": 120, "attack": 50, "defense": 5, "speed": 0.5, "range": 2,
                "cost": UnitCost(gold=200, food=0),
                "training_time": 20.0,
                "effectiveness": CombatEffectiveness(
                    infantry=0.5, archer=0.8, knight=1.0, siege=1.0, building=2.0
                )
            }
        }
        
        stats = unit_stats[unit_type]
        
        # Generate simple integer ID
        unit_id = str(_next_unit_id)
        _next_unit_id += 1
        
        return cls(
            id=unit_id,
            type=unit_type,
            owner=owner,
            position=position,
            hp=stats["hp"],
            max_hp=stats["hp"],
            attack=stats["attack"],
            defense=stats["defense"],
            speed=stats["speed"],
            range=stats["range"],
            status=UnitStatus.IDLE,
            created_at=time.time(),
            metadata=UnitMetadata(
                training_time=stats["training_time"],
                cost=stats["cost"],
                effectiveness=stats["effectiveness"]
            )
        )

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


class UnitSystem:
    """System for managing units in the game."""
    
    def __init__(self):
        self.units: Dict[str, Unit] = {}
        self.training_queue: Dict[str, Dict] = {}  # unit_id -> training info
        
        # Import here to avoid circular import
        from src.pathfinding import Pathfinder, MovementSystem
        from src.combat_system import CombatSystem
        self.pathfinder = Pathfinder()
        self.movement_system = MovementSystem()
        self.combat_system = CombatSystem()
    
    def add_unit(self, unit: Unit) -> None:
        """Add a unit to the system."""
        self.units[unit.id] = unit
        self.combat_system.add_unit(unit)
    
    def remove_unit(self, unit_id: str) -> Optional[Unit]:
        """Remove a unit from the system."""
        unit = self.units.pop(unit_id, None)
        if unit:
            self.combat_system.remove_unit(unit_id)
        return unit
    
    def get_unit(self, unit_id: str) -> Optional[Unit]:
        """Get a unit by ID."""
        return self.units.get(unit_id)
    
    def get_units_by_owner(self, owner: int) -> List[Unit]:
        """Get all units owned by a player."""
        return [unit for unit in self.units.values() if unit.owner == owner]
    
    def get_units_at_position(self, position: Position) -> List[Unit]:
        """Get all units at a specific position."""
        return [
            unit for unit in self.units.values() 
            if unit.position.x == position.x and unit.position.y == position.y
        ]
    
    def get_enemy_units_in_range(self, attacking_unit: Unit) -> List[Unit]:
        """Get all enemy units within range of an attacking unit."""
        enemies = []
        for unit in self.units.values():
            if (unit.owner != attacking_unit.owner and 
                unit.status != UnitStatus.DEAD and
                attacking_unit.is_in_range(unit.position)):
                enemies.append(unit)
        return enemies
    
    def start_training(self, unit_type: UnitType, owner: int, position: Position) -> str:
        """Start training a unit. Returns training ID."""
        unit = Unit.create_unit(unit_type, owner, position)
        unit.status = UnitStatus.TRAINING
        training_id = unit.id
        
        self.training_queue[training_id] = {
            "unit": unit,
            "started_at": time.time(),
            "duration": unit.metadata.training_time if unit.metadata else 10.0
        }
        
        return training_id
    
    def update_training(self, current_time: float) -> List[Unit]:
        """Update training queue and return completed units."""
        completed_units = []
        completed_training = []
        
        for training_id, training_info in self.training_queue.items():
            if current_time - training_info["started_at"] >= training_info["duration"]:
                unit = training_info["unit"]
                unit.status = UnitStatus.IDLE
                self.add_unit(unit)
                completed_units.append(unit)
                completed_training.append(training_id)
        
        # Remove completed training
        for training_id in completed_training:
            del self.training_queue[training_id]
        
        return completed_units
    
    def process_combat(self, current_time: float, conquest_system=None) -> List[Dict]:
        """Process combat between units using spatial hash. Returns combat events."""
        # Update spatial hash with current positions
        self.combat_system.update_spatial_hash(self.units)
        
        # Process combat tick
        combat_events = self.combat_system.process_combat_tick(self.units, current_time, conquest_system)
        
        # Convert CombatEvent dataclasses to dictionaries for WebSocket serialization
        serialized_events = []
        for event in combat_events:
            serialized_event = {
                "type": event.type,
                "attacker_id": event.attacker_id,
                "target_id": event.target_id,
                "damage": event.damage,
                "timestamp": event.timestamp,
                "position": {"x": event.position.x, "y": event.position.y},
                "target_died": event.target_died
            }
            serialized_events.append(serialized_event)
        
        return serialized_events
    
    def update_terrain_weights(self, tile_data: Dict[str, Dict]) -> None:
        """Update terrain weights based on tile data."""
        for position_key, tile_info in tile_data.items():
            x, y = map(int, position_key.split(','))
            position = Position(x=x, y=y)
            
            # Set terrain weight based on tile type
            if tile_info.get('type') == 'marsh':
                self.pathfinder.set_terrain_weight(position, 2.0)
            else:
                self.pathfinder.set_terrain_weight(position, 1.0)
    
    def move_unit(self, unit_id: str, target_position: Position, valid_tile_positions: Optional[Set[str]] = None) -> bool:
        """Request unit movement to target position."""
        unit = self.get_unit(unit_id)
        if not unit or unit.status == UnitStatus.DEAD:
            return False
        
        # Get blocked positions (other units)
        blocked_positions = set()
        for other_unit in self.units.values():
            if other_unit.id != unit_id and other_unit.status != UnitStatus.DEAD:
                pos_key = f"{other_unit.position.x},{other_unit.position.y}"
                blocked_positions.add(pos_key)
        
        # Find path
        path = self.pathfinder.find_path(unit.position, target_position, blocked_positions, valid_tile_positions)
        
        if path:
            # Set unit path and status
            self.movement_system.set_unit_path(unit_id, path)
            unit.status = UnitStatus.MOVING
            unit.target = Target(type="tile", id="", position=target_position)
            return True
        
        return False
    
    def update_unit_movement(self, delta_time: float) -> List[Dict]:
        """Update all unit movement. Returns movement events."""
        movement_events = []
        
        for unit in self.units.values():
            if unit.status == UnitStatus.MOVING:
                new_position = self.movement_system.update_unit_movement(
                    unit.id, unit.speed, delta_time
                )
                
                if new_position:
                    # Update unit position
                    old_position = unit.position
                    unit.position = new_position
                    
                    # Update combat system spatial hash
                    self.combat_system.update_unit_position(unit.id, new_position)
                    
                    # Create movement event
                    movement_event = {
                        "type": "movement",
                        "unit_id": unit.id,
                        "old_position": {"x": old_position.x, "y": old_position.y},
                        "new_position": {"x": new_position.x, "y": new_position.y},
                        "timestamp": time.time()
                    }
                    movement_events.append(movement_event)
                    
                    # Check if unit reached destination
                    if not self.movement_system.has_path(unit.id):
                        unit.status = UnitStatus.IDLE
                        unit.target = None
                        
                        # Add arrival event
                        arrival_event = {
                            "type": "arrival",
                            "unit_id": unit.id,
                            "position": {"x": new_position.x, "y": new_position.y},
                            "timestamp": time.time()
                        }
                        movement_events.append(arrival_event)
        
        return movement_events
    
    def get_unit_movement_progress(self, unit_id: str) -> float:
        """Get movement progress for a unit (0.0 to 1.0)."""
        return self.movement_system.get_unit_progress(unit_id)
    
    def stop_unit_movement(self, unit_id: str) -> bool:
        """Stop unit movement."""
        unit = self.get_unit(unit_id)
        if not unit:
            return False
        
        self.movement_system.clear_unit_path(unit_id)
        if unit.status == UnitStatus.MOVING:
            unit.status = UnitStatus.IDLE
            unit.target = None
        
        return True
    
    def get_units_in_area(self, center: Position, radius: int) -> List[Unit]:
        """Get all units within a certain radius of a position."""
        # Use combat system's spatial hash for efficiency
        unit_ids = self.combat_system.get_units_in_combat_range(center, radius)
        return [self.units[unit_id] for unit_id in unit_ids if unit_id in self.units]
    
    def get_combat_statistics(self) -> Dict[str, int]:
        """Get combat system statistics."""
        return self.combat_system.get_combat_stats()
    
    def can_unit_attack(self, unit_id: str, current_time: float) -> bool:
        """Check if a unit can attack (not on cooldown)."""
        return self.combat_system.can_attack(unit_id, current_time)
    
    def get_units_in_combat_range(self, position: Position, radius: int) -> List[Unit]:
        """Get all units within combat range of a position."""
        unit_ids = self.combat_system.get_units_in_combat_range(position, radius)
        return [self.units[unit_id] for unit_id in unit_ids if unit_id in self.units]
    
    def calculate_combat_outcome(self, unit1_id: str, unit2_id: str) -> Optional[Dict]:
        """Calculate predicted combat outcome between two units."""
        from src.combat_system import DamageCalculator
        
        unit1 = self.get_unit(unit1_id)
        unit2 = self.get_unit(unit2_id)
        
        if not unit1 or not unit2:
            return None
        
        return DamageCalculator.calculate_combat_outcome(unit1, unit2)
    
    def update_units(self, delta_time: float, conquest_system=None) -> Dict[str, List]:
        """Update all unit systems. Returns events for each update type."""
        events = {
            "training_completed": [],
            "movement_events": [],
            "combat_events": []
        }
        
        # Update training
        current_time = time.time()
        completed_units = self.update_training(current_time)
        events["training_completed"] = completed_units
        
        # Update movement
        movement_events = self.update_unit_movement(delta_time)
        events["movement_events"] = movement_events
        
        # Update combat
        combat_events = self.process_combat(current_time, conquest_system)
        events["combat_events"] = combat_events
        
        return events 