"""
Tech Tree system for managing technology progression in Carcassonne: War of Ages.
"""

from typing import Dict, List, Optional, Tuple
from src.models.tech_tree import TechTree, TechLevel, TechUpgrade
from src.models.game_state import GameState, Player
from src.models.unit import Unit, UnitType
from src.models.tile import Tile, TileType
import time

class TechTreeSystem:
    """System for managing tech tree progression and effects."""
    
    def __init__(self):
        self.special_ability_cooldowns: Dict[int, Dict[str, float]] = {}  # player_id -> ability_id -> last_used
        self.special_ability_active: Dict[int, Dict[str, float]] = {}  # player_id -> ability_id -> end_time
    
    def initialize_player_tech_tree(self, player: Player) -> None:
        """Initialize tech tree for a new player."""
        if not player.tech_tree:
            player.tech_tree = TechTree(current_level=player.tech_level)
    
    def advance_tech_level(self, game_state: GameState, player_id: int, target_level: TechLevel) -> Tuple[bool, str]:
        """Advance a player's tech level."""
        player = next((p for p in game_state.players if p.id == player_id), None)
        if not player:
            return False, "Player not found"
        
        # Initialize tech tree if needed
        if not player.tech_tree:
            self.initialize_player_tech_tree(player)
        
        # Check if can advance
        can_advance, reason = player.tech_tree.can_advance_to_level(target_level, player.resources)
        if not can_advance:
            return False, reason
        
        # Deduct resources
        cost = player.tech_tree.level_costs.get(target_level.value)
        if cost:
            for resource, amount in cost.model_dump().items():
                player.resources[resource] -= amount
        
        # Advance level
        player.tech_tree.advance_to_level(target_level)
        player.tech_level = target_level
        
        return True, f"Advanced to {target_level.value}"
    
    def purchase_upgrade(self, game_state: GameState, player_id: int, upgrade_id: str) -> Tuple[bool, str]:
        """Purchase a tech upgrade."""
        player = next((p for p in game_state.players if p.id == player_id), None)
        if not player:
            return False, "Player not found"
        
        # Initialize tech tree if needed
        if not player.tech_tree:
            self.initialize_player_tech_tree(player)
        
        # Check if can purchase
        can_purchase, reason = player.tech_tree.can_purchase_upgrade(upgrade_id, player.resources)
        if not can_purchase:
            return False, reason
        
        # Get upgrade
        upgrade = next((u for u in player.tech_tree.upgrades if u.id == upgrade_id), None)
        if not upgrade:
            return False, "Upgrade not found"
        
        # Deduct resources
        for resource, amount in upgrade.cost.model_dump().items():
            player.resources[resource] -= amount
        
        # Purchase upgrade
        purchased_upgrade = player.tech_tree.purchase_upgrade(upgrade_id)
        if not purchased_upgrade:
            return False, "Failed to purchase upgrade"
        
        # Apply immediate effects
        self.apply_upgrade_effects(game_state, player_id, purchased_upgrade)
        
        return True, f"Purchased {purchased_upgrade.name}"
    
    def apply_upgrade_effects(self, game_state: GameState, player_id: int, upgrade: TechUpgrade) -> None:
        """Apply immediate effects of an upgrade."""
        # Defensive upgrades - apply to existing buildings
        if "city_hp_bonus" in upgrade.effects:
            hp_bonus = int(upgrade.effects["city_hp_bonus"])
            for tile in game_state.tiles:
                if tile.owner == player_id and tile.type in [TileType.CITY, TileType.CAPITAL_CITY]:
                    tile.max_hp += hp_bonus
                    tile.hp += hp_bonus
        
        if "barracks_hp_bonus" in upgrade.effects:
            hp_bonus = int(upgrade.effects["barracks_hp_bonus"])
            for tile in game_state.tiles:
                if tile.owner == player_id and tile.type == TileType.BARRACKS:
                    tile.max_hp += hp_bonus
                    tile.hp += hp_bonus
    
    def get_unit_stats_with_tech(self, unit: Unit, tech_tree: Optional[TechTree]) -> Dict[str, float]:
        """Get unit stats with tech tree bonuses applied."""
        if not tech_tree:
            return {
                "attack": unit.attack,
                "hp": unit.hp,
                "max_hp": unit.max_hp,
                "speed": unit.speed
            }
        
        effects = tech_tree.get_active_effects()
        
        # Apply unit-specific bonuses
        unit_type_key = f"{unit.type.value}_"
        attack_bonus = effects.get(f"{unit_type_key}attack_bonus", 0)
        hp_bonus = effects.get(f"{unit_type_key}hp_bonus", 0)
        
        return {
            "attack": int(unit.attack * (1 + attack_bonus)),
            "hp": int(unit.hp * (1 + hp_bonus)),
            "max_hp": int(unit.max_hp * (1 + hp_bonus)),
            "speed": unit.speed
        }
    
    def get_training_time_with_tech(self, base_time: float, tech_tree: Optional[TechTree]) -> float:
        """Get training time with tech tree bonuses applied."""
        if not tech_tree:
            return base_time
        
        effects = tech_tree.get_active_effects()
        reduction = effects.get("training_time_reduction", 0)
        
        return base_time * (1 - reduction)
    
    def can_train_unit(self, unit_type: UnitType, tech_tree: Optional[TechTree]) -> bool:
        """Check if a unit type can be trained based on tech level."""
        if not tech_tree:
            # Default Manor level units
            return unit_type in [UnitType.INFANTRY, UnitType.ARCHER]
        
        unlocked_units = tech_tree.get_unlocked_units()
        return unit_type.value in unlocked_units
    
    def can_place_tile(self, tile_type: TileType, tech_tree: Optional[TechTree]) -> bool:
        """Check if a tile type can be placed based on tech level."""
        if not tech_tree:
            # Default Manor level buildings
            return tile_type in [TileType.CITY, TileType.FIELD, TileType.MONASTERY, TileType.CAPITAL_CITY]
        
        # Capital city is always available
        if tile_type == TileType.CAPITAL_CITY:
            return True
        
        unlocked_buildings = tech_tree.get_unlocked_buildings()
        return tile_type.value in unlocked_buildings
    
    def use_special_ability(self, game_state: GameState, player_id: int, ability_id: str) -> Tuple[bool, str]:
        """Use a special ability."""
        player = next((p for p in game_state.players if p.id == player_id), None)
        if not player or not player.tech_tree:
            return False, "Player not found or no tech tree"
        
        # Find the ability
        ability = next((u for u in player.tech_tree.upgrades if u.id == ability_id and u.purchased), None)
        if not ability:
            return False, "Ability not found or not purchased"
        
        # Check cooldown
        current_time = time.time()
        if player_id in self.special_ability_cooldowns:
            last_used = self.special_ability_cooldowns[player_id].get(ability_id, 0)
            cooldown = ability.effects.get("cooldown", 0)
            if current_time - last_used < cooldown:
                remaining = int(cooldown - (current_time - last_used))
                return False, f"Ability on cooldown: {remaining} seconds remaining"
        
        # Check resource cost (for abilities that cost resources per use)
        cost_dict = ability.cost.model_dump()
        for resource, amount in cost_dict.items():
            if player.resources.get(resource, 0) < amount:
                return False, f"Insufficient {resource}"
        
        # Deduct resources
        for resource, amount in cost_dict.items():
            player.resources[resource] -= amount
        
        # Apply ability effect
        if ability_id == "healing_prayer":
            # Heal all player's units
            heal_amount = ability.effects.get("heal_amount", 0.5)
            healed_count = 0
            for unit in game_state.units:
                if unit.owner == player_id and unit.hp < unit.max_hp:
                    heal_hp = int(unit.max_hp * heal_amount)
                    unit.hp = min(unit.max_hp, unit.hp + heal_hp)
                    healed_count += 1
            
            # Record cooldown
            if player_id not in self.special_ability_cooldowns:
                self.special_ability_cooldowns[player_id] = {}
            self.special_ability_cooldowns[player_id][ability_id] = current_time
            
            return True, f"Healed {healed_count} units"
        
        elif ability_id == "divine_inspiration":
            # Apply attack buff (tracked separately, applied in combat)
            duration = ability.effects.get("duration", 15)
            
            if player_id not in self.special_ability_active:
                self.special_ability_active[player_id] = {}
            self.special_ability_active[player_id][ability_id] = current_time + duration
            
            # Record cooldown
            if player_id not in self.special_ability_cooldowns:
                self.special_ability_cooldowns[player_id] = {}
            self.special_ability_cooldowns[player_id][ability_id] = current_time
            
            return True, f"Attack bonus active for {duration} seconds"
        
        return False, "Unknown ability"
    
    def get_active_ability_effects(self, player_id: int) -> Dict[str, float]:
        """Get currently active ability effects for a player."""
        if player_id not in self.special_ability_active:
            return {}
        
        current_time = time.time()
        active_effects = {}
        
        # Check divine inspiration
        if "divine_inspiration" in self.special_ability_active[player_id]:
            end_time = self.special_ability_active[player_id]["divine_inspiration"]
            if current_time < end_time:
                active_effects["attack_multiplier"] = 1.5  # +50% attack
            else:
                # Remove expired effect
                del self.special_ability_active[player_id]["divine_inspiration"]
        
        return active_effects
    
    def get_defense_multiplier_with_tech(self, tile: Tile, tech_tree: Optional[TechTree]) -> float:
        """Get defense multiplier for a tile with tech bonuses."""
        if not tech_tree or tile.type != TileType.WATCHTOWER:
            return 1.0
        
        effects = tech_tree.get_active_effects()
        tower_bonus = effects.get("watchtower_defense_bonus", 0)
        
        # Base watchtower defense + tech bonus
        return 1.25 + tower_bonus  # Base 25% + tech bonus