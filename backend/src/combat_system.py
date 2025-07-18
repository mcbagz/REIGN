"""
Combat system with spatial hashing for Carcassonne: War of Ages.
"""

from typing import Dict, List, Set, Tuple, Optional
from dataclasses import dataclass
from src.models.unit import Unit, UnitStatus, Position
import time
import math


@dataclass
class CombatEvent:
    """Event representing a combat action."""
    type: str  # "attack", "death", "damage"
    attacker_id: str
    target_id: str
    damage: int
    timestamp: float
    position: Position
    target_died: bool = False


class SpatialHash:
    """Spatial hash for efficient unit lookups by position."""
    
    def __init__(self, cell_size: int = 4):
        self.cell_size = cell_size
        self.grid: Dict[Tuple[int, int], Set[str]] = {}
        self.unit_positions: Dict[str, Position] = {}
    
    def _get_cell_key(self, position: Position) -> Tuple[int, int]:
        """Get cell key for a position."""
        return (position.x // self.cell_size, position.y // self.cell_size)
    
    def add_unit(self, unit_id: str, position: Position) -> None:
        """Add unit to spatial hash."""
        cell_key = self._get_cell_key(position)
        
        if cell_key not in self.grid:
            self.grid[cell_key] = set()
        
        self.grid[cell_key].add(unit_id)
        self.unit_positions[unit_id] = position
    
    def remove_unit(self, unit_id: str) -> None:
        """Remove unit from spatial hash."""
        if unit_id not in self.unit_positions:
            return
        
        position = self.unit_positions[unit_id]
        cell_key = self._get_cell_key(position)
        
        if cell_key in self.grid:
            self.grid[cell_key].discard(unit_id)
            if not self.grid[cell_key]:
                del self.grid[cell_key]
        
        del self.unit_positions[unit_id]
    
    def update_unit_position(self, unit_id: str, new_position: Position) -> None:
        """Update unit position in spatial hash."""
        if unit_id in self.unit_positions:
            self.remove_unit(unit_id)
        self.add_unit(unit_id, new_position)
    
    def get_units_in_radius(self, center: Position, radius: int) -> Set[str]:
        """Get all unit IDs within radius of center position."""
        units_in_range = set()
        
        # Calculate cell range to check
        cell_radius = math.ceil(radius / self.cell_size)
        center_cell = self._get_cell_key(center)
        
        for dx in range(-cell_radius, cell_radius + 1):
            for dy in range(-cell_radius, cell_radius + 1):
                cell_key = (center_cell[0] + dx, center_cell[1] + dy)
                
                if cell_key in self.grid:
                    for unit_id in self.grid[cell_key]:
                        if unit_id in self.unit_positions:
                            unit_pos = self.unit_positions[unit_id]
                            distance = abs(unit_pos.x - center.x) + abs(unit_pos.y - center.y)
                            if distance <= radius:
                                units_in_range.add(unit_id)
        
        return units_in_range
    
    def clear(self) -> None:
        """Clear all units from spatial hash."""
        self.grid.clear()
        self.unit_positions.clear()


class CombatSystem:
    """System for managing combat between units."""
    
    def __init__(self):
        self.spatial_hash = SpatialHash()
        self.unit_last_attack: Dict[str, float] = {}  # unit_id -> last attack timestamp
        self.attack_cooldown = 1.0  # 1 second between attacks
        self.combat_events: List[CombatEvent] = []
    
    def update_unit_position(self, unit_id: str, position: Position) -> None:
        """Update unit position in combat system."""
        self.spatial_hash.update_unit_position(unit_id, position)
    
    def add_unit(self, unit: Unit) -> None:
        """Add unit to combat system."""
        self.spatial_hash.add_unit(unit.id, unit.position)
    
    def remove_unit(self, unit_id: str) -> None:
        """Remove unit from combat system."""
        self.spatial_hash.remove_unit(unit_id)
        self.unit_last_attack.pop(unit_id, None)
    
    def can_attack(self, unit_id: str, current_time: float) -> bool:
        """Check if unit can attack (not on cooldown)."""
        last_attack = self.unit_last_attack.get(unit_id, 0)
        return current_time - last_attack >= self.attack_cooldown
    
    def find_targets_in_range(self, attacker: Unit, all_units: Dict[str, Unit]) -> List[Unit]:
        """Find enemy units within attack range."""
        targets = []
        
        # Get units in range using spatial hash
        units_in_range = self.spatial_hash.get_units_in_radius(attacker.position, attacker.range)
        
        for unit_id in units_in_range:
            if unit_id in all_units:
                target = all_units[unit_id]
                
                # Check if it's an enemy unit
                if (target.owner != attacker.owner and 
                    target.status not in [UnitStatus.DEAD, UnitStatus.TRAINING]):
                    targets.append(target)
        
        return targets
    
    def process_combat_tick(self, all_units: Dict[str, Unit], current_time: float, conquest_system=None) -> List[CombatEvent]:
        """Process one combat tick for all units."""
        events = []
        
        for unit in all_units.values():
            if unit.status == UnitStatus.DEAD:
                continue
            
            # Only units that are idle or attacking can engage in combat
            if unit.status not in [UnitStatus.IDLE, UnitStatus.ATTACKING]:
                continue
            
            # Check if unit can attack
            if not self.can_attack(unit.id, current_time):
                continue
            
            # Find targets in range
            targets = self.find_targets_in_range(unit, all_units)
            
            if targets:
                # Attack the first target (closest or first found)
                target = targets[0]
                damage = unit.calculate_damage(target)
                
                # Apply aura defense multiplier if conquest system is available
                if conquest_system:
                    defense_multiplier = conquest_system.get_defense_multiplier(target)
                    damage = int(damage / defense_multiplier)  # Reduce damage by defense multiplier
                
                # Apply damage
                target_died = target.take_damage(damage)
                
                # Update unit status
                unit.status = UnitStatus.ATTACKING
                unit.last_action = current_time
                
                # Record attack time
                self.unit_last_attack[unit.id] = current_time
                
                # Create combat event
                event = CombatEvent(
                    type="attack",
                    attacker_id=unit.id,
                    target_id=target.id,
                    damage=damage,
                    timestamp=current_time,
                    position=unit.position,
                    target_died=target_died
                )
                events.append(event)
                
                # If target died, create death event
                if target_died:
                    death_event = CombatEvent(
                        type="death",
                        attacker_id=unit.id,
                        target_id=target.id,
                        damage=damage,
                        timestamp=current_time,
                        position=target.position,
                        target_died=True
                    )
                    events.append(death_event)
                    
                    # Remove dead unit from spatial hash
                    self.remove_unit(target.id)
            else:
                # No targets in range, go idle
                if unit.status == UnitStatus.ATTACKING:
                    unit.status = UnitStatus.IDLE
        
        return events
    
    def get_combat_stats(self) -> Dict[str, int]:
        """Get combat statistics."""
        return {
            "total_units": len(self.spatial_hash.unit_positions),
            "spatial_cells": len(self.spatial_hash.grid),
            "recent_events": len(self.combat_events[-10:])  # Last 10 events
        }
    
    def update_spatial_hash(self, all_units: Dict[str, Unit]) -> None:
        """Update spatial hash with current unit positions."""
        # Clear and rebuild spatial hash
        self.spatial_hash.clear()
        
        for unit in all_units.values():
            if unit.status != UnitStatus.DEAD:
                self.spatial_hash.add_unit(unit.id, unit.position)
    
    def get_units_in_combat_range(self, position: Position, radius: int) -> Set[str]:
        """Get units within combat range of a position."""
        return self.spatial_hash.get_units_in_radius(position, radius)
    
    def clear_events(self) -> None:
        """Clear combat events (call after processing)."""
        self.combat_events.clear()


class DamageCalculator:
    """Helper class for damage calculations."""
    
    @staticmethod
    def calculate_dps(attacker: Unit, target: Unit) -> float:
        """Calculate damage per second based on attack speed."""
        base_damage = attacker.calculate_damage(target)
        # Assume 1 attack per second for now (can be made configurable)
        return float(base_damage)
    
    @staticmethod
    def calculate_time_to_kill(attacker: Unit, target: Unit) -> float:
        """Calculate time to kill target in seconds."""
        dps = DamageCalculator.calculate_dps(attacker, target)
        if dps <= 0:
            return float('inf')
        return target.hp / dps
    
    @staticmethod
    def calculate_combat_outcome(unit1: Unit, unit2: Unit) -> Dict[str, float]:
        """Calculate combat outcome between two units."""
        ttk1 = DamageCalculator.calculate_time_to_kill(unit1, unit2)
        ttk2 = DamageCalculator.calculate_time_to_kill(unit2, unit1)
        
        return {
            "unit1_ttk": ttk1,
            "unit2_ttk": ttk2,
            "unit1_wins": ttk1 < ttk2,
            "unit2_wins": ttk2 < ttk1,
            "winner": unit1.id if ttk1 < ttk2 else unit2.id if ttk2 < ttk1 else None
        } 