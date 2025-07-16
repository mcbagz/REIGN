"""
Tests for the combat system with spatial hashing.
"""

import pytest
import sys
import os
import time
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.combat_system import SpatialHash, CombatSystem, DamageCalculator
from src.models.unit import Unit, UnitType, UnitStatus, Position, UnitSystem


class TestSpatialHash:
    """Test spatial hash functionality."""

    def test_add_remove_units(self):
        """Test adding and removing units from spatial hash."""
        spatial_hash = SpatialHash(cell_size=4)
        
        # Add units
        spatial_hash.add_unit("unit1", Position(x=1, y=1))
        spatial_hash.add_unit("unit2", Position(x=5, y=5))
        
        assert len(spatial_hash.unit_positions) == 2
        assert "unit1" in spatial_hash.unit_positions
        assert "unit2" in spatial_hash.unit_positions
        
        # Remove unit
        spatial_hash.remove_unit("unit1")
        assert len(spatial_hash.unit_positions) == 1
        assert "unit1" not in spatial_hash.unit_positions
        assert "unit2" in spatial_hash.unit_positions
    
    def test_get_units_in_radius(self):
        """Test getting units within radius."""
        spatial_hash = SpatialHash(cell_size=4)
        
        # Add units at different positions
        spatial_hash.add_unit("unit1", Position(x=10, y=10))
        spatial_hash.add_unit("unit2", Position(x=11, y=11))  # Distance 2
        spatial_hash.add_unit("unit3", Position(x=15, y=15))  # Distance 10
        
        # Get units in radius 3 from (10, 10)
        units_in_range = spatial_hash.get_units_in_radius(Position(x=10, y=10), 3)
        
        assert len(units_in_range) == 2
        assert "unit1" in units_in_range
        assert "unit2" in units_in_range
        assert "unit3" not in units_in_range
    
    def test_update_unit_position(self):
        """Test updating unit position."""
        spatial_hash = SpatialHash(cell_size=4)
        
        # Add unit
        spatial_hash.add_unit("unit1", Position(x=1, y=1))
        
        # Update position
        spatial_hash.update_unit_position("unit1", Position(x=10, y=10))
        
        assert spatial_hash.unit_positions["unit1"].x == 10
        assert spatial_hash.unit_positions["unit1"].y == 10
        
        # Verify it's found at new position
        units_nearby = spatial_hash.get_units_in_radius(Position(x=10, y=10), 1)
        assert "unit1" in units_nearby
    
    def test_cell_partitioning(self):
        """Test that spatial hash partitions space correctly."""
        spatial_hash = SpatialHash(cell_size=4)
        
        # Add units in different cells
        spatial_hash.add_unit("unit1", Position(x=1, y=1))    # Cell (0,0)
        spatial_hash.add_unit("unit2", Position(x=5, y=5))    # Cell (1,1)
        spatial_hash.add_unit("unit3", Position(x=9, y=9))    # Cell (2,2)
        
        # Each should be in different cells
        cell1 = spatial_hash._get_cell_key(Position(x=1, y=1))
        cell2 = spatial_hash._get_cell_key(Position(x=5, y=5))
        cell3 = spatial_hash._get_cell_key(Position(x=9, y=9))
        
        assert cell1 != cell2
        assert cell2 != cell3
        assert cell1 != cell3


class TestCombatSystem:
    """Test combat system functionality."""

    def test_add_remove_units(self):
        """Test adding and removing units from combat system."""
        combat_system = CombatSystem()
        
        unit = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=10, y=10))
        
        # Add unit
        combat_system.add_unit(unit)
        assert len(combat_system.spatial_hash.unit_positions) == 1
        
        # Remove unit
        combat_system.remove_unit(unit.id)
        assert len(combat_system.spatial_hash.unit_positions) == 0
    
    def test_attack_cooldown(self):
        """Test attack cooldown system."""
        combat_system = CombatSystem()
        current_time = time.time()
        
        # Unit should be able to attack initially
        assert combat_system.can_attack("unit1", current_time)
        
        # Record attack
        combat_system.unit_last_attack["unit1"] = current_time
        
        # Should not be able to attack immediately
        assert not combat_system.can_attack("unit1", current_time)
        
        # Should be able to attack after cooldown
        future_time = current_time + combat_system.attack_cooldown + 0.1
        assert combat_system.can_attack("unit1", future_time)
    
    def test_find_targets_in_range(self):
        """Test finding targets in range."""
        combat_system = CombatSystem()
        
        # Create units
        attacker = Unit.create_unit(UnitType.ARCHER, owner=1, position=Position(x=10, y=10))
        enemy1 = Unit.create_unit(UnitType.INFANTRY, owner=2, position=Position(x=11, y=11))
        enemy2 = Unit.create_unit(UnitType.KNIGHT, owner=2, position=Position(x=15, y=15))
        ally = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=11, y=10))
        
        # Add to combat system
        combat_system.add_unit(attacker)
        combat_system.add_unit(enemy1)
        combat_system.add_unit(enemy2)
        combat_system.add_unit(ally)
        
        all_units = {
            attacker.id: attacker,
            enemy1.id: enemy1,
            enemy2.id: enemy2,
            ally.id: ally
        }
        
        # Find targets (archer has range 2)
        targets = combat_system.find_targets_in_range(attacker, all_units)
        
        assert len(targets) == 1
        assert targets[0].id == enemy1.id  # Only enemy1 is in range
    
    def test_combat_tick(self):
        """Test combat tick processing."""
        combat_system = CombatSystem()
        current_time = time.time()
        
        # Create units
        attacker = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=10, y=10))
        target = Unit.create_unit(UnitType.ARCHER, owner=2, position=Position(x=10, y=11))
        
        # Add to combat system
        combat_system.add_unit(attacker)
        combat_system.add_unit(target)
        
        all_units = {
            attacker.id: attacker,
            target.id: target
        }
        
        # Process combat tick
        events = combat_system.process_combat_tick(all_units, current_time)
        
        assert len(events) >= 1
        assert events[0].type == "attack"
        assert events[0].attacker_id == attacker.id
        assert events[0].target_id == target.id
        assert events[0].damage > 0
        
        # Attacker should be in attacking state
        assert attacker.status == UnitStatus.ATTACKING
    
    def test_combat_with_death(self):
        """Test combat resulting in unit death."""
        combat_system = CombatSystem()
        current_time = time.time()
        
        # Create units - infantry vs archer (infantry should win)
        attacker = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=10, y=10))
        target = Unit.create_unit(UnitType.ARCHER, owner=2, position=Position(x=10, y=11))
        
        # Weaken target to ensure death
        target.hp = 1
        
        # Add to combat system
        combat_system.add_unit(attacker)
        combat_system.add_unit(target)
        
        all_units = {
            attacker.id: attacker,
            target.id: target
        }
        
        # Process combat tick
        events = combat_system.process_combat_tick(all_units, current_time)
        
        # Should have attack and death events
        assert len(events) == 2
        assert events[0].type == "attack"
        assert events[1].type == "death"
        assert events[1].target_died == True
        
        # Target should be dead
        assert target.status == UnitStatus.DEAD
        assert target.hp == 0


