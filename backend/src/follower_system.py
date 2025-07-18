"""
Follower system for managing followers in Carcassonne: War of Ages.
"""

import time
import uuid
from typing import Optional, List, Dict
from .models.follower import Follower, FollowerType
from .models.tile import Tile, TileType
from .models.game_state import GameState

RECALL_DURATION = 10.0  # 10 seconds to recall a follower

class FollowerSystem:
    """Manages follower placement, recall, and resource generation."""
    
    @staticmethod
    def can_place_follower(game_state: GameState, player_id: int, tile: Tile, follower_type: FollowerType) -> tuple[bool, str]:
        """Check if a follower can be placed on a tile."""
        player = next((p for p in game_state.players if p.id == player_id), None)
        if not player:
            return False, "Player not found"
            
        if player.followers_available <= 0:
            return False, "No followers available"
            
        if tile.follower_id is not None:
            return False, "Tile already has a follower"
            
        if tile.owner != player_id:
            return False, "You don't own this tile"
            
        # Check follower type compatibility with tile type
        valid_combinations = {
            FollowerType.MAGISTRATE: [TileType.CAPITAL_CITY, TileType.CITY],
            FollowerType.FARMER: [TileType.FIELD],
            FollowerType.MONK: [TileType.MONASTERY],
            FollowerType.SCOUT: [t for t in TileType]  # Scout can claim any tile
        }
        
        if tile.type not in valid_combinations.get(follower_type, []):
            return False, f"{follower_type.value} cannot be placed on {tile.type.value} tiles"
            
        return True, "OK"
    
    @staticmethod
    def place_follower(game_state: GameState, player_id: int, tile_id: str, follower_type: FollowerType) -> Optional[Follower]:
        """Place a follower on a tile."""
        tile = next((t for t in game_state.tiles if t.id == tile_id), None)
        if not tile:
            return None
            
        can_place, _ = FollowerSystem.can_place_follower(game_state, player_id, tile, follower_type)
        if not can_place:
            return None
            
        # Create follower
        follower = Follower(
            id=f"follower_{uuid.uuid4().hex[:8]}",
            player_id=str(player_id),
            type=follower_type,
            tile_id=tile_id
        )
        
        # Update game state
        game_state.followers.append(follower)
        tile.follower_id = follower.id
        
        # Update player's available followers
        player = next(p for p in game_state.players if p.id == player_id)
        player.followers_available -= 1
        
        return follower
    
    @staticmethod
    def start_recall(game_state: GameState, player_id: int, follower_id: str) -> bool:
        """Start recalling a follower."""
        follower = next((f for f in game_state.followers if f.id == follower_id), None)
        if not follower or follower.player_id != str(player_id):
            return False
            
        if follower.is_recalling:
            return False  # Already recalling
            
        follower.is_recalling = True
        follower.recall_started_at = time.time()
        
        return True
    
    @staticmethod
    def complete_recalls(game_state: GameState) -> List[Follower]:
        """Complete any recalls that have finished."""
        completed = []
        current_time = time.time()
        
        for follower in game_state.followers:
            if follower.is_recalling and follower.recall_started_at:
                if current_time - follower.recall_started_at >= RECALL_DURATION:
                    # Remove follower from tile
                    if follower.tile_id:
                        tile = next((t for t in game_state.tiles if t.id == follower.tile_id), None)
                        if tile:
                            tile.follower_id = None
                    
                    # Return follower to player's pool
                    player = next((p for p in game_state.players if p.id == int(follower.player_id)), None)
                    if player:
                        player.followers_available = min(8, player.followers_available + 1)
                    
                    # Remove follower from game
                    game_state.followers.remove(follower)
                    completed.append(follower)
        
        return completed
    
    @staticmethod
    def calculate_resource_generation(game_state: GameState) -> Dict[int, Dict[str, int]]:
        """Calculate resource generation rates for all players."""
        generation_rates = {}
        
        for player in game_state.players:
            if player.is_eliminated:
                continue
                
            rates = {"gold": 0, "food": 0, "faith": 0}
            
            # Get all tiles owned by this player with followers
            player_tiles = [t for t in game_state.tiles if t.owner == player.id and t.follower_id]
            
            # Group connected tiles by type
            connected_groups = FollowerSystem._find_connected_tile_groups(game_state, player.id)
            
            for group in connected_groups:
                # Only need one follower per connected group
                has_follower = any(t.follower_id for t in group)
                if has_follower:
                    tile_type = group[0].type
                    group_size = len(group)
                    
                    # Calculate base generation
                    if tile_type in [TileType.CAPITAL_CITY, TileType.CITY]:
                        # Check if any follower is a magistrate
                        magistrate_present = any(
                            f for f in game_state.followers 
                            if f.tile_id in [t.id for t in group] and f.type == FollowerType.MAGISTRATE
                        )
                        if magistrate_present:
                            rates["gold"] += group_size  # 1 gold per connected city tile
                            
                    elif tile_type == TileType.FIELD:
                        # Check if any follower is a farmer
                        farmer_present = any(
                            f for f in game_state.followers 
                            if f.tile_id in [t.id for t in group] and f.type == FollowerType.FARMER
                        )
                        if farmer_present:
                            rates["food"] += group_size  # 1 food per connected field tile
                            
                    elif tile_type == TileType.MONASTERY:
                        # Check if any follower is a monk
                        monk_present = any(
                            f for f in game_state.followers 
                            if f.tile_id in [t.id for t in group] and f.type == FollowerType.MONK
                        )
                        if monk_present:
                            rates["faith"] += group_size  # 1 faith per connected monastery tile
            
            # Add special resource tiles (mines and orchards) - no follower needed
            for tile in game_state.tiles:
                if tile.owner == player.id:
                    if tile.type == TileType.MINE:
                        rates["gold"] += 2  # 2 gold per mine
                    elif tile.type == TileType.ORCHARD:
                        rates["food"] += 2  # 2 food per orchard
            
            generation_rates[player.id] = rates
        
        return generation_rates
    
    @staticmethod
    def _find_connected_tile_groups(game_state: GameState, player_id: int) -> List[List[Tile]]:
        """Find groups of connected tiles of the same type owned by a player."""
        player_tiles = [t for t in game_state.tiles if t.owner == player_id]
        visited = set()
        groups = []
        
        for tile in player_tiles:
            if tile.id in visited:
                continue
                
            # Start a new group
            group = []
            tile_type = tile.type
            stack = [tile]
            
            while stack:
                current = stack.pop()
                if current.id in visited:
                    continue
                    
                visited.add(current.id)
                group.append(current)
                
                # Check adjacent tiles
                for dx, dy in [(0, 1), (1, 0), (0, -1), (-1, 0)]:
                    nx, ny = current.x + dx, current.y + dy
                    adj_tile = next((t for t in player_tiles if t.x == nx and t.y == ny), None)
                    
                    if adj_tile and adj_tile.id not in visited and adj_tile.type == tile_type:
                        stack.append(adj_tile)
            
            if group:
                groups.append(group)
        
        return groups