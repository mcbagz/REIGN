"""
Tests for unit system combat mechanics.
"""

import pytest
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from src.models.unit import Unit, UnitType, UnitStatus, Position, UnitSystem


class TestUnitCombat:
    """Test unit combat mechanics."""

    def test_infantry_vs_archer_combat(self):
        """Test infantry vs archer combat (infantry should win)."""
        # Create units at adjacent positions
        infantry = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=10, y=10))
        archer = Unit.create_unit(UnitType.ARCHER, owner=2, position=Position(x=10, y=11))
        
        # Infantry should have advantage over archer
        damage = infantry.calculate_damage(archer)
        expected_damage = infantry.attack * 1.5  # 20 * 1.5 = 30
        
        assert damage == expected_damage
        
        # Archer should be at disadvantage against infantry
        damage_back = archer.calculate_damage(infantry)
        expected_damage_back = int(archer.attack * 0.5)  # 25 * 0.5 = 12.5 -> 12
        
        assert damage_back == expected_damage_back

    def test_archer_vs_knight_combat(self):
        """Test archer vs knight combat (archer should win)."""
        archer = Unit.create_unit(UnitType.ARCHER, owner=1, position=Position(x=10, y=10))
        knight = Unit.create_unit(UnitType.KNIGHT, owner=2, position=Position(x=10, y=11))
        
        # Archer should have advantage over knight
        damage = archer.calculate_damage(knight)
        expected_damage = int(archer.attack * 1.5)  # 25 * 1.5 = 37.5 -> 37
        
        assert damage == expected_damage

    def test_knight_vs_infantry_combat(self):
        """Test knight vs infantry combat (knight should win)."""
        knight = Unit.create_unit(UnitType.KNIGHT, owner=1, position=Position(x=10, y=10))
        infantry = Unit.create_unit(UnitType.INFANTRY, owner=2, position=Position(x=10, y=11))
        
        # Knight should have advantage over infantry
        damage = knight.calculate_damage(infantry)
        expected_damage = knight.attack * 1.5  # 30 * 1.5 = 45
        
        assert damage == expected_damage

    def test_siege_unit_stats(self):
        """Test siege unit has correct stats."""
        siege = Unit.create_unit(UnitType.SIEGE, owner=1, position=Position(x=10, y=10))
        
        assert siege.hp == 120
        assert siege.max_hp == 120
        assert siege.attack == 50
        assert siege.speed == 0.5
        assert siege.range == 2

    def test_range_detection(self):
        """Test unit range detection."""
        archer = Unit.create_unit(UnitType.ARCHER, owner=1, position=Position(x=10, y=10))
        
        # Should be in range (distance = 2)
        target_pos = Position(x=10, y=12)
        assert archer.is_in_range(target_pos)
        
        # Should not be in range (distance = 3)
        target_pos = Position(x=10, y=13)
        assert not archer.is_in_range(target_pos)

    def test_unit_death(self):
        """Test unit death mechanics."""
        unit = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=10, y=10))
        
        # Apply damage less than HP
        died = unit.take_damage(50)
        assert not died
        assert unit.hp == 50
        assert unit.status == UnitStatus.IDLE
        
        # Apply damage that kills the unit
        died = unit.take_damage(60)
        assert died
        assert unit.hp == 0
        assert unit.status == UnitStatus.DEAD


class TestUnitSystem:
    """Test unit system management."""

    def test_add_remove_units(self):
        """Test adding and removing units."""
        system = UnitSystem()
        unit = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=10, y=10))
        
        # Add unit
        system.add_unit(unit)
        assert len(system.units) == 1
        assert system.get_unit(unit.id) == unit
        
        # Remove unit
        removed = system.remove_unit(unit.id)
        assert removed == unit
        assert len(system.units) == 0

    def test_get_units_by_owner(self):
        """Test getting units by owner."""
        system = UnitSystem()
        
        unit1 = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=10, y=10))
        unit2 = Unit.create_unit(UnitType.ARCHER, owner=1, position=Position(x=11, y=10))
        unit3 = Unit.create_unit(UnitType.KNIGHT, owner=2, position=Position(x=12, y=10))
        
        system.add_unit(unit1)
        system.add_unit(unit2)
        system.add_unit(unit3)
        
        player1_units = system.get_units_by_owner(1)
        assert len(player1_units) == 2
        assert unit1 in player1_units
        assert unit2 in player1_units
        
        player2_units = system.get_units_by_owner(2)
        assert len(player2_units) == 1
        assert unit3 in player2_units

    def test_enemy_units_in_range(self):
        """Test finding enemy units in range."""
        system = UnitSystem()
        
        # Create attacking unit
        attacker = Unit.create_unit(UnitType.ARCHER, owner=1, position=Position(x=10, y=10))
        
        # Create enemy units - one in range, one out of range
        enemy1 = Unit.create_unit(UnitType.INFANTRY, owner=2, position=Position(x=10, y=12))  # Distance 2, in range
        enemy2 = Unit.create_unit(UnitType.KNIGHT, owner=2, position=Position(x=10, y=14))    # Distance 4, out of range
        ally = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=10, y=11))   # Same owner, should be ignored
        
        system.add_unit(attacker)
        system.add_unit(enemy1)
        system.add_unit(enemy2)
        system.add_unit(ally)
        
        enemies_in_range = system.get_enemy_units_in_range(attacker)
        
        assert len(enemies_in_range) == 1
        assert enemy1 in enemies_in_range
        assert enemy2 not in enemies_in_range
        assert ally not in enemies_in_range

    def test_training_queue(self):
        """Test unit training queue."""
        system = UnitSystem()
        
        # Start training
        training_id = system.start_training(UnitType.INFANTRY, owner=1, position=Position(x=10, y=10))
        
        assert training_id in system.training_queue
        assert len(system.units) == 0  # Unit not yet in main system
        
        # Check training info
        training_info = system.training_queue[training_id]
        assert training_info["unit"].type == UnitType.INFANTRY
        assert training_info["unit"].status == UnitStatus.TRAINING
        assert training_info["duration"] == 10.0  # Infantry training time 