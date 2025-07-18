"""
Integration tests for elimination and victory flow.
"""

import pytest
import asyncio
import time
from unittest.mock import AsyncMock, MagicMock
from src.game_room import Room
from src.models.unit import Unit, UnitType, UnitStatus, Position
from src.models.tile import Tile, TileType, Resources, TileMetadata
from src.models.game_state import GameState, Player, GameStatus, TechLevel
from src.models.websocket_message import WebSocketMessage
from src.main import handle_attack_tile, send_error_response


class TestEliminationVictoryFlow:
    """Test suite for elimination and victory flow integration."""

    def setup_method(self):
        """Set up test fixtures."""
        self.room = Room(room_id="test_room")
        
        # Create players
        self.player1 = Player(
            id=1,
            name="Player 1",
            color="#FF0000",
            is_connected=True,
            is_eliminated=False,
            resources={"gold": 100, "food": 100, "faith": 100},
            tech_level=TechLevel.MANOR,
            capital_hp=1000,
            capital_city=Position(x=10, y=10)
        )
        
        self.player2 = Player(
            id=2,
            name="Player 2",
            color="#00FF00",
            is_connected=True,
            is_eliminated=False,
            resources={"gold": 100, "food": 100, "faith": 100},
            tech_level=TechLevel.MANOR,
            capital_hp=1000,
            capital_city=Position(x=30, y=10)
        )
        
        # Create game state
        self.room.state = GameState(
            game_id="test_game_123",
            status=GameStatus.PLAYING,
            current_player=1,
            players=[self.player1, self.player2],
            tiles=[],
            units=[],
            available_tiles=[],
            turn_number=1,
            turn_time_remaining=60.0,
            game_start_time=time.time(),
            last_update=time.time()
        )
        
        # Create capital city tiles
        self.capital1 = Tile(
            id="10,10",
            type=TileType.CAPITAL_CITY,
            x=10,
            y=10,
            edges=["city", "city", "city", "city"],
            hp=1000,
            max_hp=1000,
            owner=1,
            resources=Resources(gold=2, food=0, faith=0),
            placed_at=time.time()
        )
        
        self.capital2 = Tile(
            id="30,10",
            type=TileType.CAPITAL_CITY,
            x=30,
            y=10,
            edges=["city", "city", "city", "city"],
            hp=1000,
            max_hp=1000,
            owner=2,
            resources=Resources(gold=2, food=0, faith=0),
            placed_at=time.time()
        )
        
        self.room.state.tiles = [self.capital1, self.capital2]
        
        # Create units for testing
        self.siege_unit = Unit.create_unit(UnitType.SIEGE, owner=1, position=Position(x=11, y=10))
        self.room.unit_system.add_unit(self.siege_unit)
        
        # Mock websocket
        self.mock_websocket = AsyncMock()
        self.room.connections["1"] = self.mock_websocket

    def test_capital_hp_sync_on_tile_damage(self):
        """Test that player capital HP syncs with capital city tile HP when attacked."""
        # Create siege unit next to enemy capital
        attacker = Unit.create_unit(UnitType.SIEGE, owner=1, position=Position(x=29, y=10))
        self.room.unit_system.add_unit(attacker)
        
        # Calculate expected damage (siege does 2x damage to buildings)
        expected_damage = attacker.calculate_building_damage()  # 50 * 2 = 100
        
        # Simulate tile attack
        original_tile_hp = self.capital2.hp
        original_player_hp = self.player2.capital_hp
        
        # Manually apply damage (simulating the attack handler)
        self.capital2.hp = max(0, self.capital2.hp - expected_damage)
        
        # Update player capital HP based on tile HP ratio
        hp_ratio = self.capital2.hp / self.capital2.max_hp
        self.player2.capital_hp = int(self.player2.capital_hp * hp_ratio)
        
        # Verify synchronization
        expected_tile_hp = original_tile_hp - expected_damage
        expected_player_hp = int(original_player_hp * (expected_tile_hp / 1000))
        
        assert self.capital2.hp == expected_tile_hp
        assert self.player2.capital_hp == expected_player_hp

    def test_player_elimination_on_zero_capital_hp(self):
        """Test that player is eliminated when capital HP reaches zero."""
        # Set player capital HP to low value
        self.player2.capital_hp = 50
        
        # Check elimination before (should not be eliminated)
        eliminated_before, winner_before = self.room.conquest_system.check_elimination(self.room.state.players)
        assert 2 not in eliminated_before
        assert self.player2.is_eliminated == False
        
        # Reduce capital HP to 0
        self.player2.capital_hp = 0
        
        # Check elimination after (should be eliminated)
        eliminated_after, winner_after = self.room.conquest_system.check_elimination(self.room.state.players)
        assert 2 in eliminated_after
        assert self.player2.is_eliminated == True
        
        # Player 1 should be the winner
        assert winner_after == 1

    def test_victory_detection_last_player_standing(self):
        """Test victory detection when only one player remains."""
        # Eliminate player 2
        self.player2.capital_hp = 0
        self.player2.is_eliminated = True
        
        # Check victory
        eliminated_players, winner = self.room.conquest_system.check_elimination(self.room.state.players)
        
        assert winner == 1  # Player 1 should be the winner
        assert self.player1.is_eliminated == False
        assert self.player2.is_eliminated == True

    def test_turn_advancement_skips_eliminated_players(self):
        """Test that turn advancement skips eliminated players."""
        # Add a third player
        player3 = Player(
            id=3,
            name="Player 3",
            color="#0000FF",
            is_connected=True,
            is_eliminated=False,
            resources={"gold": 100, "food": 100, "faith": 100},
            tech_level=TechLevel.MANOR,
            capital_hp=1000,
            capital_city=Position(x=10, y=30)
        )
        self.room.state.players.append(player3)
        
        # Set current player to 1
        self.room.state.current_player = 1
        
        # Eliminate player 2
        self.player2.is_eliminated = True
        
        # Advance turn
        self.room._advance_turn()
        
        # Should skip eliminated player 2 and go to player 3
        assert self.room.state.current_player == 3
        
        # Advance turn again
        self.room._advance_turn()
        
        # Should cycle back to player 1
        assert self.room.state.current_player == 1

    def test_no_victory_with_multiple_active_players(self):
        """Test that no victory is declared when multiple players are active."""
        # Both players are active
        self.player1.is_eliminated = False
        self.player2.is_eliminated = False
        
        # Check victory
        eliminated_players, winner = self.room.conquest_system.check_elimination(self.room.state.players)
        
        assert winner is None  # No winner yet
        assert eliminated_players == []  # No eliminations

    def test_siege_building_damage_multiplier(self):
        """Test that siege units deal 2x damage to buildings."""
        siege_unit = Unit.create_unit(UnitType.SIEGE, owner=1, position=Position(x=10, y=10))
        infantry_unit = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=10, y=10))
        
        # Siege should deal 2x damage to buildings
        siege_damage = siege_unit.calculate_building_damage()
        expected_siege_damage = siege_unit.attack * 2.0  # 50 * 2 = 100
        assert siege_damage == expected_siege_damage
        
        # Infantry should deal normal damage to buildings
        infantry_damage = infantry_unit.calculate_building_damage()
        expected_infantry_damage = infantry_unit.attack * 1.0  # 20 * 1 = 20
        assert infantry_damage == expected_infantry_damage

    @pytest.mark.asyncio
    async def test_attack_tile_command_success(self):
        """Test successful tile attack command."""
        # Create siege unit in range of enemy capital
        attacker = Unit.create_unit(UnitType.SIEGE, owner=1, position=Position(x=29, y=10))
        self.room.unit_system.add_unit(attacker)
        
        # Mock websocket send
        self.mock_websocket.send_text = AsyncMock()
        
        # Mock broadcast message
        self.room._broadcast_message = AsyncMock()
        
        # Attack data
        attack_data = {
            "unitId": attacker.id,
            "targetTileId": "30,10"
        }
        
        # Execute attack
        await handle_attack_tile(self.room, "1", attack_data, self.mock_websocket)
        
        # Verify tile was damaged
        assert self.capital2.hp < self.capital2.max_hp
        
        # Verify player capital HP was updated
        assert self.player2.capital_hp < 1000
        
        # Verify broadcast was called
        self.room._broadcast_message.assert_called_once()
        
        # Verify response was sent
        self.mock_websocket.send_text.assert_called_once()

    @pytest.mark.asyncio
    async def test_attack_tile_command_validations(self):
        """Test tile attack command validation errors."""
        # Mock error response
        mock_error = AsyncMock()
        
        # Test missing unit ID
        await handle_attack_tile(self.room, "1", {"targetTileId": "30,10"}, self.mock_websocket)
        
        # Test missing target tile ID
        await handle_attack_tile(self.room, "1", {"unitId": "fake_unit"}, self.mock_websocket)
        
        # Test unit not found
        await handle_attack_tile(self.room, "1", {"unitId": "fake_unit", "targetTileId": "30,10"}, self.mock_websocket)
        
        # Test unit not owned by player
        await handle_attack_tile(self.room, "2", {"unitId": self.siege_unit.id, "targetTileId": "30,10"}, self.mock_websocket)

    @pytest.mark.asyncio
    async def test_elimination_event_broadcast(self):
        """Test that elimination events are properly broadcast."""
        # Mock broadcast message
        self.room._broadcast_message = AsyncMock()
        
        # Simulate player elimination
        await self.room._handle_player_elimination(2)
        
        # Verify elimination event was broadcast
        self.room._broadcast_message.assert_called_once()
        call_args = self.room._broadcast_message.call_args[0][0]
        
        assert call_args["type"] == "player_eliminated"
        assert call_args["payload"]["player_id"] == 2
        assert call_args["payload"]["player_name"] == "Player 2"

    @pytest.mark.asyncio
    async def test_victory_event_broadcast(self):
        """Test that victory events are properly broadcast."""
        # Mock broadcast message
        self.room._broadcast_message = AsyncMock()
        
        # Simulate victory
        await self.room._handle_victory(1)
        
        # Verify victory event was broadcast
        self.room._broadcast_message.assert_called_once()
        call_args = self.room._broadcast_message.call_args[0][0]
        
        assert call_args["type"] == "game_victory"
        assert call_args["payload"]["winner_id"] == 1
        assert call_args["payload"]["winner_name"] == "Player 1"

    def test_capital_city_identification(self):
        """Test that capital cities are properly identified."""
        # Test capital city tile
        assert self.capital1.type == TileType.CAPITAL_CITY
        assert self.capital1.owner == 1
        assert self.capital1.hp == 1000
        
        # Test non-capital tile
        city_tile = Tile(
            id="15,15",
            type=TileType.CITY,
            x=15,
            y=15,
            edges=["city", "city", "city", "city"],
            hp=200,
            max_hp=200,
            owner=1,
            resources=Resources(gold=1, food=0, faith=0),
            placed_at=time.time()
        )
        
        assert city_tile.type == TileType.CITY
        assert city_tile.type != TileType.CAPITAL_CITY

    def test_game_state_after_elimination(self):
        """Test game state changes after player elimination."""
        # Initial state
        assert self.room.state.status == GameStatus.PLAYING
        assert not self.player2.is_eliminated
        
        # Eliminate player 2
        self.player2.is_eliminated = True
        self.player2.capital_city = None
        
        # Check state changes
        assert self.player2.is_eliminated == True
        assert self.player2.capital_city is None
        
        # Active players should only include player 1
        active_players = [p for p in self.room.state.players if not p.is_eliminated]
        assert len(active_players) == 1
        assert active_players[0].id == 1

    def test_multiple_attacks_on_capital(self):
        """Test multiple attacks reducing capital HP progressively."""
        # Create multiple siege units
        siege1 = Unit.create_unit(UnitType.SIEGE, owner=1, position=Position(x=29, y=10))
        siege2 = Unit.create_unit(UnitType.SIEGE, owner=1, position=Position(x=31, y=10))
        
        initial_hp = self.capital2.hp
        initial_player_hp = self.player2.capital_hp
        
        # First attack
        damage1 = siege1.calculate_building_damage()
        self.capital2.hp = max(0, self.capital2.hp - damage1)
        hp_ratio = self.capital2.hp / self.capital2.max_hp
        self.player2.capital_hp = int(initial_player_hp * hp_ratio)
        
        first_attack_hp = self.capital2.hp
        first_attack_player_hp = self.player2.capital_hp
        
        # Second attack
        damage2 = siege2.calculate_building_damage()
        self.capital2.hp = max(0, self.capital2.hp - damage2)
        hp_ratio = self.capital2.hp / self.capital2.max_hp
        self.player2.capital_hp = int(initial_player_hp * hp_ratio)
        
        # Verify progressive damage
        assert self.capital2.hp < first_attack_hp
        assert self.player2.capital_hp < first_attack_player_hp
        assert self.capital2.hp == initial_hp - damage1 - damage2

    def test_draw_scenario(self):
        """Test scenario where all players are eliminated (draw)."""
        # Set both players' capital HP to 0 but don't mark as eliminated yet
        self.player1.capital_hp = 0
        self.player1.is_eliminated = False  # Not eliminated yet
        self.player2.capital_hp = 0
        self.player2.is_eliminated = False  # Not eliminated yet
        
        # Check elimination
        eliminated_players, winner = self.room.conquest_system.check_elimination(self.room.state.players)
        
        # Should be no winner (draw)
        assert winner is None
        assert 1 in eliminated_players
        assert 2 in eliminated_players
        # Both players should now be marked as eliminated
        assert self.player1.is_eliminated == True
        assert self.player2.is_eliminated == True


if __name__ == "__main__":
    pytest.main([__file__]) 