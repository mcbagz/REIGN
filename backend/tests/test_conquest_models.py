"""
Test conquest-related model extensions.
"""

import pytest
from src.models.tile import Tile, TileType, TileMetadata, Resources
from src.models.game_state import Player, TechLevel, Position
from src.models.unit import Position as UnitPosition


class TestConquestExtensions:
    """Test suite for conquest mechanic model extensions."""

    def test_tile_capturable_field(self):
        """Test that tiles can be created with capturable field."""
        # Test default capturable value
        tile = Tile(
            id="10,10",
            type=TileType.CITY,
            x=10,
            y=10,
            edges=["city", "field", "city", "field"],
            hp=100,
            max_hp=100,
            owner=1,
            resources=Resources(gold=2, food=0, faith=0),
            placed_at=1640995200.0
        )
        assert tile.capturable == False  # Default value

        # Test explicit capturable value
        capturable_tile = Tile(
            id="15,15",
            type=TileType.CITY,
            x=15,
            y=15,
            edges=["city", "field", "city", "field"],
            hp=100,
            max_hp=100,
            owner=1,
            resources=Resources(gold=2, food=0, faith=0),
            placed_at=1640995200.0,
            capturable=True
        )
        assert capturable_tile.capturable == True

    def test_player_capital_hp_field(self):
        """Test that players have capital HP field."""
        # Test default capital HP value
        player = Player(
            id=1,
            name="Test Player",
            color="#FF0000",
            is_connected=True,
            is_eliminated=False,
            resources={"gold": 100, "food": 50, "faith": 25},
            tech_level=TechLevel.MANOR,
            capital_city=Position(x=10, y=10)
        )
        assert player.capital_hp == 100  # Default value

        # Test explicit capital HP value
        wounded_player = Player(
            id=2,
            name="Wounded Player",
            color="#00FF00",
            is_connected=True,
            is_eliminated=False,
            resources={"gold": 100, "food": 50, "faith": 25},
            tech_level=TechLevel.MANOR,
            capital_city=Position(x=20, y=20),
            capital_hp=50
        )
        assert wounded_player.capital_hp == 50

    def test_watchtower_aura_radius_field(self):
        """Test that watchtower tiles can have aura radius metadata."""
        # Test default aura radius
        metadata = TileMetadata()
        assert metadata.aura_radius == 2  # Default value

        # Test explicit aura radius
        custom_metadata = TileMetadata(aura_radius=3)
        assert custom_metadata.aura_radius == 3

        # Test watchtower tile with aura radius
        watchtower = Tile(
            id="5,5",
            type=TileType.WATCHTOWER,
            x=5,
            y=5,
            edges=["watchtower", "field", "watchtower", "field"],
            hp=80,
            max_hp=80,
            owner=1,
            resources=Resources(gold=0, food=0, faith=1),
            placed_at=1640995200.0,
            metadata=TileMetadata(aura_radius=3, defense_bonus=0.5)
        )
        assert watchtower.metadata.aura_radius == 3
        assert watchtower.metadata.defense_bonus == 0.5

    def test_conquest_field_serialization(self):
        """Test that conquest fields serialize correctly."""
        # Test tile with capturable field
        tile = Tile(
            id="10,10",
            type=TileType.CITY,
            x=10,
            y=10,
            edges=["city", "field", "city", "field"],
            hp=100,
            max_hp=100,
            owner=1,
            resources=Resources(gold=2, food=0, faith=0),
            placed_at=1640995200.0,
            capturable=True
        )
        
        tile_dict = tile.model_dump()
        assert tile_dict["capturable"] == True
        assert "capturable" in tile_dict

        # Test player with capital HP
        player = Player(
            id=1,
            name="Test Player",
            color="#FF0000",
            is_connected=True,
            is_eliminated=False,
            resources={"gold": 100, "food": 50, "faith": 25},
            tech_level=TechLevel.MANOR,
            capital_city=Position(x=10, y=10),
            capital_hp=75
        )
        
        player_dict = player.model_dump()
        assert player_dict["capital_hp"] == 75
        assert "capital_hp" in player_dict

        # Test watchtower metadata
        metadata = TileMetadata(aura_radius=4, defense_bonus=0.3)
        metadata_dict = metadata.model_dump()
        assert metadata_dict["aura_radius"] == 4
        assert "aura_radius" in metadata_dict

    def test_conquest_field_validation(self):
        """Test validation of conquest fields."""
        # Test capital HP must be non-negative
        with pytest.raises(ValueError):
            Player(
                id=1,
                name="Test Player",
                color="#FF0000",
                is_connected=True,
                is_eliminated=False,
                resources={"gold": 100, "food": 50, "faith": 25},
                tech_level=TechLevel.MANOR,
                capital_city=Position(x=10, y=10),
                capital_hp=-10  # Invalid negative value
            )

        # Test aura radius must be non-negative
        with pytest.raises(ValueError):
            TileMetadata(aura_radius=-1)  # Invalid negative value

        # Test capturable must be boolean
        # This should work fine since it's a boolean field
        tile = Tile(
            id="10,10",
            type=TileType.CITY,
            x=10,
            y=10,
            edges=["city", "field", "city", "field"],
            hp=100,
            max_hp=100,
            owner=1,
            resources=Resources(gold=2, food=0, faith=0),
            placed_at=1640995200.0,
            capturable=False
        )
        assert tile.capturable == False

if __name__ == "__main__":
    pytest.main([__file__]) 