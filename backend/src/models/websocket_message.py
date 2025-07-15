"""
WebSocket message model for Carcassonne: War of Ages.
"""

from typing import Optional, List, Dict, Any, Union
from enum import Enum
from pydantic import BaseModel, Field
from .game_state import GameState
from .tile import TileType
from .unit import Position


class MessageType(str, Enum):
    """Available message types."""
    COMMAND = "command"
    STATE = "state"
    ERROR = "error"
    PING = "ping"
    PONG = "pong"
    JOIN_GAME = "join_game"
    LEAVE_GAME = "leave_game"
    PLAYER_JOINED = "player_joined"
    PLAYER_LEFT = "player_left"
    GAME_STARTED = "game_started"
    GAME_ENDED = "game_ended"
    TURN_CHANGED = "turn_changed"
    TILE_PLACED = "tile_placed"
    UNIT_CREATED = "unit_created"
    UNIT_MOVED = "unit_moved"
    UNIT_ATTACKED = "unit_attacked"
    RESOURCE_UPDATED = "resource_updated"


class Priority(str, Enum):
    """Message priority levels."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class Source(str, Enum):
    """Message source."""
    CLIENT = "client"
    SERVER = "server"


class MessageMetadata(BaseModel):
    """Message metadata."""
    source: Optional[Source] = Field(default=None, description="Source of the message")
    version: Optional[str] = Field(default=None, description="Protocol version")
    retry_count: int = Field(ge=0, default=0, description="Number of retry attempts")
    max_retries: int = Field(ge=0, default=3, description="Maximum number of retry attempts")
    ttl: Optional[float] = Field(ge=0, default=None, description="Time to live in seconds")


class CommandAction(str, Enum):
    """Available command actions."""
    PLACE_TILE = "place_tile"
    PLACE_WORKER = "place_worker"
    CREATE_UNIT = "create_unit"
    MOVE_UNIT = "move_unit"
    ATTACK_UNIT = "attack_unit"
    ATTACK_TILE = "attack_tile"
    END_TURN = "end_turn"
    PAUSE_GAME = "pause_game"
    RESUME_GAME = "resume_game"
    SURRENDER = "surrender"


class CommandPayload(BaseModel):
    """Command payload structure."""
    action: CommandAction = Field(description="Command action to perform")
    parameters: Dict[str, Any] = Field(description="Action-specific parameters")


class StatePayload(BaseModel):
    """State payload structure."""
    game_state: Optional[GameState] = Field(default=None, description="Complete game state")
    delta: Optional[Dict[str, Any]] = Field(default=None, description="Only the changes since last state update")
    full_state: bool = Field(default=False, description="Whether this is a complete state or delta")


class ErrorPayload(BaseModel):
    """Error payload structure."""
    code: str = Field(description="Error code")
    message: str = Field(description="Human-readable error message")
    details: Optional[Dict[str, Any]] = Field(default=None, description="Additional error details")
    retryable: bool = Field(default=False, description="Whether the action can be retried")


class JoinGamePayload(BaseModel):
    """Join game payload structure."""
    player_name: str = Field(min_length=1, max_length=20, description="Player's display name")
    game_id: Optional[str] = Field(default=None, description="Game ID to join, null to create new game")
    spectator: bool = Field(default=False, description="Whether to join as spectator")


class PlaceTilePayload(BaseModel):
    """Place tile payload structure."""
    tile_type: TileType = Field(description="Type of tile to place")
    position: Position = Field(description="Position to place the tile")
    rotation: Optional[int] = Field(ge=0, le=3, default=0, description="Rotation of the tile (0-3, 90-degree increments)")


class UnitActionPayload(BaseModel):
    """Unit action payload structure."""
    unit_id: str = Field(description="ID of the unit performing the action")
    target_position: Position = Field(description="Target position for the action")
    target_id: Optional[str] = Field(default=None, description="ID of target unit or tile, null for movement")


class WebSocketMessage(BaseModel):
    """WebSocket message envelope for client-server communication."""
    type: MessageType = Field(description="Type of message")
    payload: Union[str, int, float, bool, Dict[str, Any], List[Any], None] = Field(description="Message payload, structure depends on message type")
    timestamp: float = Field(description="Unix timestamp when message was created")
    message_id: str = Field(description="Unique identifier for this message")
    player_id: Optional[int] = Field(ge=0, default=None, description="ID of the player who sent the message, null for server messages")
    game_id: Optional[str] = Field(default=None, description="ID of the game this message relates to, null for lobby messages")
    sequence_number: Optional[int] = Field(ge=0, default=None, description="Sequence number for ordering messages")
    reply_to: Optional[str] = Field(default=None, description="Message ID this is a reply to, null if not a reply")
    priority: Priority = Field(default=Priority.NORMAL, description="Message priority for processing order")
    requires_ack: bool = Field(default=False, description="Whether this message requires acknowledgment")
    metadata: Optional[MessageMetadata] = Field(default=None, description="Message metadata")

    class Config:
        """Pydantic configuration."""
        use_enum_values = True
        validate_assignment = True
        schema_extra = {
            "example": {
                "type": "command",
                "payload": {
                    "action": "place_tile",
                    "parameters": {
                        "tile_type": "city",
                        "position": {"x": 10, "y": 15},
                        "rotation": 0
                    }
                },
                "timestamp": 1640995200.0,
                "message_id": "msg_12345",
                "player_id": 1,
                "game_id": "game_67890",
                "sequence_number": 42,
                "reply_to": None,
                "priority": "normal",
                "requires_ack": True,
                "metadata": {
                    "source": "client",
                    "version": "1.0",
                    "retry_count": 0,
                    "max_retries": 3,
                    "ttl": 30.0
                }
            }
        } 