"""
Tech Tree model for Carcassonne: War of Ages.
"""

from typing import Dict, List, Optional, Set
from enum import Enum
from pydantic import BaseModel, Field

class TechLevel(str, Enum):
    """Available technology levels."""
    MANOR = "manor"
    DUCHY = "duchy"
    KINGDOM = "kingdom"

class TechType(str, Enum):
    """Types of tech upgrades."""
    MILITARY = "military"
    DEFENSIVE = "defensive"
    SPECIAL_ABILITY = "special_ability"

class TechCost(BaseModel):
    """Resource cost for tech advancement."""
    gold: int = Field(ge=0, default=0)
    food: int = Field(ge=0, default=0)
    faith: int = Field(ge=0, default=0)

class TechUpgrade(BaseModel):
    """Individual tech upgrade."""
    id: str = Field(description="Unique identifier for the upgrade")
    name: str = Field(description="Display name of the upgrade")
    description: str = Field(description="Description of the upgrade effect")
    type: TechType = Field(description="Type of upgrade")
    level_required: TechLevel = Field(description="Tech level required to unlock")
    cost: TechCost = Field(description="Resource cost to purchase")
    effects: Dict[str, float] = Field(description="Effects of the upgrade")
    unlocked: bool = Field(default=False, description="Whether this upgrade has been unlocked")
    purchased: bool = Field(default=False, description="Whether this upgrade has been purchased")

