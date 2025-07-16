"""
Load testing script for Carcassonne: War of Ages backend server.
Tests performance under the required load: 4 players, 200 commands/s.
"""
import asyncio
import websockets
import orjson
import time
import random
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
import psutil
import threading
import statistics
import requests
from dataclasses import dataclass
from typing import List, Dict, Any

@dataclass
class PerformanceMetrics:
    """Performance metrics collection."""
    cpu_usage: List[float]
    memory_usage: List[float]
    response_times: List[float]
    errors: List[str]
    successful_commands: int
    failed_commands: int
    start_time: float
    end_time: float
    total_messages: int

class LoadTester:
    """Load testing class for the backend server."""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.ws_url = base_url.replace("http://", "ws://")
        self.metrics = PerformanceMetrics(
            cpu_usage=[],
            memory_usage=[],
            response_times=[],
            errors=[],
            successful_commands=0,
            failed_commands=0,
            start_time=0,
            end_time=0,
            total_messages=0
        )
        self.running = False
        self.process = psutil.Process()
        
    def monitor_system_resources(self):
        """Monitor system resources during the test."""
        while self.running:
            try:
                cpu_percent = self.process.cpu_percent()
                memory_info = self.process.memory_info()
                memory_mb = memory_info.rss / 1024 / 1024
                
                self.metrics.cpu_usage.append(cpu_percent)
                self.metrics.memory_usage.append(memory_mb)
                
                time.sleep(0.1)  # Check every 100ms
            except Exception as e:
                self.metrics.errors.append(f"Resource monitoring error: {e}")
    
    async def create_player_connection(self, player_id: str, room_id: str):
        """Create a WebSocket connection for a player."""
        try:
            uri = f"{self.ws_url}/ws/{room_id}/{player_id}"
            websocket = await websockets.connect(uri)
            return websocket
        except Exception as e:
            self.metrics.errors.append(f"Connection error for {player_id}: {e}")
            return None
    
    def generate_random_commands(self, player_id: str, num_commands: int = 50):
        """Generate random game commands for testing."""
        commands = []
        
        for i in range(num_commands):
            command_type = random.choice(["placeTile", "moveUnit", "trainUnit", "placeWorker"])
            
            if command_type == "placeTile":
                command = {
                    "type": "cmd",
                    "payload": {
                        "action": "placeTile",
                        "data": {
                            "x": random.randint(15, 25),
                            "y": random.randint(15, 25),
                            "tile_type": random.choice(["city", "field", "monastery", "barracks"])
                        }
                    }
                }
            elif command_type == "moveUnit":
                command = {
                    "type": "cmd",
                    "payload": {
                        "action": "moveUnit",
                        "data": {
                            "unit_id": f"unit_{random.randint(1, 100)}",
                            "target_x": random.randint(15, 25),
                            "target_y": random.randint(15, 25)
                        }
                    }
                }
            elif command_type == "trainUnit":
                command = {
                    "type": "cmd",
                    "payload": {
                        "action": "trainUnit",
                        "data": {
                            "unit_type": random.choice(["infantry", "archer", "knight", "siege"]),
                            "tile_id": f"{random.randint(15, 25)},{random.randint(15, 25)}"
                        }
                    }
                }
            else:  # placeWorker
                command = {
                    "type": "cmd",
                    "payload": {
                        "action": "placeWorker",
                        "data": {
                            "worker_type": random.choice(["magistrate", "farmer", "monk", "scout"]),
                            "tile_id": f"{random.randint(15, 25)},{random.randint(15, 25)}"
                        }
                    }
                }
            
            commands.append(command)
        
        return commands
    
    async def run_player_session(self, player_id: str, room_id: str, commands_per_second: int, duration: int):
        """Run a player session with specified command rate."""
        websocket = await self.create_player_connection(player_id, room_id)
        if not websocket:
            return
        
        commands = self.generate_random_commands(player_id, commands_per_second * duration)
        command_interval = 1.0 / commands_per_second
        
        try:
            for i, command in enumerate(commands):
                if not self.running:
                    break
                
                start_time = time.time()
                
                # Send command
                await websocket.send(orjson.dumps(command).decode())
                self.metrics.total_messages += 1
                
                # Wait for response (optional)
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                    response_time = time.time() - start_time
                    self.metrics.response_times.append(response_time)
                    self.metrics.successful_commands += 1
                except asyncio.TimeoutError:
                    self.metrics.response_times.append(1.0)
                    self.metrics.failed_commands += 1
                except Exception as e:
                    self.metrics.errors.append(f"Command error for {player_id}: {e}")
                    self.metrics.failed_commands += 1
                
                # Control command rate
                await asyncio.sleep(command_interval)
                
        except Exception as e:
            self.metrics.errors.append(f"Session error for {player_id}: {e}")
        finally:
            await websocket.close()
    
    async def run_load_test(self, num_players: int = 4, commands_per_second: int = 50, duration: int = 60):
        """Run the main load test."""
        print(f"Starting load test: {num_players} players, {commands_per_second} commands/s per player, {duration}s duration")
        print(f"Total expected commands: {num_players * commands_per_second * duration}")
        
        # Create room for testing
        try:
            response = requests.post(f"{self.base_url}/match", json={"player_id": "load_test_player"})
            if response.status_code != 200:
                print(f"Failed to create room: {response.status_code}")
                return
            room_id = response.json()["room_id"]
            print(f"Created room: {room_id}")
        except Exception as e:
            print(f"Failed to create room: {e}")
            return
        
        # Start monitoring
        self.running = True
        self.metrics.start_time = time.time()
        
        monitor_thread = threading.Thread(target=self.monitor_system_resources)
        monitor_thread.daemon = True
        monitor_thread.start()
        
        # Create player sessions
        tasks = []
        for i in range(num_players):
            player_id = f"load_test_player_{i}"
            task = asyncio.create_task(
                self.run_player_session(player_id, room_id, commands_per_second, duration)
            )
            tasks.append(task)
        
        # Wait for all sessions to complete
        await asyncio.gather(*tasks)
        
        # Stop monitoring
        self.running = False
        self.metrics.end_time = time.time()
        
        # Wait a bit for monitoring to finish
        await asyncio.sleep(1)
        
        self.print_results()
    
    def print_results(self):
        """Print test results."""
        duration = self.metrics.end_time - self.metrics.start_time
        
        print("\n" + "="*60)
        print("LOAD TEST RESULTS")
        print("="*60)
        
        print(f"Test Duration: {duration:.2f} seconds")
        print(f"Total Messages Sent: {self.metrics.total_messages}")
        print(f"Successful Commands: {self.metrics.successful_commands}")
        print(f"Failed Commands: {self.metrics.failed_commands}")
        print(f"Error Count: {len(self.metrics.errors)}")
        
        if self.metrics.response_times:
            print(f"\nResponse Times:")
            print(f"  Average: {statistics.mean(self.metrics.response_times):.4f}s")
            print(f"  Median: {statistics.median(self.metrics.response_times):.4f}s")
            print(f"  Min: {min(self.metrics.response_times):.4f}s")
            print(f"  Max: {max(self.metrics.response_times):.4f}s")
        
        if self.metrics.cpu_usage:
            print(f"\nCPU Usage:")
            print(f"  Average: {statistics.mean(self.metrics.cpu_usage):.2f}%")
            print(f"  Peak: {max(self.metrics.cpu_usage):.2f}%")
            print(f"  Target: <50%")
            
            if statistics.mean(self.metrics.cpu_usage) > 50:
                print("  ❌ PERFORMANCE TARGET MISSED - CPU usage too high!")
            else:
                print("  ✅ PERFORMANCE TARGET MET - CPU usage within limits")
        
        if self.metrics.memory_usage:
            print(f"\nMemory Usage:")
            print(f"  Average: {statistics.mean(self.metrics.memory_usage):.2f} MB")
            print(f"  Peak: {max(self.metrics.memory_usage):.2f} MB")
        
        if self.metrics.errors:
            print(f"\nErrors (first 10):")
            for error in self.metrics.errors[:10]:
                print(f"  - {error}")
        
        print("\n" + "="*60)

async def main():
    """Main function to run the load test."""
    tester = LoadTester()
    
    print("Carcassonne: War of Ages - Load Test")
    print("====================================")
    print("Target: 4 players, 200 commands/s total (50 per player), CPU <50%")
    print("Make sure the server is running on http://localhost:8000")
    print("\nStarting in 3 seconds...")
    await asyncio.sleep(3)
    
    await tester.run_load_test(
        num_players=4,
        commands_per_second=50,  # 50 commands/s per player = 200 total
        duration=30  # 30 seconds test
    )

if __name__ == "__main__":
    asyncio.run(main()) 