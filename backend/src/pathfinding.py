"""
A* pathfinding implementation for unit movement in Carcassonne: War of Ages.
"""

import heapq
from typing import List, Tuple, Optional, Dict, Set
from dataclasses import dataclass, field
from src.models.unit import Position


@dataclass
class Node:
    """A node in the pathfinding graph."""
    position: Position
    g_cost: float = 0.0  # Cost from start to this node
    h_cost: float = 0.0  # Heuristic cost from this node to goal
    parent: Optional['Node'] = None
    
    @property
    def f_cost(self) -> float:
        """Total cost (g + h)."""
        return self.g_cost + self.h_cost
    
    def __lt__(self, other):
        """For heap comparison."""
        return self.f_cost < other.f_cost


class Pathfinder:
    """A* pathfinding system for the game grid."""
    
    def __init__(self, grid_width: int = 40, grid_height: int = 40):
        self.grid_width = grid_width
        self.grid_height = grid_height
        self.terrain_weights = {}  # Position -> weight mapping
        
    def set_terrain_weight(self, position: Position, weight: float):
        """Set terrain weight for a position."""
        key = f"{position.x},{position.y}"
        self.terrain_weights[key] = weight
    
    def get_terrain_weight(self, position: Position) -> float:
        """Get terrain weight for a position (default 1.0)."""
        key = f"{position.x},{position.y}"
        return self.terrain_weights.get(key, 1.0)
    
    def is_valid_position(self, position: Position) -> bool:
        """Check if position is within grid bounds."""
        return (0 <= position.x < self.grid_width and 
                0 <= position.y < self.grid_height)
    
    def get_neighbors(self, position: Position) -> List[Position]:
        """Get valid neighboring positions (4-directional)."""
        neighbors = []
        directions = [(0, 1), (1, 0), (0, -1), (-1, 0)]  # Up, Right, Down, Left
        
        for dx, dy in directions:
            new_x = position.x + dx
            new_y = position.y + dy
            
            # Check bounds before creating Position object
            if (0 <= new_x < self.grid_width and 0 <= new_y < self.grid_height):
                new_pos = Position(x=new_x, y=new_y)
                neighbors.append(new_pos)
        
        return neighbors
    
    def manhattan_distance(self, pos1: Position, pos2: Position) -> float:
        """Calculate Manhattan distance between two positions."""
        return abs(pos1.x - pos2.x) + abs(pos1.y - pos2.y)
    
    def find_path(self, start: Position, goal: Position, 
                  blocked_positions: Optional[Set[str]] = None) -> Optional[List[Position]]:
        """
        Find path from start to goal using A* algorithm.
        
        Args:
            start: Starting position
            goal: Goal position
            blocked_positions: Set of blocked position strings (format: "x,y")
            
        Returns:
            List of positions representing the path, or None if no path exists
        """
        if not self.is_valid_position(start) or not self.is_valid_position(goal):
            return None
        
        if blocked_positions is None:
            blocked_positions = set()
        
        # Check if goal is blocked
        goal_key = f"{goal.x},{goal.y}"
        if goal_key in blocked_positions:
            return None
        
        # Initialize data structures
        open_set = []
        closed_set = set()
        nodes = {}  # Position string -> Node
        
        # Create start node
        start_node = Node(position=start, g_cost=0.0, 
                         h_cost=self.manhattan_distance(start, goal))
        start_key = f"{start.x},{start.y}"
        nodes[start_key] = start_node
        heapq.heappush(open_set, start_node)
        
        while open_set:
            current_node = heapq.heappop(open_set)
            current_key = f"{current_node.position.x},{current_node.position.y}"
            
            # Skip if already processed
            if current_key in closed_set:
                continue
                
            closed_set.add(current_key)
            
            # Check if we reached the goal
            if current_node.position.x == goal.x and current_node.position.y == goal.y:
                return self._reconstruct_path(current_node)
            
            # Check neighbors
            for neighbor_pos in self.get_neighbors(current_node.position):
                neighbor_key = f"{neighbor_pos.x},{neighbor_pos.y}"
                
                # Skip if blocked or already processed
                if neighbor_key in blocked_positions or neighbor_key in closed_set:
                    continue
                
                # Calculate costs
                terrain_weight = self.get_terrain_weight(neighbor_pos)
                tentative_g_cost = current_node.g_cost + terrain_weight
                
                # Get or create neighbor node
                if neighbor_key not in nodes:
                    nodes[neighbor_key] = Node(
                        position=neighbor_pos,
                        g_cost=float('inf'),
                        h_cost=self.manhattan_distance(neighbor_pos, goal)
                    )
                
                neighbor_node = nodes[neighbor_key]
                
                # Update node if we found a better path
                if tentative_g_cost < neighbor_node.g_cost:
                    neighbor_node.g_cost = tentative_g_cost
                    neighbor_node.parent = current_node
                    heapq.heappush(open_set, neighbor_node)
        
        # No path found
        return None
    
    def _reconstruct_path(self, node: Node) -> List[Position]:
        """Reconstruct path from goal node to start."""
        path = []
        current = node
        
        while current is not None:
            path.append(current.position)
            current = current.parent
        
        path.reverse()
        return path


