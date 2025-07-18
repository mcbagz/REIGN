from enum import Enum
from typing import Optional
from pydantic import BaseModel

class FollowerType(str, Enum):
    MAGISTRATE = "magistrate"  # Claims cities for gold production
    FARMER = "farmer"          # Claims fields for food production
    MONK = "monk"              # Claims monasteries for faith production
    SCOUT = "scout"            # Claims any tile for the player

class Follower(BaseModel):
    id: str
    player_id: str
    type: FollowerType
    tile_id: Optional[str] = None  # None if follower is in player's pool
    is_recalling: bool = False
    recall_started_at: Optional[float] = None  # Timestamp when recall started
    
    class Config:
        use_enum_values = True