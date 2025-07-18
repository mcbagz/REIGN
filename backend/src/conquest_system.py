"""
Conquest system for Carcassonne: War of Ages.
Handles raiding, watchtower aura effects, and elimination mechanics.
"""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from src.models.unit import Unit, Position
from src.models.tile import Tile, TileType
from src.models.game_state import Player
import math


@dataclass
class RaidResult:
    """Result of a raid operation."""
    success: bool
    resources_stolen: Dict[str, int]
    attacker_position: Position
    target_position: Position
    attacker_id: str
    target_tile_id: str
    timestamp: float


@dataclass
class AuraEffect:
    """Represents an aura effect from a watchtower."""
    source_position: Position
    radius: int
    defense_multiplier: float
    owner_id: int


class ConquestSystem:
    """System for managing conquest mechanics like raiding and aura effects."""
    
    def __init__(self):
        self.active_auras: List[AuraEffect] = []
        self.raid_history: List[RaidResult] = []
    
    def update_auras(self, tiles: List[Tile], units: Dict[str, Unit]) -> None:
        """Update aura effects from watchtowers."""
        self.active_auras.clear()
        
        # Find all watchtower tiles
        for tile in tiles:
            if tile.type == TileType.WATCHTOWER and tile.owner is not None:
                # Get aura radius from tile metadata
                aura_radius = 2  # Default
                if tile.metadata and hasattr(tile.metadata, 'aura_radius'):
                    aura_radius = tile.metadata.aura_radius
                
                aura = AuraEffect(
                    source_position=Position(x=tile.x, y=tile.y),
                    radius=aura_radius,
                    defense_multiplier=1.25,  # 25% defense bonus
                    owner_id=tile.owner
                )
                self.active_auras.append(aura)
    
    def get_defense_multiplier(self, unit: Unit) -> float:
        """Get defense multiplier for a unit based on nearby friendly watchtowers."""
        if not self.active_auras:
            return 1.0
        
        best_multiplier = 1.0
        
        for aura in self.active_auras:
            # Only apply aura to friendly units
            if aura.owner_id != unit.owner:
                continue
            
            # Check if unit is within aura radius
            distance = abs(unit.position.x - aura.source_position.x) + abs(unit.position.y - aura.source_position.y)
            if distance <= aura.radius:
                # Apply the best (highest) multiplier
                best_multiplier = max(best_multiplier, aura.defense_multiplier)
        
        return best_multiplier
    
    def execute_raid(self, attacker_unit: Unit, target_tile: Tile, current_time: float) -> RaidResult:
        """Execute a raid operation, stealing 10% of target tile's resources."""
        resources_stolen = {}
        
        # Calculate 10% of target tile's resources
        if target_tile.resources:
            for resource_type, amount in target_tile.resources.model_dump().items():
                stolen_amount = int(amount * 0.1)  # 10% of resources
                if stolen_amount > 0:
                    resources_stolen[resource_type] = stolen_amount
        
        raid_result = RaidResult(
            success=bool(resources_stolen),
            resources_stolen=resources_stolen,
            attacker_position=attacker_unit.position,
            target_position=Position(x=target_tile.x, y=target_tile.y),
            attacker_id=attacker_unit.id,
            target_tile_id=target_tile.id,
            timestamp=current_time
        )
        
        self.raid_history.append(raid_result)
        return raid_result
    
    def apply_raid_resources(self, raid_result: RaidResult, attacker_player: Player, target_player: Player) -> None:
        """Apply resource changes from a raid to both players."""
        if not raid_result.success:
            return
        
        # Add resources to attacker
        for resource_type, amount in raid_result.resources_stolen.items():
            if resource_type in attacker_player.resources:
                attacker_player.resources[resource_type] += amount
        
        # Remove resources from target (if target_player exists)
        if target_player:
            for resource_type, amount in raid_result.resources_stolen.items():
                if resource_type in target_player.resources:
                    target_player.resources[resource_type] = max(0, target_player.resources[resource_type] - amount)
    
    def can_raid_tile(self, attacker_unit: Unit, target_tile: Tile) -> bool:
        """Check if a unit can raid a specific tile."""
        # Unit must be in range
        if not attacker_unit.is_in_range(Position(x=target_tile.x, y=target_tile.y)):
            return False
        
        # Cannot raid own tiles
        if target_tile.owner == attacker_unit.owner:
            return False
        
        # Target tile must have resources to steal
        if not target_tile.resources:
            return False
        
        # Check if tile has any resources > 0
        resources_dict = target_tile.resources.model_dump()
        has_resources = any(amount > 0 for amount in resources_dict.values())
        
        return has_resources
    
    def check_elimination(self, players: List[Player]) -> Tuple[List[int], Optional[int]]:
        """Check for eliminated players and determine winner."""
        eliminated_players = []
        active_players = []
        
        for player in players:
            if player.capital_hp <= 0:
                if not player.is_eliminated:
                    eliminated_players.append(player.id)
                    player.is_eliminated = True
            else:
                active_players.append(player.id)
        
        # Determine winner if only one player remains
        winner = None
        if len(active_players) == 1:
            winner = active_players[0]
        elif len(active_players) == 0:
            # Draw - no winner
            pass
        
        return eliminated_players, winner
    
    def get_aura_positions(self) -> List[Dict]:
        """Get all aura positions for client rendering."""
        aura_positions = []
        for aura in self.active_auras:
            aura_positions.append({
                "x": aura.source_position.x,
                "y": aura.source_position.y,
                "radius": aura.radius,
                "owner_id": aura.owner_id,
                "defense_multiplier": aura.defense_multiplier
            })
        return aura_positions
    
    def get_raid_stats(self) -> Dict:
        """Get raid statistics."""
        return {
            "total_raids": len(self.raid_history),
            "successful_raids": len([r for r in self.raid_history if r.success]),
            "recent_raids": len([r for r in self.raid_history[-10:]])  # Last 10 raids
        }
    
    def clear_history(self) -> None:
        """Clear raid history (call periodically to prevent memory buildup)."""
        # Keep only last 100 raids
        if len(self.raid_history) > 100:
            self.raid_history = self.raid_history[-100:] 