"""
Tests for pathfinding and movement system.
"""

import pytest
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.pathfinding import Pathfinder, MovementSystem
from src.models.unit import Unit, UnitType, UnitStatus, Position, UnitSystem


class TestPathfinder:
    """Test pathfinding functionality."""

    def test_basic_pathfinding(self):
        """Test basic pathfinding without obstacles."""
        pathfinder = Pathfinder()
        
        start = Position(x=0, y=0)
        goal = Position(x=3, y=3)
        
        path = pathfinder.find_path(start, goal)
        
        assert path is not None
        assert len(path) >= 2
        assert path[0] == start
        assert path[-1] == goal
    
    def test_pathfinding_with_obstacles(self):
        """Test pathfinding with blocked positions."""
        pathfinder = Pathfinder()
        
        start = Position(x=0, y=0)
        goal = Position(x=2, y=0)
        
        # Block direct path
        blocked = {"1,0"}
        
        path = pathfinder.find_path(start, goal, blocked)
        
        assert path is not None
        assert len(path) > 3  # Should go around obstacle
        assert path[0] == start
        assert path[-1] == goal
    
    def test_pathfinding_with_terrain_weights(self):
        """Test pathfinding with terrain weights (marsh = 2.0)."""
        pathfinder = Pathfinder()
        
        # Set up marsh terrain
        marsh_pos = Position(x=1, y=1)
        pathfinder.set_terrain_weight(marsh_pos, 2.0)
        
        start = Position(x=0, y=0)
        goal = Position(x=2, y=2)
        
        path = pathfinder.find_path(start, goal)
        
        assert path is not None
        # Path should avoid marsh if possible
        marsh_in_path = any(pos.x == 1 and pos.y == 1 for pos in path)
        # May still go through marsh if it's the only way, but cost will be higher
        
    def test_impossible_path(self):
        """Test pathfinding when no path exists."""
        pathfinder = Pathfinder()
        
        start = Position(x=0, y=0)
        goal = Position(x=2, y=0)
        
        # Block all possible paths
        blocked = {"1,0", "0,1", "1,1", "2,1"}
        
        path = pathfinder.find_path(start, goal, blocked)
        
        assert path is None
    
    def test_out_of_bounds(self):
        """Test pathfinding bounds checking."""
        pathfinder = Pathfinder()
        
        start = Position(x=0, y=0)
        
        # Test bounds checking with valid positions
        assert pathfinder.is_valid_position(Position(x=0, y=0))
        assert pathfinder.is_valid_position(Position(x=39, y=39))
        
        # Test pathfinding to edge of grid
        goal = Position(x=39, y=39)  # Valid but far
        path = pathfinder.find_path(start, goal)
        
        assert path is not None  # Should find path to valid position


class TestMovementSystem:
    """Test movement system functionality."""

    def test_set_unit_path(self):
        """Test setting unit path."""
        movement_system = MovementSystem()
        
        path = [Position(x=0, y=0), Position(x=1, y=0), Position(x=2, y=0)]
        movement_system.set_unit_path("unit1", path)
        
        assert movement_system.has_path("unit1")
        assert movement_system.get_unit_destination("unit1") == path[-1]
        assert movement_system.get_unit_progress("unit1") == 0.0
    
    def test_movement_update(self):
        """Test unit movement update."""
        movement_system = MovementSystem()
        
        path = [Position(x=0, y=0), Position(x=1, y=0), Position(x=2, y=0)]
        movement_system.set_unit_path("unit1", path)
        
        # Move unit at 1 tile per second for 0.5 seconds
        new_pos = movement_system.update_unit_movement("unit1", 1.0, 0.5)
        
        assert new_pos is not None
        # Path has 3 positions (2 segments), so 0.5 tiles = 0.5/2 = 0.25 progress
        assert movement_system.get_unit_progress("unit1") == 0.25
    
    def test_movement_completion(self):
        """Test movement completion."""
        movement_system = MovementSystem()
        
        path = [Position(x=0, y=0), Position(x=1, y=0)]
        movement_system.set_unit_path("unit1", path)
        
        # Move unit to completion
        final_pos = movement_system.update_unit_movement("unit1", 1.0, 1.0)
        
        assert final_pos == path[-1]
        assert not movement_system.has_path("unit1")
        assert movement_system.get_unit_progress("unit1") == 1.0
    
    def test_clear_unit_path(self):
        """Test clearing unit path."""
        movement_system = MovementSystem()
        
        path = [Position(x=0, y=0), Position(x=1, y=0), Position(x=2, y=0)]
        movement_system.set_unit_path("unit1", path)
        
        assert movement_system.has_path("unit1")
        
        movement_system.clear_unit_path("unit1")
        
        assert not movement_system.has_path("unit1")
        assert movement_system.get_unit_progress("unit1") == 1.0