class MovementSystem:
    """System for managing unit movement along paths."""
    
    def __init__(self):
        self.unit_paths: Dict[str, List[Position]] = {}  # unit_id -> path
        self.unit_path_progress: Dict[str, int] = {}  # unit_id -> current path index
        self.unit_interpolation: Dict[str, float] = {}  # unit_id -> interpolation progress (0-1)
        
    def set_unit_path(self, unit_id: str, path: List[Position]):
        """Set movement path for a unit."""
        if len(path) < 2:
            # Path too short, remove any existing path
            self.clear_unit_path(unit_id)
            return
        
        self.unit_paths[unit_id] = path
        self.unit_path_progress[unit_id] = 0
        self.unit_interpolation[unit_id] = 0.0
    
    def clear_unit_path(self, unit_id: str):
        """Clear movement path for a unit."""
        self.unit_paths.pop(unit_id, None)
        self.unit_path_progress.pop(unit_id, None)
        self.unit_interpolation.pop(unit_id, None)
    
    def has_path(self, unit_id: str) -> bool:
        """Check if unit has an active path."""
        return unit_id in self.unit_paths
    
    def update_unit_movement(self, unit_id: str, unit_speed: float, 
                           delta_time: float) -> Optional[Position]:
        """
        Update unit movement along its path.
        
        Args:
            unit_id: ID of the unit
            unit_speed: Unit's movement speed (tiles per second)
            delta_time: Time elapsed since last update (seconds)
            
        Returns:
            New position if updated, None if no path or path complete
        """
        if not self.has_path(unit_id):
            return None
        
        path = self.unit_paths[unit_id]
        current_index = self.unit_path_progress[unit_id]
        interpolation = self.unit_interpolation[unit_id]
        
        # Check if we've reached the end of the path
        if current_index >= len(path) - 1:
            self.clear_unit_path(unit_id)
            return path[-1]  # Return final position
        
        # Calculate movement progress
        movement_progress = unit_speed * delta_time
        interpolation += movement_progress
        
        # Check if we've completed the current segment
        while interpolation >= 1.0 and current_index < len(path) - 1:
            interpolation -= 1.0
            current_index += 1
        
        # Update progress
        self.unit_path_progress[unit_id] = current_index
        self.unit_interpolation[unit_id] = interpolation
        
        # Check if we've reached the end
        if current_index >= len(path) - 1:
            self.clear_unit_path(unit_id)
            return path[-1]
        
        # Calculate interpolated position
        start_pos = path[current_index]
        end_pos = path[current_index + 1]
        
        # Linear interpolation between current and next position
        new_x = start_pos.x + (end_pos.x - start_pos.x) * interpolation
        new_y = start_pos.y + (end_pos.y - start_pos.y) * interpolation
        
        return Position(x=int(new_x), y=int(new_y))
    
    def get_unit_destination(self, unit_id: str) -> Optional[Position]:
        """Get the final destination of a unit's path."""
        if not self.has_path(unit_id):
            return None
        
        path = self.unit_paths[unit_id]
        return path[-1] if path else None
    
    def get_unit_progress(self, unit_id: str) -> float:
        """Get movement progress (0.0 to 1.0) for a unit."""
        if not self.has_path(unit_id):
            return 1.0
        
        path = self.unit_paths[unit_id]
        current_index = self.unit_path_progress[unit_id]
        interpolation = self.unit_interpolation[unit_id]
        
        total_segments = len(path) - 1
        if total_segments == 0:
            return 1.0
        
        completed_segments = current_index
        progress = (completed_segments + interpolation) / total_segments
        
        return min(1.0, progress) 