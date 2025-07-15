"""
Test suite for pydantic models - validates round-trip serialization.
"""

import pytest
import json
from datetime import datetime
from typing import Dict, Any

from src.models import (
    Tile, TileType, WorkerType, Resources, Worker, TileMetadata,
    Unit, UnitType, UnitStatus, Position, Target, UnitCost, CombatEffectiveness, UnitMetadata,
    GameState, GameStatus, TechLevel, Player, PlayerStats, AvailableTile, GameEvent, GameSettings,
    WebSocketMessage, MessageType, Priority, CommandPayload, StatePayload, ErrorPayload, JoinGamePayload
)


class TestTileModel:
    """Test cases for Tile model."""
    
    def test_tile_creation(self):
        """Test basic tile creation."""
        tile_data = {
            "id": "10,15",
            "type": "city",
            "x": 10,
            "y": 15,
            "edges": ["city", "field", "city", "field"],
            "hp": 100,
            "max_hp": 100,
            "owner": 1,
            "resources": {"gold": 2, "food": 0, "faith": 0},
            "placed_at": 1640995200.0
        }
        
        tile = Tile(**tile_data)
        assert tile.id == "10,15"
        assert tile.type == TileType.CITY
        assert tile.x == 10
        assert tile.y == 15
        assert tile.hp == 100
        assert tile.owner == 1
        assert tile.resources.gold == 2
        
    def test_tile_with_worker(self):
        """Test tile with worker."""
        tile_data = {
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
            "resources": {"gold": 2, "food": 0, "faith": 0},
            "placed_at": 1640995200.0
        }
        
        tile = Tile(**tile_data)
        assert tile.worker is not None
        assert tile.worker.type == WorkerType.MAGISTRATE
        assert tile.worker.owner == 1
        
    def test_tile_serialization(self):
        """Test tile JSON serialization round-trip."""
        tile_data = {
            "id": "10,15",
            "type": "city",
            "x": 10,
            "y": 15,
            "edges": ["city", "field", "city", "field"],
            "hp": 100,
            "max_hp": 100,
            "owner": 1,
            "resources": {"gold": 2, "food": 0, "faith": 0},
            "placed_at": 1640995200.0
        }
        
        tile = Tile(**tile_data)
        serialized = tile.dict()
        deserialized = Tile(**serialized)
        
        assert tile.id == deserialized.id
        assert tile.type == deserialized.type
        assert tile.resources.gold == deserialized.resources.gold


class TestUnitModel:
    """Test cases for Unit model."""
    
    def test_unit_creation(self):
        """Test basic unit creation."""
        unit_data = {
            "id": "unit_1",
            "type": "infantry",
            "owner": 1,
            "position": {"x": 10, "y": 15},
            "hp": 100,
            "max_hp": 100,
            "attack": 20,
            "defense": 15,
            "speed": 1.0,
            "range": 1,
            "status": "idle",
            "created_at": 1640995200.0
        }
        
        unit = Unit(**unit_data)
        assert unit.id == "unit_1"
        assert unit.type == UnitType.INFANTRY
        assert unit.owner == 1
        assert unit.position.x == 10
        assert unit.position.y == 15
        assert unit.hp == 100
        assert unit.status == UnitStatus.IDLE
        
    def test_unit_with_target(self):
        """Test unit with target."""
        unit_data = {
            "id": "unit_1",
            "type": "infantry",
            "owner": 1,
            "position": {"x": 10, "y": 15},
            "hp": 100,
            "max_hp": 100,
            "attack": 20,
            "defense": 15,
            "speed": 1.0,
            "range": 1,
            "status": "moving",
            "target": {
                "type": "tile",
                "id": "20,25",
                "position": {"x": 20, "y": 25}
            },
            "created_at": 1640995200.0
        }
        
        unit = Unit(**unit_data)
        assert unit.target is not None
        assert unit.target.type == "tile"
        assert unit.target.position.x == 20


