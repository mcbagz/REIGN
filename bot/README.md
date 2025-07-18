# Carcassonne: War of Ages - Bot Player System

This directory contains the bot player implementation for Carcassonne: War of Ages. The bots are designed to provide reasonable opponents that make strategic decisions without being impossibly difficult to beat.

## Architecture

- **bot_player.py**: Core bot implementation with decision-making logic
- **bot_launcher.py**: Standalone script to launch bot instances
- **bot_manager.py**: Server integration module for spawning bots

## Bot Behavior

The bot makes decisions every 0.5 seconds and follows a phased strategy:

### Early Game (Turns 1-20)
- Focus on expanding territory
- Claim resource tiles (mines and orchards)
- Train basic infantry for defense
- High expansion priority (70%)

### Mid Game (Turns 21-60)
- Balance expansion with military buildup
- Train varied unit types (archers, knights)
- Start pressuring nearest opponents
- Moderate aggression (50%)

### Late Game (Turns 61+)
- Focus on conquering enemy capitals
- Train siege units for assaults
- Coordinate unit attacks
- Defend own capital aggressively

## Difficulty Levels

- **Easy**: Slower decisions (0.8s), peaceful (30% aggression), expansion-focused
- **Normal**: Balanced gameplay (0.5s decisions, 50% aggression)
- **Hard**: Fast decisions (0.3s), aggressive (70%), military-focused

## Integration with Game Server

### Option 1: Direct Integration (Recommended)

In your game server code, import and use the bot manager:

```python
from bot.bot_manager import spawn_bot_for_room, fill_room_with_bots

# When creating a match, fill with bots
async def create_match(player_count: int):
    room_id = generate_room_id()
    # ... create room logic ...
    
    # Fill remaining slots with bots
    bots_added = fill_room_with_bots(
        room_id=room_id,
        target_players=4,
        current_players=player_count,
        difficulty="normal"
    )
    
    return room_id
```

### Option 2: Subprocess Launch

Launch bots as separate processes:

```bash
python bot/bot_launcher.py <room_id> [difficulty]
```

### Option 3: Modify Game Room

Add bot spawning to your GameRoom class:

```python
# In game_room.py
from bot.bot_manager import bot_manager

async def _check_and_start_game(self):
    # ... existing logic ...
    
    # If we have fewer than 4 players, add bots
    if len(self.players) < 4:
        bots_needed = 4 - len(self.players)
        for i in range(bots_needed):
            await bot_manager.spawn_bot_async(self.room_id, "normal")
```

## Bot Decision Making

The bot uses a priority-based system:

1. **Critical Actions**: Defend capital under attack
2. **High Priority**: Place tiles during turn, train units
3. **Medium Priority**: Move units, claim resources
4. **Low Priority**: Raid enemies, reposition units

Decisions include randomness to feel more human-like and avoid predictability.

## Testing

Run a bot manually:

```bash
# Start your game server first
cd backend
uvicorn src.main:app --reload

# In another terminal, run a bot
cd bot
python bot_player.py
```

## Configuration

Bot behavior can be customized via BotConfig:

```python
config = BotConfig(
    decision_interval=0.5,      # Seconds between decisions
    aggression_level=0.5,       # 0-1 (peaceful to aggressive)
    expansion_priority=0.7,     # 0-1 (military to expansion)
    bot_name="CustomBot",
    server_url="ws://localhost:8000"
)
```

## Future Improvements

- Smarter tile placement based on map analysis
- Formation-based unit movement
- Alliance detection and diplomacy
- Resource optimization algorithms
- Threat assessment system
- Adaptive difficulty based on player skill