class TechTree(BaseModel):
    """Complete tech tree for a player."""
    current_level: TechLevel = Field(default=TechLevel.MANOR, description="Current tech level")
    
    # Level advancement costs
    level_costs: Dict[str, TechCost] = Field(
        default={
            "duchy": TechCost(gold=200, food=100, faith=100),
            "kingdom": TechCost(gold=400, food=200, faith=200)
        },
        description="Costs to advance to each tech level"
    )
    
    # Available upgrades
    upgrades: List[TechUpgrade] = Field(
        default_factory=lambda: [
            # Military upgrades
            TechUpgrade(
                id="fast_training",
                name="Fast Training",
                description="Reduce unit training time by 20%",
                type=TechType.MILITARY,
                level_required=TechLevel.DUCHY,
                cost=TechCost(gold=100, faith=50),
                effects={"training_time_reduction": 0.2}
            ),
            TechUpgrade(
                id="elite_infantry",
                name="Elite Infantry",
                description="+20% attack/HP for Infantry units",
                type=TechType.MILITARY,
                level_required=TechLevel.KINGDOM,
                cost=TechCost(gold=150, food=100),
                effects={"infantry_attack_bonus": 0.2, "infantry_hp_bonus": 0.2}
            ),
            TechUpgrade(
                id="elite_archers",
                name="Elite Archers",
                description="+20% attack/HP for Archer units",
                type=TechType.MILITARY,
                level_required=TechLevel.KINGDOM,
                cost=TechCost(gold=150, food=100),
                effects={"archer_attack_bonus": 0.2, "archer_hp_bonus": 0.2}
            ),
            TechUpgrade(
                id="elite_knights",
                name="Elite Knights",
                description="+20% attack/HP for Knight units",
                type=TechType.MILITARY,
                level_required=TechLevel.KINGDOM,
                cost=TechCost(gold=150, food=100),
                effects={"knight_attack_bonus": 0.2, "knight_hp_bonus": 0.2}
            ),
            
            # Defensive upgrades
            TechUpgrade(
                id="fortified_walls",
                name="Fortified Walls",
                description="+200 HP to cities and barracks",
                type=TechType.DEFENSIVE,
                level_required=TechLevel.DUCHY,
                cost=TechCost(gold=75, food=75),
                effects={"city_hp_bonus": 200, "barracks_hp_bonus": 200}
            ),
            TechUpgrade(
                id="tower_network",
                name="Tower Network",
                description="Watchtowers boost defense by +30%",
                type=TechType.DEFENSIVE,
                level_required=TechLevel.KINGDOM,
                cost=TechCost(gold=150, faith=50),
                effects={"watchtower_defense_bonus": 0.3}
            ),
            
            # Special abilities
            TechUpgrade(
                id="healing_prayer",
                name="Healing Prayer",
                description="Restores 50% HP to all units (1-minute cooldown)",
                type=TechType.SPECIAL_ABILITY,
                level_required=TechLevel.KINGDOM,
                cost=TechCost(faith=50),
                effects={"heal_amount": 0.5, "cooldown": 60}
            ),
            TechUpgrade(
                id="divine_inspiration",
                name="Divine Inspiration",
                description="+50% attack for 15 seconds (2-minute cooldown)",
                type=TechType.SPECIAL_ABILITY,
                level_required=TechLevel.KINGDOM,
                cost=TechCost(faith=75),
                effects={"attack_bonus": 0.5, "duration": 15, "cooldown": 120}
            )
        ]
    )
    
    # Unlocked units and buildings per level
    unlocked_units: Dict[str, List[str]] = Field(
        default={
            "manor": ["infantry", "archer"],
            "duchy": ["knight"],
            "kingdom": ["siege"]
        },
        description="Units unlocked at each tech level"
    )
    
    unlocked_buildings: Dict[str, List[str]] = Field(
        default={
            "manor": ["city", "field", "monastery"],
            "duchy": ["barracks", "watchtower"],
            "kingdom": ["mine", "orchard"]
        },
        description="Buildings unlocked at each tech level"
    )
    
    def can_advance_to_level(self, level: TechLevel, player_resources: Dict[str, int]) -> tuple[bool, str]:
        """Check if player can advance to a tech level."""
        if level == TechLevel.MANOR:
            return False, "Already at starting level"
            
        # Check current level
        level_order = [TechLevel.MANOR, TechLevel.DUCHY, TechLevel.KINGDOM]
        current_index = level_order.index(self.current_level)
        target_index = level_order.index(level)
        
        if target_index <= current_index:
            return False, f"Already at or above {level.value} level"
            
        if target_index > current_index + 1:
            return False, f"Must advance through levels in order"
            
        # Check resource cost
        cost = self.level_costs.get(level.value)
        if not cost:
            return False, f"No cost defined for {level.value}"
            
        for resource, amount in cost.model_dump().items():
            if player_resources.get(resource, 0) < amount:
                return False, f"Insufficient {resource}: need {amount}, have {player_resources.get(resource, 0)}"
                
        return True, "Can advance"
    
    def advance_to_level(self, level: TechLevel) -> bool:
        """Advance to a new tech level."""
        self.current_level = level
        
        # Unlock upgrades for this level
        for upgrade in self.upgrades:
            if upgrade.level_required == level:
                upgrade.unlocked = True
                
        return True
    
    def can_purchase_upgrade(self, upgrade_id: str, player_resources: Dict[str, int]) -> tuple[bool, str]:
        """Check if player can purchase an upgrade."""
        upgrade = next((u for u in self.upgrades if u.id == upgrade_id), None)
        if not upgrade:
            return False, "Upgrade not found"
            
        if not upgrade.unlocked:
            return False, f"Upgrade requires {upgrade.level_required.value} level"
            
        if upgrade.purchased:
            return False, "Upgrade already purchased"
            
        # Check resource cost
        for resource, amount in upgrade.cost.model_dump().items():
            if player_resources.get(resource, 0) < amount:
                return False, f"Insufficient {resource}: need {amount}, have {player_resources.get(resource, 0)}"
                
        return True, "Can purchase"
    
    def purchase_upgrade(self, upgrade_id: str) -> Optional[TechUpgrade]:
        """Purchase an upgrade."""
        upgrade = next((u for u in self.upgrades if u.id == upgrade_id), None)
        if upgrade and upgrade.unlocked and not upgrade.purchased:
            upgrade.purchased = True
            return upgrade
        return None
    
    def get_unlocked_units(self) -> Set[str]:
        """Get all unlocked unit types for current level."""
        unlocked = set()
        level_order = [TechLevel.MANOR, TechLevel.DUCHY, TechLevel.KINGDOM]
        current_index = level_order.index(self.current_level)
        
        for i in range(current_index + 1):
            level = level_order[i].value
            unlocked.update(self.unlocked_units.get(level, []))
            
        return unlocked
    
    def get_unlocked_buildings(self) -> Set[str]:
        """Get all unlocked building types for current level."""
        unlocked = set()
        level_order = [TechLevel.MANOR, TechLevel.DUCHY, TechLevel.KINGDOM]
        current_index = level_order.index(self.current_level)
        
        for i in range(current_index + 1):
            level = level_order[i].value
            unlocked.update(self.unlocked_buildings.get(level, []))
            
        return unlocked
    
    def get_active_effects(self) -> Dict[str, float]:
        """Get all active effects from purchased upgrades."""
        active_effects = {}
        
        for upgrade in self.upgrades:
            if upgrade.purchased:
                for effect, value in upgrade.effects.items():
                    if effect in active_effects:
                        # Stack effects additively
                        active_effects[effect] += value
                    else:
                        active_effects[effect] = value
                        
        return active_effects