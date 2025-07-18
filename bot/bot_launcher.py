"""
Bot launcher that can be called by the game server to spawn bot players.
"""

import asyncio
import sys
import random
import os
from bot_player import BotPlayer, BotConfig


def create_bot_config(difficulty: str = "normal") -> BotConfig:
    """Create bot configuration based on difficulty level."""
    # Check for bot name in environment
    bot_name_base = os.environ.get("BOT_NAME", None)
    
    configs = {
        "easy": BotConfig(
            aggression_level=0.3,
            expansion_priority=0.8,
            decision_interval=0.8,
            bot_name=bot_name_base or f"EasyBot_{random.randint(100, 999)}"
        ),
        "normal": BotConfig(
            aggression_level=0.5,
            expansion_priority=0.6,
            decision_interval=0.5,
            bot_name=bot_name_base or f"Bot_{random.randint(100, 999)}"
        ),
        "hard": BotConfig(
            aggression_level=0.7,
            expansion_priority=0.4,
            decision_interval=0.3,
            bot_name=bot_name_base or f"HardBot_{random.randint(100, 999)}"
        )
    }
    
    return configs.get(difficulty, configs["normal"])


async def launch_bot(room_id: str, difficulty: str = "normal"):
    """Launch a single bot for a specific room."""
    config = create_bot_config(difficulty)
    bot = BotPlayer(config)
    
    try:
        await bot.join_game(room_id)
    except Exception as e:
        print(f"Bot failed to join room {room_id}: {e}")
        await bot.disconnect()


def launch_bot_sync(room_id: str, difficulty: str = "normal"):
    """Synchronous wrapper for launching a bot (for server integration)."""
    # Create a new event loop for this bot
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        # Run the bot until completion or interruption
        loop.run_until_complete(launch_bot(room_id, difficulty))
    except KeyboardInterrupt:
        print(f"Bot interrupted")
    except Exception as e:
        print(f"Bot error: {e}")
    finally:
        # Clean up pending tasks
        pending = asyncio.all_tasks(loop)
        for task in pending:
            task.cancel()
        
        # Wait for tasks to complete cancellation
        if pending:
            loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
        
        loop.close()


if __name__ == "__main__":
    # Command line usage: python bot_launcher.py <room_id> [difficulty]
    if len(sys.argv) < 2:
        print("Usage: python bot_launcher.py <room_id> [difficulty]")
        print("Difficulty options: easy, normal, hard")
        sys.exit(1)
        
    room_id = sys.argv[1]
    difficulty = sys.argv[2] if len(sys.argv) > 2 else "normal"
    
    # Don't print if running as subprocess to avoid duplicate output
    if os.environ.get("BOT_NAME"):
        launch_bot_sync(room_id, difficulty)
    else:
        print(f"Launching {difficulty} bot for room {room_id}")
        launch_bot_sync(room_id, difficulty)