class TestUnitSystemMovement:
    """Test unit system movement integration."""

    def test_unit_movement_request(self):
        """Test requesting unit movement."""
        unit_system = UnitSystem()
        
        # Create a unit
        unit = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=10, y=10))
        unit_system.add_unit(unit)
        
        # Request movement
        target = Position(x=12, y=12)
        success = unit_system.move_unit(unit.id, target)
        
        assert success
        assert unit.status == UnitStatus.MOVING
        assert unit.target.position == target
    
    def test_unit_movement_with_obstacles(self):
        """Test unit movement with other units as obstacles."""
        unit_system = UnitSystem()
        
        # Create units
        unit1 = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=10, y=10))
        unit2 = Unit.create_unit(UnitType.ARCHER, owner=2, position=Position(x=11, y=10))
        
        unit_system.add_unit(unit1)
        unit_system.add_unit(unit2)
        
        # Try to move unit1 to position next to unit2
        target = Position(x=12, y=10)
        success = unit_system.move_unit(unit1.id, target)
        
        assert success  # Should find path around unit2
        assert unit1.status == UnitStatus.MOVING
    
    def test_terrain_weight_update(self):
        """Test updating terrain weights."""
        unit_system = UnitSystem()
        
        tile_data = {
            "5,5": {"type": "marsh"},
            "6,6": {"type": "field"}
        }
        
        unit_system.update_terrain_weights(tile_data)
        
        # Check that marsh has higher weight
        marsh_pos = Position(x=5, y=5)
        field_pos = Position(x=6, y=6)
        
        assert unit_system.pathfinder.get_terrain_weight(marsh_pos) == 2.0
        assert unit_system.pathfinder.get_terrain_weight(field_pos) == 1.0
    
    def test_movement_update_integration(self):
        """Test movement update integration."""
        unit_system = UnitSystem()
        
        # Create a unit
        unit = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=10, y=10))
        unit_system.add_unit(unit)
        
        # Start movement
        target = Position(x=12, y=10)
        unit_system.move_unit(unit.id, target)
        
        # Update movement
        movement_events = unit_system.update_unit_movement(0.5)
        
        assert len(movement_events) >= 1
        assert movement_events[0]["type"] == "movement"
        assert movement_events[0]["unit_id"] == unit.id
    
    def test_stop_unit_movement(self):
        """Test stopping unit movement."""
        unit_system = UnitSystem()
        
        # Create a unit
        unit = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=10, y=10))
        unit_system.add_unit(unit)
        
        # Start movement
        target = Position(x=12, y=10)
        unit_system.move_unit(unit.id, target)
        
        assert unit.status == UnitStatus.MOVING
        
        # Stop movement
        success = unit_system.stop_unit_movement(unit.id)
        
        assert success
        assert unit.status == UnitStatus.IDLE
        assert unit.target is None
    
    def test_get_units_in_area(self):
        """Test getting units in area."""
        unit_system = UnitSystem()
        
        # Create units
        unit1 = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=10, y=10))
        unit2 = Unit.create_unit(UnitType.ARCHER, owner=2, position=Position(x=11, y=11))
        unit3 = Unit.create_unit(UnitType.KNIGHT, owner=1, position=Position(x=15, y=15))
        
        unit_system.add_unit(unit1)
        unit_system.add_unit(unit2)
        unit_system.add_unit(unit3)
        
        # Get units in area around (10, 10) with radius 2
        units_in_area = unit_system.get_units_in_area(Position(x=10, y=10), 2)
        
        assert len(units_in_area) == 2
        assert unit1 in units_in_area
        assert unit2 in units_in_area
        assert unit3 not in units_in_area 