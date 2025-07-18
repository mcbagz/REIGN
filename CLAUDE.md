# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Carcassonne: War of Ages** is a web-based real-time strategy game that combines Carcassonne's tile-laying mechanics with Age of Empires' conquest-driven RTS gameplay.

- **Frontend**: Vanilla JavaScript with PixiJS for 2D rendering
- **Backend**: FastAPI (Python) with WebSocket support for real-time multiplayer
- **Architecture**: Client-server model with WebSocket communication for game state synchronization

## Common Development Commands

### Frontend Development
```bash
cd frontend
npm install              # Install dependencies
npm run dev             # Start development server on port 8080
npm run build           # Generate TypeScript types from JSON schemas
npm run generate-types  # Generate types manually
```

### Backend Development
```bash
cd backend
pip install -r requirements.txt   # Install Python dependencies
uvicorn src.main:app --reload    # Start FastAPI server with hot reload
pytest                           # Run all tests
pytest -v tests/test_combat_system.py  # Run specific test file
```

## Architecture Overview

### Frontend Structure
- **Entry Point**: `frontend/src/js/main.js` - Initializes the GameApp and manages screens
- **Core Game Loop**: `frontend/src/js/game.js` - Main Game class that orchestrates all systems
- **WebSocket Communication**: `frontend/src/js/websocket-client.js` - Handles real-time server communication
- **Game Systems**:
  - `tile-system.js` - Tile placement and management
  - `unit-system.js` - Unit spawning, movement, and combat
  - `conquest-system.js` - Territory control and conquest mechanics
  - `resource-manager.js` - Resource generation and management
  - `renderer.js` - PixiJS-based rendering system
  - `ui-manager.js` - UI state and player interactions

### Backend Structure
- **Entry Point**: `backend/src/main.py` - FastAPI app with WebSocket endpoints
- **Game Management**: `backend/src/game_room.py` - Room-based multiplayer game sessions
- **Core Systems**:
  - `combat_system.py` - Combat resolution and damage calculations
  - `conquest_system.py` - Territory control and victory conditions
  - `pathfinding.py` - A* pathfinding for unit movement
- **Data Models** (`backend/src/models/`):
  - `game_state.py` - Complete game state representation
  - `tile.py` - Tile types and properties
  - `unit.py` - Unit types and combat stats
  - `websocket_message.py` - Message protocol definitions

### Shared Resources
- **JSON Schemas** (`shared/schemas/`) - Define the structure for game state, tiles, units, and messages
- **Type Generation**: Frontend TypeScript types are auto-generated from these schemas

## Key Implementation Details

### WebSocket Protocol
- Messages follow the structure defined in `websocket_message.py`
- Client connects to `/ws/{room_id}/{player_id}`
- Message types include: `game_update`, `place_tile`, `spawn_unit`, `move_unit`, `attack_tile`, etc.

### Game State Synchronization
- Server maintains authoritative game state
- Clients send actions via WebSocket
- Server validates actions, updates state, and broadcasts to all players
- Frontend uses prediction for responsive UI while awaiting server confirmation

### Tile Placement System
- Players can place one tile every 15 seconds
- Can store up to 3 tile placements
- Choose from 3 random tile options per placement
- Tiles must connect to existing territory

### Combat System
- Rock-paper-scissors unit relationships (Infantry > Archers > Knights > Infantry)
- Real-time movement with A* pathfinding
- Siege units required for destroying fortified structures
- Victory achieved by destroying all enemy capitals

## Testing Approach

### Backend Tests
```bash
cd backend
pytest                    # Run all tests
pytest -v -s             # Verbose output with print statements
pytest tests/test_combat_system.py::TestCombatSystem::test_unit_attack  # Specific test
```

### Frontend Tests
Currently no automated frontend tests. Manual testing via dev server recommended.

## Development Tips

1. **Hot Reload**: Both frontend (via HTTP server) and backend (via uvicorn --reload) support hot reloading
2. **Type Safety**: Run `npm run generate-types` after modifying JSON schemas to update TypeScript types
3. **WebSocket Debugging**: Use browser DevTools Network tab to inspect WebSocket messages
4. **Game State**: Access current game state via `window.game.gameState` in browser console
5. **Coordinate System**: Uses grid-based coordinates with (x, y) where (0, 0) is top-left

## Common Debugging Commands

```javascript
// Browser console commands
game.gameState                    // View current game state
game.websocketClient.send({...})  // Send custom WebSocket message
game.tileSystem.tiles            // Inspect placed tiles
game.unitSystem.units           // View all units
```

## Environment Configuration

- Frontend expects backend at `ws://localhost:8000` (configurable in `frontend/src/js/config.js`)
- Backend CORS configured for localhost:8080 (frontend dev server)
- No environment variables required for basic development