class TestGameStateModel:
    """Test cases for GameState model."""
    
    def test_minimal_game_state(self):
        """Test minimal game state creation."""
        game_state_data = {
            "game_id": "game_123",
            "status": "playing",
            "current_player": 1,
            "turn_number": 5,
            "turn_time_remaining": 12.5,
            "game_start_time": 1640995200.0,
            "last_update": 1640995800.0,
            "players": [
                {
                    "id": 1,
                    "name": "Alice",
                    "color": "#FF0000",
                    "is_connected": True,
                    "is_eliminated": False,
                    "resources": {"gold": 100, "food": 50, "faith": 25},
                    "tech_level": "manor",
                    "capital_city": {"x": 20, "y": 20}
                },
                {
                    "id": 2,
                    "name": "Bob",
                    "color": "#0000FF",
                    "is_connected": True,
                    "is_eliminated": False,
                    "resources": {"gold": 80, "food": 40, "faith": 30},
                    "tech_level": "manor",
                    "capital_city": {"x": 25, "y": 25}
                }
            ],
            "tiles": [],
            "units": [],
            "available_tiles": [
                {"type": "city", "count": 15},
                {"type": "field", "count": 20}
            ]
        }
        
        game_state = GameState(**game_state_data)
        assert game_state.game_id == "game_123"
        assert game_state.status == GameStatus.PLAYING
        assert len(game_state.players) == 2
        assert game_state.players[0].tech_level == TechLevel.MANOR


class TestWebSocketMessageModel:
    """Test cases for WebSocketMessage model."""
    
    def test_command_message(self):
        """Test command message creation."""
        message_data = {
            "type": "command",
            "payload": {
                "action": "place_tile",
                "parameters": {
                    "tile_type": "city",
                    "position": {"x": 10, "y": 15},
                    "rotation": 0
                }
            },
            "timestamp": 1640995200.0,
            "message_id": "msg_123",
            "player_id": 1,
            "game_id": "game_456"
        }
        
        message = WebSocketMessage(**message_data)
        assert message.type == MessageType.COMMAND
        assert message.player_id == 1
        assert message.game_id == "game_456"
        assert message.priority == Priority.NORMAL  # default value
        
    def test_error_message(self):
        """Test error message creation."""
        message_data = {
            "type": "error",
            "payload": {
                "code": "INVALID_MOVE",
                "message": "Cannot place tile at that position",
                "retryable": True
            },
            "timestamp": 1640995200.0,
            "message_id": "msg_error_123"
        }
        
        message = WebSocketMessage(**message_data)
        assert message.type == MessageType.ERROR
        assert message.player_id is None  # default value
        
    def test_message_serialization(self):
        """Test message JSON serialization round-trip."""
        message_data = {
            "type": "state",
            "payload": {
                "game_state": {
                    "game_id": "game_123",
                    "status": "playing"
                },
                "full_state": True
            },
            "timestamp": 1640995200.0,
            "message_id": "msg_state_123"
        }
        
        message = WebSocketMessage(**message_data)
        serialized = message.dict()
        deserialized = WebSocketMessage(**serialized)
        
        assert message.type == deserialized.type
        assert message.message_id == deserialized.message_id


class TestSchemaValidation:
    """Test schema validation and edge cases."""
    
    def test_invalid_tile_coordinates(self):
        """Test that invalid coordinates are rejected."""
        with pytest.raises(ValueError):
            Tile(
                id="invalid",
                type="city",
                x=50,  # > 39, should fail
                y=15,
                edges=["city", "field", "city", "field"],
                hp=100,
                max_hp=100,
                owner=1,
                resources={"gold": 2, "food": 0, "faith": 0},
                placed_at=1640995200.0
            )
            
    def test_invalid_unit_status(self):
        """Test that invalid unit status is rejected."""
        with pytest.raises(ValueError):
            Unit(
                id="unit_1",
                type="infantry",
                owner=1,
                position={"x": 10, "y": 15},
                hp=100,
                max_hp=100,
                attack=20,
                defense=15,
                speed=1.0,
                range=1,
                status="invalid_status",  # Invalid status
                created_at=1640995200.0
            )
            
    def test_negative_resources(self):
        """Test that negative resources are rejected."""
        with pytest.raises(ValueError):
            Resources(gold=-10, food=20, faith=5)  # Negative gold should fail


if __name__ == "__main__":
    pytest.main([__file__, "-v"]) 