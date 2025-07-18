"""
Bot player implementation for Carcassonne: War of Ages.
Connects to the game server and makes reasonable gameplay decisions.
"""

import asyncio
import json
import random
import logging
import os
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from enum import Enum
import aiohttp
import websockets

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class GamePhase(Enum):
    EARLY = "early"  # Focus on expansion and resources
    MID = "mid"      # Balance between expansion and military
    LATE = "late"    # Focus on conquest


@dataclass
class BotConfig:
    """Configuration for bot behavior."""
    decision_interval: float = 0.5  # Seconds between decisions
    aggression_level: float = 0.5   # 0 = peaceful, 1 = aggressive
    expansion_priority: float = 0.7  # 0 = military, 1 = expansion
    bot_name: str = "Bot"
    server_url: str = None  # Will be set from environment or default
    
    
class BotPlayer:
    """AI player that makes strategic decisions in the game."""
    
    def __init__(self, config: BotConfig = None):
        self.config = config or BotConfig()
        # Set server URL from environment if not provided
        if not self.config.server_url:
            self.config.server_url = os.environ.get("SERVER_URL", "ws://localhost:8000")
        self.game_state = None
        self.player_id = None
        self.room_id = None
        self.websocket = None
        self.running = False
        self.last_decision_time = 0
        self.game_phase = GamePhase.EARLY
        
        # Strategic memory
        self.my_tiles = set()
        self.enemy_capitals = {}
        self.resource_tiles = []
        self.threats = []
        self.last_summary_time = 0
        
    async def join_game(self, room_id: str = None):
        """Join a game room or request matchmaking."""
        try:
            if room_id:
                # Direct room join
                self.room_id = room_id
                self.player_id = f"bot_{random.randint(1000, 9999)}"
            else:
                # Request matchmaking
                async with aiohttp.ClientSession() as session:
                    self.player_id = f"bot_{self.config.bot_name}_{random.randint(1000, 9999)}"
                    # Extract base URL from WebSocket URL
                    base_url = self.config.server_url.replace("ws://", "http://").replace("wss://", "https://")
                    async with session.post(f"{base_url}/match", 
                                          json={"player_id": self.player_id}) as resp:
                        data = await resp.json()
                        self.room_id = data["room_id"]
                        
            logger.info(f"Bot joining room {self.room_id} as player {self.player_id}")
            
            # Connect WebSocket
            ws_url = f"{self.config.server_url}/ws/{self.room_id}/{self.player_id}"
            self.websocket = await websockets.connect(ws_url)
            self.running = True
            
            # Start message handler and decision loop
            await asyncio.gather(
                self._handle_messages(),
                self._decision_loop(),
                return_exceptions=True
            )
            
        except Exception as e:
            logger.error(f"Failed to join game: {e}")
            raise
            
    async def _handle_messages(self):
        """Handle incoming WebSocket messages."""
        try:
            async for message in self.websocket:
                data = json.loads(message)
                await self._process_message(data)
        except websockets.exceptions.ConnectionClosed:
            logger.info("WebSocket connection closed")
            self.running = False
        except Exception as e:
            logger.error(f"Error handling messages: {e}")
            self.running = False
            
    async def _process_message(self, message: Dict[str, Any]):
        """Process incoming game messages."""
        msg_type = message.get("type")
        
        if msg_type == "player_identity":
            # Server sends player_id (snake_case), not playerId
            self.player_id = message["payload"]["player_id"]
            logger.info(f"Bot identified as player {self.player_id}")
            
        elif msg_type in ["game_state", "state"]:
            self.game_state = message.get("payload", {})
            self._analyze_game_state()
            
        elif msg_type == "tile_offers":
            # Bot's turn to select a tile
            await self._handle_tile_selection(message["payload"])
            
        elif msg_type == "error":
            logger.error(f"Game error: {message.get('payload', {}).get('message')}")
            
    async def _decision_loop(self):
        """Main decision-making loop that runs every 0.5 seconds."""
        await asyncio.sleep(2)  # Wait for initial game state
        
        while self.running and self.websocket and not self.websocket.closed:
            try:
                current_time = asyncio.get_event_loop().time()
                
                if self.game_state and self.game_state.get("status") == "playing":
                    # Make decisions based on game state
                    await self._make_strategic_decision()
                    
                    # Print summary every minute
                    if current_time - self.last_summary_time >= 60:
                        self._print_game_summary()
                        self.last_summary_time = current_time
                    
                # Wait for next decision interval
                await asyncio.sleep(self.config.decision_interval)
                
            except Exception as e:
                logger.error(f"Error in decision loop: {e}")
                
    def _analyze_game_state(self):
        """Analyze current game state and update strategic information."""
        if not self.game_state:
            return
            
        # Update our tiles
        self.my_tiles.clear()
        tiles = self.game_state.get("tiles", [])
        
        # Note: player_id from server is numeric, need to match correctly
        for tile in tiles:
            if tile.get("owner") == self.player_id:
                self.my_tiles.add((tile["x"], tile["y"]))
                
        # Find enemy capitals and resource tiles
        self.enemy_capitals.clear()
        self.resource_tiles.clear()
        
        for tile in tiles:
            if tile["type"] == "capital_city" and tile.get("owner") != self.player_id:
                self.enemy_capitals[tile["owner"]] = tile
            elif tile["type"] in ["mine", "orchard"] and not tile.get("owner"):
                self.resource_tiles.append(tile)
                
        # Determine game phase
        turn_number = self.game_state.get("turn_number", 0)
        if turn_number < 20:
            self.game_phase = GamePhase.EARLY
        elif turn_number < 60:
            self.game_phase = GamePhase.MID
        else:
            self.game_phase = GamePhase.LATE
            
    async def _make_strategic_decision(self):
        """Make a strategic decision based on current game state."""
        if not self.game_state:
            return
            
        # Get our current resources
        my_player = None
        for player in self.game_state.get("players", []):
            if player["id"] == self.player_id:
                my_player = player
                break
                
        if not my_player:
            return
            
        resources = my_player.get("resources", {})
        gold = resources.get("gold", 0)
        food = resources.get("food", 0)
        
        # Priority system based on game phase
        if self.game_phase == GamePhase.EARLY:
            # Early game: Focus on expansion and economy
            await self._early_game_strategy(gold, food)
        elif self.game_phase == GamePhase.MID:
            # Mid game: Balance expansion with military buildup
            await self._mid_game_strategy(gold, food)
        else:
            # Late game: Focus on conquest
            await self._late_game_strategy(gold, food)
            
    async def _early_game_strategy(self, gold: int, food: int):
        """Early game strategy focusing on expansion."""
        # 1. Place tiles from bank if available
        await self._try_place_banked_tile()
        
        # 2. Train basic units for defense
        if gold >= 50 and food >= 20:
            await self._train_unit_at_random_building("infantry")
            
        # 3. Move units to claim resource tiles
        await self._move_units_to_resources()
        
    async def _mid_game_strategy(self, gold: int, food: int):
        """Mid game strategy balancing expansion and military."""
        # 1. Place tiles strategically
        await self._try_place_banked_tile()
        
        # 2. Build varied army
        if random.random() < 0.5 and gold >= 100 and food >= 50:
            await self._train_unit_at_random_building("knight")
        elif gold >= 60 and food >= 30:
            await self._train_unit_at_random_building("archer")
            
        # 3. Start pressuring nearest enemy
        await self._execute_combat_orders()
        
    async def _late_game_strategy(self, gold: int, food: int):
        """Late game strategy focusing on conquest."""
        # 1. Train siege units for capital assault
        if gold >= 200:
            await self._train_unit_at_random_building("siege")
            
        # 2. Coordinate attacks on enemy capitals
        await self._coordinate_capital_assault()
        
        # 3. Defend our capital
        await self._defend_capital()
        
    async def _handle_tile_selection(self, payload: Dict[str, Any]):
        """Handle tile selection when it's our turn."""
        tile_offers = payload.get("tiles", [])
        if not tile_offers:
            return
            
        # Choose tile based on strategy
        chosen_tile = self._choose_best_tile(tile_offers)
        
        if chosen_tile:
            # Send selection with slight delay to feel more human
            await asyncio.sleep(random.uniform(1.0, 3.0))
            await self._send_command("selectTile", {
                "tileIndex": tile_offers.index(chosen_tile)
            })
            
    def _choose_best_tile(self, tiles: List[Dict]) -> Optional[Dict]:
        """Choose the best tile from options based on current strategy."""
        if not tiles:
            return None
            
        # Score each tile option
        tile_scores = []
        for tile in tiles:
            score = 0
            
            # Prefer resource-generating tiles in early game
            if self.game_phase == GamePhase.EARLY:
                if tile["type"] in ["city", "field", "monastery"]:
                    score += 3
                elif tile["type"] in ["mine", "orchard"]:
                    score += 5
                    
            # Prefer military tiles in mid/late game
            elif self.game_phase in [GamePhase.MID, GamePhase.LATE]:
                if tile["type"] == "barracks":
                    score += 4
                elif tile["type"] == "watchtower":
                    score += 3
                    
            # Add some randomness
            score += random.uniform(0, 2)
            tile_scores.append((tile, score))
            
        # Choose tile with highest score
        tile_scores.sort(key=lambda x: x[1], reverse=True)
        return tile_scores[0][0]
        
    async def _try_place_banked_tile(self):
        """Try to place a tile from our bank."""
        if not self.game_state:
            return
            
        # Check if we have tiles in bank (this would need server support)
        # For now, we'll randomly try to place tiles
        if random.random() < 0.3:  # 30% chance to try placing
            # Find a good spot to place tile
            placement_spot = self._find_good_tile_placement()
            if placement_spot:
                await self._send_command("placeTile", {
                    "x": placement_spot[0],
                    "y": placement_spot[1],
                    "tile_type": random.choice(["city", "field", "monastery"])
                })
                
    def _find_good_tile_placement(self) -> Optional[Tuple[int, int]]:
        """Find a good spot to place a new tile."""
        if not self.my_tiles:
            return None
            
        # Look for empty spots adjacent to our tiles
        candidates = []
        for x, y in self.my_tiles:
            for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
                new_x, new_y = x + dx, y + dy
                if (new_x, new_y) not in self.my_tiles:
                    candidates.append((new_x, new_y))
                    
        return random.choice(candidates) if candidates else None
        
    async def _train_unit_at_random_building(self, unit_type: str):
        """Train a unit at a random building that can produce it."""
        if not self.game_state:
            return
            
        # Find our buildings that can train units
        training_buildings = []
        for tile in self.game_state.get("tiles", []):
            if (tile.get("owner") == self.player_id and 
                tile["type"] in ["capital_city", "city", "barracks"]):
                training_buildings.append(tile)
                
        if training_buildings:
            building = random.choice(training_buildings)
            await self._send_command("trainUnit", {
                "unit_type": unit_type,
                "tile_id": building["id"]
            })
            
    async def _move_units_to_resources(self):
        """Move units toward unclaimed resource tiles."""
        if not self.game_state or not self.resource_tiles:
            return
            
        # Get our idle units
        our_units = [u for u in self.game_state.get("units", []) 
                     if u.get("owner") == self.player_id and u.get("status") == "idle"]
                     
        if our_units and self.resource_tiles:
            unit = random.choice(our_units)
            unit_pos = unit.get("position", {})
            unit_x = unit_pos.get("x", 0)
            unit_y = unit_pos.get("y", 0)
            
            # Find resource tiles within reasonable distance (max 10)
            nearby_resources = []
            for resource in self.resource_tiles:
                dist = abs(resource["x"] - unit_x) + abs(resource["y"] - unit_y)
                if dist <= 10:
                    nearby_resources.append((resource, dist))
            
            if nearby_resources:
                # Sort by distance and pick closest
                nearby_resources.sort(key=lambda x: x[1])
                target = nearby_resources[0][0]
                
                await self._send_command("moveUnit", {
                    "unit_id": unit["id"],
                    "target_x": target["x"],
                    "target_y": target["y"]
                })
            
    async def _execute_combat_orders(self):
        """Execute combat orders based on current threats and opportunities."""
        if not self.game_state:
            return
            
        # Simple combat: Move some units toward nearest enemy
        our_units = [u for u in self.game_state.get("units", []) 
                     if u.get("owner") == self.player_id and u.get("status") == "idle"]
                     
        if our_units and self.enemy_capitals:
            # Pick a random unit
            unit = random.choice(our_units)
            unit_pos = unit.get("position", {})
            unit_x = unit_pos.get("x", 0)
            unit_y = unit_pos.get("y", 0)
            
            # Find closest enemy capital
            closest_capital = None
            min_dist = float('inf')
            
            for capital in self.enemy_capitals.values():
                dist = abs(capital["x"] - unit_x) + abs(capital["y"] - unit_y)
                if dist < min_dist:
                    min_dist = dist
                    closest_capital = capital
            
            if closest_capital:
                # Move toward enemy capital, but respect max distance
                target_x = closest_capital["x"]
                target_y = closest_capital["y"]
                
                # If too far, move in the general direction (max 10 tiles)
                if min_dist > 10:
                    # Calculate direction and move max 10 tiles toward target
                    dx = target_x - unit_x
                    dy = target_y - unit_y
                    
                    # Normalize to max movement
                    if abs(dx) + abs(dy) > 10:
                        scale = 10.0 / (abs(dx) + abs(dy))
                        dx = int(dx * scale)
                        dy = int(dy * scale)
                    
                    target_x = unit_x + dx
                    target_y = unit_y + dy
                
                await self._send_command("moveUnit", {
                    "unit_id": unit["id"],
                    "target_x": target_x,
                    "target_y": target_y
                })
            
    async def _coordinate_capital_assault(self):
        """Coordinate an assault on enemy capital."""
        # This would involve grouping units and attacking together
        # For now, just move units toward enemy capitals
        await self._execute_combat_orders()
        
    async def _defend_capital(self):
        """Defend our capital from threats."""
        # Find our capital
        our_capital = None
        for tile in self.game_state.get("tiles", []):
            if (tile.get("owner") == self.player_id and 
                tile["type"] == "capital_city"):
                our_capital = tile
                break
                
        if not our_capital:
            return
            
        # Check for nearby enemy units
        enemy_units_nearby = []
        for unit in self.game_state.get("units", []):
            if unit.get("owner") != self.player_id:
                # Simple distance check
                unit_pos = unit.get("position", {})
                dx = abs(unit_pos.get("x", 0) - our_capital["x"])
                dy = abs(unit_pos.get("y", 0) - our_capital["y"])
                if dx + dy <= 5:  # Manhattan distance
                    enemy_units_nearby.append(unit)
                    
        # If threats detected, move our units to defend
        if enemy_units_nearby:
            our_units = [u for u in self.game_state.get("units", []) 
                         if u.get("owner") == self.player_id and u.get("status") == "idle"]
            
            for unit in our_units[:2]:  # Move up to 2 units to defend
                unit_pos = unit.get("position", {})
                unit_x = unit_pos.get("x", 0)
                unit_y = unit_pos.get("y", 0)
                
                # Calculate distance to capital
                dist = abs(unit_x - our_capital["x"]) + abs(unit_y - our_capital["y"])
                
                # If within movement range, move directly to capital
                if dist <= 10:
                    await self._send_command("moveUnit", {
                        "unit_id": unit["id"],
                        "target_x": our_capital["x"],
                        "target_y": our_capital["y"]
                    })
                else:
                    # Move toward capital
                    dx = our_capital["x"] - unit_x
                    dy = our_capital["y"] - unit_y
                    
                    # Normalize to max movement
                    if abs(dx) + abs(dy) > 10:
                        scale = 10.0 / (abs(dx) + abs(dy))
                        dx = int(dx * scale)
                        dy = int(dy * scale)
                    
                    await self._send_command("moveUnit", {
                        "unit_id": unit["id"],
                        "target_x": unit_x + dx,
                        "target_y": unit_y + dy
                    })
                
    async def _send_command(self, action: str, data: Dict[str, Any]):
        """Send a command to the game server."""
        if not self.websocket or self.websocket.closed:
            return
            
        message = {
            "type": "cmd",
            "payload": {
                "action": action,
                "data": data
            }
        }
        
        try:
            await self.websocket.send(json.dumps(message))
            logger.info(f"Bot sent command: {action} with data: {data}")
        except Exception as e:
            logger.error(f"Failed to send command: {e}")
            
    def _print_game_summary(self):
        """Print a summary of the current game state."""
        if not self.game_state:
            return
            
        print(f"\n{'='*60}")
        print(f"GAME SUMMARY - Turn {self.game_state.get('turn_number', 0)}")
        print(f"{'='*60}")
        
        # Player summaries
        players = self.game_state.get("players", [])
        tiles = self.game_state.get("tiles", [])
        units = self.game_state.get("units", [])
        
        for player in players:
            player_id = player.get("id")
            player_name = player.get("name", f"Player {player_id}")
            resources = player.get("resources", {})
            
            # Count player's tiles
            player_tiles = [t for t in tiles if t.get("owner") == player_id]
            tile_types = {}
            for tile in player_tiles:
                tile_type = tile.get("type", "unknown")
                tile_types[tile_type] = tile_types.get(tile_type, 0) + 1
            
            # Count player's units
            player_units = [u for u in units if u.get("owner") == player_id]
            unit_types = {}
            for unit in player_units:
                unit_type = unit.get("type", "unknown")
                unit_types[unit_type] = unit_types.get(unit_type, 0) + 1
            
            # Print player summary
            print(f"\n{player_name} (ID: {player_id}):")
            print(f"  Capital HP: {player.get('capital_hp', 0)}")
            print(f"  Resources: Gold={resources.get('gold', 0)}, "
                  f"Food={resources.get('food', 0)}, "
                  f"Faith={resources.get('faith', 0)}")
            print(f"  Tiles ({len(player_tiles)}): {dict(tile_types)}")
            print(f"  Units ({len(player_units)}): {dict(unit_types)}")
            
            if player.get("is_eliminated"):
                print(f"  Status: ELIMINATED")
        
        print(f"\n{'='*60}\n")
        
    async def disconnect(self):
        """Disconnect from the game."""
        self.running = False
        if self.websocket:
            await self.websocket.close()
            

async def run_bot(room_id: str = None, config: BotConfig = None):
    """Run a bot instance."""
    bot = BotPlayer(config)
    try:
        await bot.join_game(room_id)
    except KeyboardInterrupt:
        logger.info("Bot shutting down...")
        await bot.disconnect()
    except Exception as e:
        logger.error(f"Bot error: {e}")
        await bot.disconnect()


if __name__ == "__main__":
    # Run bot with default configuration
    asyncio.run(run_bot())