class TestDamageCalculator:
    """Test damage calculation utilities."""

    def test_calculate_dps(self):
        """Test damage per second calculation."""
        attacker = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=10, y=10))
        target = Unit.create_unit(UnitType.ARCHER, owner=2, position=Position(x=10, y=11))
        
        dps = DamageCalculator.calculate_dps(attacker, target)
        
        # Infantry does 1.5x damage to archer (20 * 1.5 = 30)
        assert dps == 30.0
    
    def test_calculate_time_to_kill(self):
        """Test time to kill calculation."""
        attacker = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=10, y=10))
        target = Unit.create_unit(UnitType.ARCHER, owner=2, position=Position(x=10, y=11))
        
        ttk = DamageCalculator.calculate_time_to_kill(attacker, target)
        
        # Archer has 75 HP, infantry does 30 DPS -> 75/30 = 2.5 seconds
        assert ttk == 2.5
    
    def test_calculate_combat_outcome(self):
        """Test combat outcome prediction."""
        infantry = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=10, y=10))
        archer = Unit.create_unit(UnitType.ARCHER, owner=2, position=Position(x=10, y=11))
        
        outcome = DamageCalculator.calculate_combat_outcome(infantry, archer)
        
        assert "unit1_ttk" in outcome
        assert "unit2_ttk" in outcome
        assert "unit1_wins" in outcome
        assert "unit2_wins" in outcome
        assert "winner" in outcome
        
        # Infantry should win against archer
        assert outcome["unit1_wins"] == True
        assert outcome["winner"] == infantry.id


class TestUnitSystemCombatIntegration:
    """Test combat system integration with unit system."""

    def test_combat_system_integration(self):
        """Test that unit system integrates with combat system."""
        unit_system = UnitSystem()
        
        # Create units
        unit1 = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=10, y=10))
        unit2 = Unit.create_unit(UnitType.ARCHER, owner=2, position=Position(x=10, y=11))
        
        # Add to system
        unit_system.add_unit(unit1)
        unit_system.add_unit(unit2)
        
        # Check combat system has units
        assert len(unit_system.combat_system.spatial_hash.unit_positions) == 2
        
        # Process combat
        current_time = time.time()
        events = unit_system.process_combat(current_time)
        
        assert len(events) >= 1
        assert events[0]["type"] == "attack"
        assert events[0]["attacker_id"] == unit1.id
        assert events[0]["target_id"] == unit2.id
    
    def test_combat_statistics(self):
        """Test combat statistics."""
        unit_system = UnitSystem()
        
        # Add units
        unit1 = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=10, y=10))
        unit2 = Unit.create_unit(UnitType.ARCHER, owner=2, position=Position(x=20, y=20))
        
        unit_system.add_unit(unit1)
        unit_system.add_unit(unit2)
        
        # Get statistics
        stats = unit_system.get_combat_statistics()
        
        assert stats["total_units"] == 2
        assert stats["spatial_cells"] >= 2  # Units in different cells
        assert "recent_events" in stats
    
    def test_combat_outcome_prediction(self):
        """Test combat outcome prediction."""
        unit_system = UnitSystem()
        
        # Create units
        unit1 = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=10, y=10))
        unit2 = Unit.create_unit(UnitType.ARCHER, owner=2, position=Position(x=10, y=11))
        
        unit_system.add_unit(unit1)
        unit_system.add_unit(unit2)
        
        # Calculate outcome
        outcome = unit_system.calculate_combat_outcome(unit1.id, unit2.id)
        
        assert outcome is not None
        assert outcome["unit1_wins"] == True  # Infantry beats archer
        assert outcome["winner"] == unit1.id
    
    def test_spatial_hash_efficiency(self):
        """Test that spatial hash provides efficiency benefits."""
        unit_system = UnitSystem()
        
        # Add many units
        for i in range(20):
            unit = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=i, y=i))
            unit_system.add_unit(unit)
        
        # Query should be efficient
        center = Position(x=10, y=10)
        nearby_units = unit_system.get_units_in_area(center, 2)
        
        # Should find units near center
        assert len(nearby_units) > 0
        assert len(nearby_units) < 20  # Not all units
        
        # Verify all returned units are actually in range
        for unit in nearby_units:
            distance = abs(unit.position.x - center.x) + abs(unit.position.y - center.y)
            assert distance <= 2 