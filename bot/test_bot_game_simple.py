"""
Simpler test script that uses subprocess bots.
Starts server on port 8888, creates a room, spawns 4 bot subprocesses, and runs for 5 minutes.
"""

import asyncio
import subprocess
import sys
import time
import os
from pathlib import Path
import aiohttp
import requests


# Configuration
SERVER_PORT = 8765  # Changed to avoid conflict
SERVER_URL = f"http://localhost:{SERVER_PORT}"
GAME_DURATION = 300  # 5 minutes in seconds


def wait_for_server_sync(timeout=30):
    """Wait for the server to be ready (synchronous version)."""
    print(f"Waiting for server to start on port {SERVER_PORT}...")
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        try:
            resp = requests.get(f"{SERVER_URL}/health", timeout=1)
            if resp.status_code == 200:
                print("Server is ready!")
                return True
        except:
            pass
        time.sleep(0.5)
    
    return False


def create_room():
    """Create a game room via the API."""
    print("\nCreating game room...")
    
    try:
        # First player creates the room
        player_id = f"player_{int(time.time() * 1000)}"
        resp = requests.post(f"{SERVER_URL}/match", json={"player_id": player_id})
        resp.raise_for_status()  # Raise exception for bad status codes
        
        data = resp.json()
        print(f"Match response: {data}")
        
        # The match endpoint returns room_id
        if "room_id" in data:
            room_id = data["room_id"]
        else:
            # If no room_id, might be a different response format
            print(f"Unexpected response format: {data}")
            raise ValueError("No room_id in response")
        
        print(f"Created room: {room_id}")
        return room_id
        
    except requests.exceptions.RequestException as e:
        print(f"Failed to create room: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response: {e.response.text}")
        raise


def spawn_bot_subprocess(room_id, bot_name, difficulty):
    """Spawn a bot as a subprocess."""
    bot_script = Path(__file__).parent / "bot_launcher.py"
    
    # Override bot name in environment
    env = os.environ.copy()
    env["BOT_NAME"] = bot_name
    # Also set the server URL for the bot
    env["SERVER_URL"] = f"ws://localhost:{SERVER_PORT}"
    
    print(f"Spawning {bot_name} ({difficulty} difficulty)...")
    
    process = subprocess.Popen(
        [sys.executable, str(bot_script), room_id, difficulty],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        env=env,
        bufsize=1
    )
    
    return process


def main():
    """Main test function."""
    server_process = None
    bot_processes = []
    
    try:
        # Start server
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
        
        # Start thread to read server output
        import threading
        def read_output(process, prefix):
            for line in iter(process.stdout.readline, ''):
                if line:
                    print(f"[{prefix}] {line.strip()}")
        
        server_thread = threading.Thread(target=read_output, args=(server_process, "SERVER"))
        server_thread.daemon = True
        server_thread.start()
        
        # Wait for server
        if not wait_for_server_sync():
            print("Server failed to start!")
            return
        
        # Create room
        room_id = create_room()
        
        # Spawn 4 bots
        bot_configs = [
            ("AliceBot", "easy"),
            ("BobBot", "normal"),
            ("CharlieBot", "normal"),
            ("DeltaBot", "hard")
        ]
        
        for bot_name, difficulty in bot_configs:
            process = spawn_bot_subprocess(room_id, bot_name, difficulty)
            bot_processes.append(process)
            
            # Start thread to read bot output
            bot_thread = threading.Thread(target=read_output, args=(process, bot_name))
            bot_thread.daemon = True
            bot_thread.start()
            
            time.sleep(1)  # Small delay between bots
        
        print(f"\nAll 4 bots spawned for room {room_id}")
        print("Game is now running! Watch the bots play...")
        print("(Check server output to see game actions)\n")
        
        # Run for specified duration
        start_time = time.time()
        while time.time() - start_time < GAME_DURATION:
            remaining = GAME_DURATION - (time.time() - start_time)
            print(f"\rGame time remaining: {int(remaining)}s ", end="", flush=True)
            
            # Check if any processes died
            for i, proc in enumerate(bot_processes):
                if proc.poll() is not None:
                    print(f"\nWarning: Bot {i+1} process died with code {proc.returncode}")
                    
            time.sleep(1)
        
        print("\n\nGame time complete! Shutting down...")
        
    except KeyboardInterrupt:
        print("\nTest interrupted by user")
        
    finally:
        # Clean up bots
        print("\nStopping bot processes...")
        for proc in bot_processes:
            if proc.poll() is None:
                proc.terminate()
                
        for proc in bot_processes:
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
        
        # Clean up server
        if server_process:
            print("Stopping server...")
            server_process.terminate()
            
            try:
                server_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server_process.kill()
                server_process.wait()
        
        print("Test complete!")


if __name__ == "__main__":
    # Check if requests is installed
    try:
        import requests
    except ImportError:
        print("Please install requests: pip install requests")
        sys.exit(1)
        
    main()