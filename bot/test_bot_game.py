"""
Test script to run a game with 4 bots.
Starts server on port 8888, creates a room, spawns 4 bots, and runs for 5 minutes.
"""

import asyncio
import subprocess
import sys
import time
import signal
import os
from pathlib import Path
import aiohttp
import json

# Configuration
SERVER_PORT = 8888
SERVER_URL = f"http://localhost:{SERVER_PORT}"
WS_URL = f"ws://localhost:{SERVER_PORT}"
GAME_DURATION = 300  # 5 minutes in seconds


async def wait_for_server(timeout=30):
    """Wait for the server to be ready."""
    print(f"Waiting for server to start on port {SERVER_PORT}...")
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{SERVER_URL}/health") as resp:
                    if resp.status == 200:
                        print("Server is ready!")
                        return True
        except:
            pass
        await asyncio.sleep(0.5)
    
    return False


async def create_room_with_bots():
    """Create a game room and spawn 4 bots."""
    print("\nCreating game room with 4 bots...")
    
    # Import bot manager
    bot_dir = Path(__file__).parent
    sys.path.insert(0, str(bot_dir))
    from bot_player import BotPlayer, BotConfig
    
    # Create a room by having first bot request matchmaking
    room_id = None
    bot_tasks = []
    
    try:
        # Create 4 bots with different difficulty levels
        difficulties = ["easy", "normal", "normal", "hard"]
        bot_names = ["AliceBot", "BobBot", "CharlieBot", "DeltaBot"]
        
        for i, (difficulty, name) in enumerate(zip(difficulties, bot_names)):
            print(f"Spawning {name} ({difficulty} difficulty)...")
            
            # Configure bot
            config = BotConfig(
                bot_name=name,
                server_url=WS_URL,
                decision_interval=0.5 if difficulty == "normal" else (0.8 if difficulty == "easy" else 0.3),
                aggression_level=0.3 if difficulty == "easy" else (0.5 if difficulty == "normal" else 0.7),
                expansion_priority=0.8 if difficulty == "easy" else (0.6 if difficulty == "normal" else 0.4)
            )
            
            # Create bot
            bot = BotPlayer(config)
            
            # First bot creates the room via matchmaking
            if i == 0:
                # Request matchmaking
                async with aiohttp.ClientSession() as session:
                    async with session.post(f"{SERVER_URL}/match", 
                                          json={"player_name": name}) as resp:
                        data = await resp.json()
                        room_id = data["room_id"]
                        bot.room_id = room_id
                        bot.player_id = data["player_id"]
                        print(f"Created room: {room_id}")
            else:
                # Other bots join the same room
                async with aiohttp.ClientSession() as session:
                    async with session.post(f"{SERVER_URL}/match", 
                                          json={"player_name": name, "room_id": room_id}) as resp:
                        data = await resp.json()
                        bot.room_id = room_id
                        bot.player_id = data["player_id"]
            
            # Connect bot via WebSocket
            ws_url = f"{WS_URL}/ws/{bot.room_id}/{bot.player_id}"
            bot.websocket = await bot._connect_websocket(ws_url)
            bot.running = True
            
            # Start bot tasks
            message_task = asyncio.create_task(bot._handle_messages())
            decision_task = asyncio.create_task(bot._decision_loop())
            bot_tasks.extend([message_task, decision_task])
            
            # Small delay between bot connections
            await asyncio.sleep(0.5)
        
        print(f"\nAll 4 bots connected to room {room_id}")
        print("Game is now running! Watch the bots play...\n")
        
        # Monitor game for the specified duration
        start_time = time.time()
        while time.time() - start_time < GAME_DURATION:
            remaining = GAME_DURATION - (time.time() - start_time)
            print(f"\rGame time remaining: {int(remaining)}s ", end="", flush=True)
            await asyncio.sleep(1)
        
        print("\n\nGame time complete! Shutting down...")
        
    except Exception as e:
        print(f"Error creating room with bots: {e}")
        
    finally:
        # Cancel all bot tasks
        for task in bot_tasks:
            task.cancel()
        
        # Wait for tasks to complete
        await asyncio.gather(*bot_tasks, return_exceptions=True)


async def main():
    """Main test function."""
    # Start server in subprocess
    print(f"Starting game server on port {SERVER_PORT}...")
    
    backend_dir = Path(__file__).parent.parent / "backend"
    server_env = os.environ.copy()
    server_env["PORT"] = str(SERVER_PORT)
    
    server_process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "src.main:app", 
         "--host", "0.0.0.0", 
         "--port", str(SERVER_PORT),
         "--log-level", "info"],
        cwd=backend_dir,
        env=server_env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    
    # Create a task to read server output
    async def read_server_output():
        for line in iter(server_process.stdout.readline, ''):
            if line:
                print(f"[SERVER] {line.strip()}")
    
    output_task = asyncio.create_task(read_server_output())
    
    try:
        # Wait for server to start
        if not await wait_for_server():
            print("Server failed to start!")
            return
        
        # Create room and run bots
        await create_room_with_bots()
        
    finally:
        print("\nShutting down server...")
        server_process.terminate()
        
        # Give it time to shut down gracefully
        try:
            server_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server_process.kill()
            server_process.wait()
        
        output_task.cancel()
        
        print("Test complete!")


# Bot helper method that was missing
async def _connect_websocket(self, ws_url):
    """Helper method to connect websocket."""
    import websockets
    return await websockets.connect(ws_url)

# Monkey patch the method
BotPlayer._connect_websocket = _connect_websocket


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nTest interrupted by user")
    except Exception as e:
        print(f"Test error: {e}")
        import traceback
        traceback.print_exc()