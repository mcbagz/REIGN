"""
Bot manager for server-side integration.
This module can be imported by the game server to spawn bot players.
"""

import asyncio
import multiprocessing
import subprocess
import sys
import os
from typing import List, Dict, Optional
from pathlib import Path

# Add bot directory to Python path
bot_dir = Path(__file__).parent
sys.path.insert(0, str(bot_dir))

from bot_player import BotPlayer, BotConfig


class BotManager:
    """Manages bot players for the game server."""
    
    def __init__(self):
        self.active_bots: Dict[str, asyncio.Task] = {}
        self.bot_processes: Dict[str, subprocess.Popen] = {}
        
    async def spawn_bot_async(self, room_id: str, difficulty: str = "normal") -> bool:
        """Spawn a bot asynchronously in the same process (for server integration)."""
        try:
            # Check if bot already exists for this room
            if room_id in self.active_bots:
                return True
                
            # Create bot configuration
            config = self._create_bot_config(difficulty)
            
            # Create and start bot task
            bot = BotPlayer(config)
            task = asyncio.create_task(self._run_bot(bot, room_id))
            self.active_bots[room_id] = task
            
            return True
            
        except Exception as e:
            print(f"Failed to spawn bot for room {room_id}: {e}")
            return False
            
    def spawn_bot_subprocess(self, room_id: str, difficulty: str = "normal") -> bool:
        """Spawn a bot in a separate subprocess."""
        try:
            # Check if bot already exists
            if room_id in self.bot_processes:
                return True
                
            # Launch bot subprocess
            bot_script = Path(__file__).parent / "bot_launcher.py"
            process = subprocess.Popen(
                [sys.executable, str(bot_script), room_id, difficulty],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            self.bot_processes[room_id] = process
            return True
            
        except Exception as e:
            print(f"Failed to spawn bot subprocess for room {room_id}: {e}")
            return False
            
    async def _run_bot(self, bot: BotPlayer, room_id: str):
        """Run a bot instance."""
        try:
            await bot.join_game(room_id)
        except Exception as e:
            print(f"Bot error in room {room_id}: {e}")
        finally:
            await bot.disconnect()
            # Clean up from active bots
            if room_id in self.active_bots:
                del self.active_bots[room_id]
                
    def _create_bot_config(self, difficulty: str) -> BotConfig:
        """Create bot configuration based on difficulty."""
        import random
        
        configs = {
            "easy": BotConfig(
                aggression_level=0.3,
                expansion_priority=0.8,
                decision_interval=0.8,
                bot_name=f"EasyBot_{random.randint(100, 999)}"
            ),
            "normal": BotConfig(
                aggression_level=0.5,
                expansion_priority=0.6,
                decision_interval=0.5,
                bot_name=f"Bot_{random.randint(100, 999)}"
            ),
            "hard": BotConfig(
                aggression_level=0.7,
                expansion_priority=0.4,
                decision_interval=0.3,
                bot_name=f"HardBot_{random.randint(100, 999)}"
            )
        }
        
        return configs.get(difficulty, configs["normal"])
        
    async def stop_bot(self, room_id: str):
        """Stop a bot for a specific room."""
        # Stop async bot
        if room_id in self.active_bots:
            self.active_bots[room_id].cancel()
            del self.active_bots[room_id]
            
        # Stop subprocess bot
        if room_id in self.bot_processes:
            process = self.bot_processes[room_id]
            process.terminate()
            process.wait(timeout=5)
            del self.bot_processes[room_id]
            
    async def stop_all_bots(self):
        """Stop all active bots."""
        # Cancel all async tasks
        for task in self.active_bots.values():
            task.cancel()
        self.active_bots.clear()
        
        # Terminate all subprocesses
        for process in self.bot_processes.values():
            process.terminate()
        for process in self.bot_processes.values():
            process.wait(timeout=5)
        self.bot_processes.clear()
        
    def fill_room_with_bots(self, room_id: str, target_players: int = 4, 
                           current_players: int = 1, difficulty: str = "normal") -> int:
        """Fill a room with bots to reach target player count."""
        bots_needed = target_players - current_players
        bots_spawned = 0
        
        for i in range(bots_needed):
            if self.spawn_bot_subprocess(room_id, difficulty):
                bots_spawned += 1
                
        return bots_spawned


# Global bot manager instance
bot_manager = BotManager()


# Convenience functions for server integration
async def spawn_bot_for_room(room_id: str, difficulty: str = "normal") -> bool:
    """Spawn a single bot for a room."""
    return await bot_manager.spawn_bot_async(room_id, difficulty)


def fill_room_with_bots(room_id: str, target_players: int = 4, 
                        current_players: int = 1, difficulty: str = "normal") -> int:
    """Fill a room with bots to reach target player count."""
    return bot_manager.fill_room_with_bots(room_id, target_players, current_players, difficulty)