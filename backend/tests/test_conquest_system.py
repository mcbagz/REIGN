"""
Test conquest system mechanics including raiding, aura effects, and elimination.
"""

import pytest
import time
from src.conquest_system import ConquestSystem, RaidResult, AuraEffect
from src.models.unit import Unit, UnitType, Position
from src.models.tile import Tile, TileType, TileMetadata, Resources
from src.models.game_state import Player, TechLevel


class TestConquestSystem:
    """Test suite for conquest system mechanics."""

    def test_watchtower_aura_creation(self):
        """Test that watchtower auras are created correctly."""
        conquest_system = ConquestSystem()
        
        # Create a watchtower tile
        watchtower = Tile(
            id="10,10",
            type=TileType.WATCHTOWER,
            x=10,
            y=10,
            edges=["watchtower", "field", "watchtower", "field"],
            hp=80,
            max_hp=80,
            owner=1,
            resources=Resources(gold=0, food=0, faith=1),
            placed_at=time.time(),
            metadata=TileMetadata(aura_radius=3)
        )
        
        # Update auras
        conquest_system.update_auras([watchtower], {})
        
        # Check that aura was created
        assert len(conquest_system.active_auras) == 1
        aura = conquest_system.active_auras[0]
        assert aura.source_position.x == 10
        assert aura.source_position.y == 10
        assert aura.radius == 3
        assert aura.defense_multiplier == 1.25
        assert aura.owner_id == 1

    def test_aura_defense_multiplier(self):
        """Test that units get defense multiplier from nearby friendly watchtowers."""
        conquest_system = ConquestSystem()
        
        # Create watchtower and unit
        watchtower = Tile(
            id="10,10",
            type=TileType.WATCHTOWER,
            x=10,
            y=10,
            edges=["watchtower", "field", "watchtower", "field"],
            hp=80,
            max_hp=80,
            owner=1,
            resources=Resources(gold=0, food=0, faith=1),
            placed_at=time.time(),
            metadata=TileMetadata(aura_radius=2)
        )
        
        unit = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=11, y=10))
        
        # Update auras
        conquest_system.update_auras([watchtower], {})
        
        # Test defense multiplier
        multiplier = conquest_system.get_defense_multiplier(unit)
        assert multiplier == 1.25
        
        # Test unit outside aura range
        distant_unit = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=15, y=10))
        multiplier = conquest_system.get_defense_multiplier(distant_unit)
        assert multiplier == 1.0
        
        # Test enemy unit in aura (should not get bonus)
        enemy_unit = Unit.create_unit(UnitType.INFANTRY, owner=2, position=Position(x=11, y=10))
        multiplier = conquest_system.get_defense_multiplier(enemy_unit)
        assert multiplier == 1.0

    def test_raid_execution_success(self):
        """Test successful raid execution."""
        conquest_system = ConquestSystem()
        
        # Create attacker unit
        attacker = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=10, y=10))
        
        # Create target tile with resources
        target_tile = Tile(
            id="11,10",
            type=TileType.CITY,
            x=11,
            y=10,
            edges=["city", "field", "city", "field"],
            hp=100,
            max_hp=100,
            owner=2,
            resources=Resources(gold=100, food=50, faith=25),
            placed_at=time.time()
        )
        
        current_time = time.time()
        
        # Execute raid
        raid_result = conquest_system.execute_raid(attacker, target_tile, current_time)
        
        # Check raid success
        assert raid_result.success == True
        assert raid_result.attacker_id == attacker.id
        assert raid_result.target_tile_id == target_tile.id
        
        # Check resources stolen (10% of each)
        assert raid_result.resources_stolen["gold"] == 10  # 10% of 100
        assert raid_result.resources_stolen["food"] == 5   # 10% of 50
        assert raid_result.resources_stolen["faith"] == 2  # 10% of 25 (rounded down)

    def test_raid_execution_failure(self):
        """Test failed raid execution."""
        conquest_system = ConquestSystem()
        
        # Create attacker unit
        attacker = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=10, y=10))
        
        # Create target tile with no resources
        target_tile = Tile(
            id="11,10",
            type=TileType.CITY,
            x=11,
            y=10,
            edges=["city", "field", "city", "field"],
            hp=100,
            max_hp=100,
            owner=2,
            resources=Resources(gold=0, food=0, faith=0),
            placed_at=time.time()
        )
        
        current_time = time.time()
        
        # Execute raid
        raid_result = conquest_system.execute_raid(attacker, target_tile, current_time)
        
        # Check raid failure
        assert raid_result.success == False
        assert raid_result.resources_stolen == {}

    def test_can_raid_tile_validation(self):
        """Test tile raiding validation."""
        conquest_system = ConquestSystem()
        
        # Create attacker unit
        attacker = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=10, y=10))
        
        # Create valid target tile
        valid_target = Tile(
            id="11,10",
            type=TileType.CITY,
            x=11,
            y=10,
            edges=["city", "field", "city", "field"],
            hp=100,
            max_hp=100,
            owner=2,
            resources=Resources(gold=50, food=25, faith=10),
            placed_at=time.time()
        )
        
        # Test valid raid
        assert conquest_system.can_raid_tile(attacker, valid_target) == True
        
        # Test raiding own tile
        own_tile = Tile(
            id="9,10",
            type=TileType.CITY,
            x=9,
            y=10,
            edges=["city", "field", "city", "field"],
            hp=100,
            max_hp=100,
            owner=1,  # Same owner
            resources=Resources(gold=50, food=25, faith=10),
            placed_at=time.time()
        )
        assert conquest_system.can_raid_tile(attacker, own_tile) == False
        
        # Test raiding tile out of range
        distant_tile = Tile(
            id="15,10",
            type=TileType.CITY,
            x=15,
            y=10,
            edges=["city", "field", "city", "field"],
            hp=100,
            max_hp=100,
            owner=2,
            resources=Resources(gold=50, food=25, faith=10),
            placed_at=time.time()
        )
        assert conquest_system.can_raid_tile(attacker, distant_tile) == False

    def test_apply_raid_resources(self):
        """Test resource application after raid."""
        conquest_system = ConquestSystem()
        
        # Create players
        attacker_player = Player(
            id=1,
            name="Attacker",
            color="#FF0000",
            is_connected=True,
            is_eliminated=False,
            resources={"gold": 100, "food": 100, "faith": 100},
            tech_level=TechLevel.MANOR,
            capital_hp=100
        )
        
        target_player = Player(
            id=2,
            name="Target",
            color="#00FF00",
            is_connected=True,
            is_eliminated=False,
            resources={"gold": 200, "food": 150, "faith": 50},
            tech_level=TechLevel.MANOR,
            capital_hp=100
        )
        
        # Create raid result
        raid_result = RaidResult(
            success=True,
            resources_stolen={"gold": 20, "food": 15, "faith": 5},
            attacker_position=Position(x=10, y=10),
            target_position=Position(x=11, y=10),
            attacker_id="unit_1",
            target_tile_id="11,10",
            timestamp=time.time()
        )
        
        # Apply raid resources
        conquest_system.apply_raid_resources(raid_result, attacker_player, target_player)
        
        # Check attacker gains
        assert attacker_player.resources["gold"] == 120  # 100 + 20
        assert attacker_player.resources["food"] == 115  # 100 + 15
        assert attacker_player.resources["faith"] == 105  # 100 + 5
        
        # Check target losses
        assert target_player.resources["gold"] == 180  # 200 - 20
        assert target_player.resources["food"] == 135  # 150 - 15
        assert target_player.resources["faith"] == 45   # 50 - 5

    def test_elimination_check(self):
        """Test player elimination checking."""
        conquest_system = ConquestSystem()
        
        # Create players
        players = [
            Player(
                id=1,
                name="Player 1",
                color="#FF0000",
                is_connected=True,
                is_eliminated=False,
                resources={"gold": 100, "food": 100, "faith": 100},
                tech_level=TechLevel.MANOR,
                capital_hp=50  # Still alive
            ),
            Player(
                id=2,
                name="Player 2",
                color="#00FF00",
                is_connected=True,
                is_eliminated=False,
                resources={"gold": 100, "food": 100, "faith": 100},
                tech_level=TechLevel.MANOR,
                capital_hp=0  # Should be eliminated
            ),
            Player(
                id=3,
                name="Player 3",
                color="#0000FF",
                is_connected=True,
                is_eliminated=False,
                resources={"gold": 100, "food": 100, "faith": 100},
                tech_level=TechLevel.MANOR,
                capital_hp=100  # Still alive
            )
        ]
        
        # Check elimination
        eliminated_players, winner = conquest_system.check_elimination(players)
        
        # Player 2 should be eliminated
        assert 2 in eliminated_players
        assert players[1].is_eliminated == True
        
        # No winner yet (2 players remain)
        assert winner is None

    def test_victory_condition(self):
        """Test victory condition when only one player remains."""
        conquest_system = ConquestSystem()
        
        # Create players with only one active
        players = [
            Player(
                id=1,
                name="Winner",
                color="#FF0000",
                is_connected=True,
                is_eliminated=False,
                resources={"gold": 100, "food": 100, "faith": 100},
                tech_level=TechLevel.MANOR,
                capital_hp=100  # Winner
            ),
            Player(
                id=2,
                name="Loser",
                color="#00FF00",
                is_connected=True,
                is_eliminated=False,
                resources={"gold": 100, "food": 100, "faith": 100},
                tech_level=TechLevel.MANOR,
                capital_hp=0  # Should be eliminated
            )
        ]
        
        # Check elimination
        eliminated_players, winner = conquest_system.check_elimination(players)
        
        # Player 2 should be eliminated
        assert 2 in eliminated_players
        assert players[1].is_eliminated == True
        
        # Player 1 should be winner
        assert winner == 1

    def test_siege_building_damage(self):
        """Test siege units deal 2x damage to buildings."""
        # Create siege unit
        siege_unit = Unit.create_unit(UnitType.SIEGE, owner=1, position=Position(x=10, y=10))
        
        # Test building damage
        building_damage = siege_unit.calculate_building_damage()
        expected_damage = siege_unit.attack * 2.0  # 50 * 2 = 100
        
        assert building_damage == expected_damage

    def test_non_siege_building_damage(self):
        """Test non-siege units deal normal damage to buildings."""
        # Create infantry unit
        infantry_unit = Unit.create_unit(UnitType.INFANTRY, owner=1, position=Position(x=10, y=10))
        
        # Test building damage
        building_damage = infantry_unit.calculate_building_damage()
        expected_damage = infantry_unit.attack * 1.0  # 20 * 1 = 20
        
        assert building_damage == expected_damage

    def test_aura_positions_export(self):
        """Test exporting aura positions for client rendering."""
        conquest_system = ConquestSystem()
        
        # Create watchtower tiles
        watchtower1 = Tile(
            id="10,10",
            type=TileType.WATCHTOWER,
            x=10,
            y=10,
            edges=["watchtower", "field", "watchtower", "field"],
            hp=80,
            max_hp=80,
            owner=1,
            resources=Resources(gold=0, food=0, faith=1),
            placed_at=time.time(),
            metadata=TileMetadata(aura_radius=2)
        )
        
        watchtower2 = Tile(
            id="15,15",
            type=TileType.WATCHTOWER,
            x=15,
            y=15,
            edges=["watchtower", "field", "watchtower", "field"],
            hp=80,
            max_hp=80,
            owner=2,
            resources=Resources(gold=0, food=0, faith=1),
            placed_at=time.time(),
            metadata=TileMetadata(aura_radius=3)
        )
        
        # Update auras
        conquest_system.update_auras([watchtower1, watchtower2], {})
        
        # Get aura positions
        aura_positions = conquest_system.get_aura_positions()
        
        # Check aura positions
        assert len(aura_positions) == 2
        
        aura1 = aura_positions[0]
        assert aura1["x"] == 10
        assert aura1["y"] == 10
        assert aura1["radius"] == 2
        assert aura1["owner_id"] == 1
        
        aura2 = aura_positions[1]
        assert aura2["x"] == 15
        assert aura2["y"] == 15
        assert aura2["radius"] == 3
        assert aura2["owner_id"] == 2


if __name__ == "__main__":
    pytest.main([__file__]) 