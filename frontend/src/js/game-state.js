// Game State Management Class
class GameState {
    constructor(config) {
        this.config = config;
        this.initialized = false;
        
        // Core game state
        this.players = new Map();
        this.currentPlayer = 0;
        this.gamePhase = 'setup'; // setup, playing, ended
        this.winner = null;
        
        // Game entities
        this.tiles = new Map(); // key: "x,y", value: tile object
        this.units = new Map(); // key: unitId, value: unit object
        this.workers = new Map(); // key: workerId, value: worker object
        
        // Game timing
        this.gameTime = 0;
        this.lastTilePlacement = 0;
        this.tileSelectionQueue = [];
        
        // Initialize counters
        this.nextUnitId = 1;
        this.nextWorkerId = 1;
        
        console.log('GameState created with config:', config);
    }
    
    initializePlayers(playerCount) {
        console.log(`Initializing ${playerCount} players...`);
        
        this.players.clear();
        
        for (let i = 0; i < playerCount; i++) {
            const player = {
                id: i,
                name: `Player ${i + 1}`,
                color: GameConfig.COLORS.PLAYERS[i],
                resources: { ...GameConfig.STARTING_RESOURCES },
                techLevel: GameConfig.TECH_LEVELS.MANOR,
                workers: [],
                units: [],
                tiles: [],
                capitalPosition: null,
                isEliminated: false,
                isAI: i >= this.config.playerCount - this.config.aiOpponents
            };
            
            // Initialize workers
            for (let j = 0; j < GameConfig.STARTING_WORKERS; j++) {
                const workerId = this.nextWorkerId++;
                const worker = {
                    id: workerId,
                    owner: i,
                    status: 'idle', // 'idle', 'deployed', 'cooldown'
                    tileKey: null,
                    cooldownTimer: null,
                    type: 'worker' // All workers are generic for now
                };
                player.workers.push(worker);
                
                // Add to global workers map for easy lookup
                this.workers.set(workerId, worker);
            }
            
            this.players.set(i, player);
        }
        
        console.log(`${playerCount} players initialized`);
    }
    
    getPlayer(playerId) {
        return this.players.get(playerId);
    }
    
    getCurrentPlayer() {
        return this.players.get(this.currentPlayer);
    }
    
    nextPlayer() {
        const playerCount = this.players.size;
        let nextPlayerId = (this.currentPlayer + 1) % playerCount;
        
        // Skip eliminated players
        while (this.players.get(nextPlayerId).isEliminated) {
            nextPlayerId = (nextPlayerId + 1) % playerCount;
        }
        
        this.currentPlayer = nextPlayerId;
        return this.getCurrentPlayer();
    }
    
    eliminatePlayer(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            player.isEliminated = true;
            console.log(`Player ${playerId} eliminated`);
            
            // Check for winner
            this.checkWinCondition();
        }
    }
    
    checkWinCondition() {
        const activePlayers = Array.from(this.players.values()).filter(p => !p.isEliminated);
        
        if (activePlayers.length === 1) {
            this.winner = activePlayers[0];
            this.gamePhase = 'ended';
            console.log(`Game ended! Winner: ${this.winner.name}`);
        }
    }
    
    // Tile management
    placeTile(x, y, tile) {
        const key = Utils.getGridKey(x, y);
        
        if (this.tiles.has(key)) {
            console.warn('Tile already exists at position:', x, y);
            return false;
        }
        
        const tileObject = {
            ...tile,
            x,
            y,
            id: key,
            owner: this.currentPlayer,
            worker: null,
            hp: GameConfig.TILE_STATS[tile.type].hp,
            maxHp: GameConfig.TILE_STATS[tile.type].hp,
            placedAt: this.gameTime
        };
        
        this.tiles.set(key, tileObject);
        
        // Add to player's tiles
        const player = this.getCurrentPlayer();
        player.tiles.push(tileObject);
        
        console.log(`Tile placed at (${x}, ${y}):`, tileObject);
        return true;
    }
    
    getTile(x, y) {
        const key = Utils.getGridKey(x, y);
        return this.tiles.get(key);
    }
    
    removeTile(x, y) {
        const key = Utils.getGridKey(x, y);
        const tile = this.tiles.get(key);
        
        if (tile) {
            // Remove from player's tiles
            const player = this.players.get(tile.owner);
            if (player) {
                player.tiles = player.tiles.filter(t => t.id !== key);
            }
            
            // Remove worker if present
            if (tile.worker) {
                this.recallWorker(tile.worker.id);
            }
            
            this.tiles.delete(key);
            console.log(`Tile removed from (${x}, ${y})`);
            return true;
        }
        
        return false;
    }
    
    // Worker management
    placeWorker(x, y, workerId, workerType) {
        const tile = this.getTile(x, y);
        const player = this.getCurrentPlayer();
        
        if (!tile || tile.owner !== this.currentPlayer) {
            console.warn('Cannot place worker on tile not owned by current player');
            return false;
        }
        
        if (tile.worker) {
            console.warn('Tile already has a worker');
            return false;
        }
        
        const worker = player.workers.find(w => w.id === workerId);
        if (!worker || !worker.available) {
            console.warn('Worker not available');
            return false;
        }
        
        // Place worker
        worker.type = workerType;
        worker.position = { x, y };
        worker.available = false;
        
        tile.worker = worker;
        
        console.log(`Worker ${workerId} placed at (${x}, ${y}) as ${workerType}`);
        return true;
    }
    
    recallWorker(workerId) {
        const player = this.getCurrentPlayer();
        const worker = player.workers.find(w => w.id === workerId);
        
        if (!worker) {
            console.warn('Worker not found');
            return false;
        }
        
        // Remove from tile
        if (worker.position) {
            const tile = this.getTile(worker.position.x, worker.position.y);
            if (tile && tile.worker && tile.worker.id === workerId) {
                tile.worker = null;
            }
        }
        
        // Set recall timer
        worker.recallTime = GameConfig.WORKER_RECALL_TIME;
        worker.type = null;
        worker.position = null;
        
        console.log(`Worker ${workerId} recalled, available in ${GameConfig.WORKER_RECALL_TIME}ms`);
        return true;
    }
    
    // Unit management
    createUnit(x, y, unitType, owner) {
        const unit = {
            id: this.nextUnitId++,
            type: unitType,
            x,
            y,
            owner,
            hp: GameConfig.UNIT_STATS[unitType].hp,
            maxHp: GameConfig.UNIT_STATS[unitType].hp,
            target: null,
            path: [],
            createdAt: this.gameTime
        };
        
        this.units.set(unit.id, unit);
        
        // Add to player's units
        const player = this.players.get(owner);
        if (player) {
            player.units.push(unit);
        }
        
        console.log(`Unit created:`, unit);
        return unit;
    }
    
    removeUnit(unitId) {
        const unit = this.units.get(unitId);
        if (unit) {
            // Remove from player's units
            const player = this.players.get(unit.owner);
            if (player) {
                player.units = player.units.filter(u => u.id !== unitId);
            }
            
            this.units.delete(unitId);
            console.log(`Unit ${unitId} removed`);
            return true;
        }
        
        return false;
    }
    
    getUnit(unitId) {
        return this.units.get(unitId);
    }
    
    getUnitsAt(x, y) {
        return Array.from(this.units.values()).filter(unit => 
            unit.x === x && unit.y === y
        );
    }
    
    // Resource management
    addResources(playerId, resources) {
        const player = this.players.get(playerId);
        if (player) {
            player.resources = Utils.addResources(player.resources, resources);
            return true;
        }
        return false;
    }
    
    subtractResources(playerId, resources) {
        const player = this.players.get(playerId);
        if (player && Utils.canAffordCost(player.resources, resources)) {
            player.resources = Utils.subtractCost(player.resources, resources);
            return true;
        }
        return false;
    }
    
    canAfford(playerId, cost) {
        const player = this.players.get(playerId);
        return player ? Utils.canAffordCost(player.resources, cost) : false;
    }
    
    // Map initialization
    initializeMap() {
        console.log('Initializing game map...');
        
        // Clear existing tiles
        this.tiles.clear();
        
        // Place capital cities in quadrants
        this.placeCapitalCities();
        
        // Scatter resource tiles
        this.scatterResourceTiles();
        
        // Save to localStorage
        this.saveToLocalStorage();
        
        console.log('Map initialized successfully');
    }
    
    placeCapitalCities() {
        console.log('Placing capital cities in quadrants...');
        
        const quadrants = [
            { x: 10, y: 10 },  // Top-left quadrant
            { x: 30, y: 10 },  // Top-right quadrant  
            { x: 10, y: 30 },  // Bottom-left quadrant
            { x: 30, y: 30 }   // Bottom-right quadrant
        ];
        
        quadrants.forEach((pos, index) => {
            const capital = {
                id: `capital_${index}`,
                type: GameConfig.TILE_TYPES.CAPITAL_CITY,
                x: pos.x,
                y: pos.y,
                owner: index < this.players.size ? index : null,
                resources: {
                    gold: GameConfig.STARTING_RESOURCES.gold,
                    food: GameConfig.STARTING_RESOURCES.food,
                    faith: GameConfig.STARTING_RESOURCES.faith
                },
                workers: [],
                units: [],
                hp: 100,
                maxHp: 100,
                placedAt: this.gameTime
            };
            
            this.tiles.set(`${pos.x},${pos.y}`, capital);
            
            // Set capital position for player
            if (capital.owner !== null) {
                const player = this.players.get(capital.owner);
                if (player) {
                    player.capitalPosition = { x: pos.x, y: pos.y };
                }
            }
        });
        
        console.log('Capital cities placed successfully');
    }
    
    scatterResourceTiles() {
        console.log('Scattering resource tiles...');
        
        // First, place field tiles around capital cities
        this.placeFieldTilesAroundCapitals();
        
        // Place some city tiles for variety
        this.placeCityTiles();
        
        const resourceTypes = [
            GameConfig.TILE_TYPES.MINE,
            GameConfig.TILE_TYPES.ORCHARD,
            GameConfig.TILE_TYPES.MONASTERY,
            GameConfig.TILE_TYPES.MARSH
        ];
        
        // Generate random positions for resource tiles
        const resourcePositions = [];
        const tilesPerType = 3; // 3 tiles per resource type
        
        resourceTypes.forEach(tileType => {
            for (let i = 0; i < tilesPerType; i++) {
                let attempts = 0;
                let x, y;
                
                // Try to find a valid position
                do {
                    x = Math.floor(Math.random() * GameConfig.GRID_WIDTH);
                    y = Math.floor(Math.random() * GameConfig.GRID_HEIGHT);
                    attempts++;
                } while (
                    attempts < 100 && 
                    (this.tiles.has(`${x},${y}`) || this.isNearCapital(x, y))
                );
                
                if (attempts < 100) {
                    const resourceTile = {
                        id: `${tileType}_${i}`,
                        type: tileType,
                        x,
                        y,
                        owner: null,
                        resources: this.getResourceTileResources(tileType),
                        workers: [],
                        units: [],
                        hp: 50,
                        maxHp: 50,
                        placedAt: this.gameTime
                    };
                    
                    this.tiles.set(`${x},${y}`, resourceTile);
                    resourcePositions.push({ x, y, type: tileType });
                }
            }
        });
        
        console.log('Resource tiles scattered:', resourcePositions);
    }
    
    placeFieldTilesAroundCapitals() {
        console.log('Placing field tiles around capitals...');
        
        const capitals = [
            { x: 10, y: 10 },
            { x: 30, y: 10 },
            { x: 10, y: 30 },
            { x: 30, y: 30 }
        ];
        
        capitals.forEach((capital, index) => {
            const positions = [
                { x: capital.x - 1, y: capital.y },     // West
                { x: capital.x + 1, y: capital.y },     // East
                { x: capital.x, y: capital.y - 1 },     // North
                { x: capital.x, y: capital.y + 1 },     // South
                { x: capital.x - 1, y: capital.y - 1 }, // Northwest
                { x: capital.x + 1, y: capital.y - 1 }, // Northeast
                { x: capital.x - 1, y: capital.y + 1 }, // Southwest
                { x: capital.x + 1, y: capital.y + 1 }  // Southeast
            ];
            
            positions.forEach((pos, i) => {
                if (pos.x >= 0 && pos.x < GameConfig.GRID_WIDTH && 
                    pos.y >= 0 && pos.y < GameConfig.GRID_HEIGHT &&
                    !this.tiles.has(`${pos.x},${pos.y}`)) {
                    
                    const fieldTile = {
                        id: `field_capital_${index}_${i}`,
                        type: GameConfig.TILE_TYPES.FIELD,
                        x: pos.x,
                        y: pos.y,
                        owner: null,
                        resources: { gold: 0, food: 20, faith: 0 },
                        workers: [],
                        units: [],
                        hp: 30,
                        maxHp: 30,
                        placedAt: this.gameTime
                    };
                    
                    this.tiles.set(`${pos.x},${pos.y}`, fieldTile);
                }
            });
        });
        
        console.log('Field tiles placed around capitals');
    }
    
    placeCityTiles() {
        console.log('Placing city tiles...');
        
        const cityPositions = [
            { x: 15, y: 15 },
            { x: 25, y: 15 },
            { x: 15, y: 25 },
            { x: 25, y: 25 }
        ];
        
        cityPositions.forEach((pos, index) => {
            if (!this.tiles.has(`${pos.x},${pos.y}`)) {
                const cityTile = {
                    id: `city_${index}`,
                    type: GameConfig.TILE_TYPES.CITY,
                    x: pos.x,
                    y: pos.y,
                    owner: null,
                    resources: { gold: 30, food: 30, faith: 0 },
                    workers: [],
                    units: [],
                    hp: 60,
                    maxHp: 60,
                    placedAt: this.gameTime
                };
                
                this.tiles.set(`${pos.x},${pos.y}`, cityTile);
            }
        });
        
        console.log('City tiles placed');
    }
    
    isNearCapital(x, y) {
        const minDistance = 3;
        
        // Check distance from all capital positions
        const capitals = [
            { x: 10, y: 10 },
            { x: 30, y: 10 },
            { x: 10, y: 30 },
            { x: 30, y: 30 }
        ];
        
        return capitals.some(capital => {
            const distance = Math.abs(x - capital.x) + Math.abs(y - capital.y);
            return distance < minDistance;
        });
    }
    
    getResourceTileResources(tileType) {
        const resourceMappings = {
            [GameConfig.TILE_TYPES.MINE]: { gold: 50, food: 0, faith: 0 },
            [GameConfig.TILE_TYPES.ORCHARD]: { gold: 0, food: 50, faith: 0 },
            [GameConfig.TILE_TYPES.MONASTERY]: { gold: 0, food: 0, faith: 50 },
            [GameConfig.TILE_TYPES.MARSH]: { gold: 0, food: 0, faith: 0 }
        };
        
        return resourceMappings[tileType] || { gold: 0, food: 0, faith: 0 };
    }
    

    
    // Tile placement and validation
    placeTile(x, y, tileData) {
        console.log(`Attempting to place tile at ${x},${y}:`, tileData);
        
        // Validate coordinates
        if (!this.isValidCoordinate(x, y)) {
            console.warn('Invalid coordinates:', x, y);
            return false;
        }
        
        // Check if position is already occupied
        if (this.tiles.has(`${x},${y}`)) {
            console.warn('Position already occupied:', x, y);
            return false;
        }
        
        // Check adjacency rules (must touch at least one existing tile)
        if (!this.hasAdjacentTile(x, y)) {
            console.warn('No adjacent tiles for placement at:', x, y);
            console.log('Current tiles in map:', Array.from(this.tiles.keys()));
            console.log('Total tiles:', this.tiles.size);
            return false;
        }
        
        // No edge compatibility needed for conquest game - just adjacency
        
        // Place the tile
        const placedTile = {
            ...tileData,
            x,
            y,
            owner: this.currentPlayer,
            workers: [],
            units: [],
            placedAt: this.gameTime
        };
        
        this.tiles.set(`${x},${y}`, placedTile);
        
        // Update localStorage
        this.saveToLocalStorage();
        
        console.log('Tile placed successfully:', placedTile);
        
        // Dispatch event for UI updates
        const event = new CustomEvent('tilePlaced', {
            detail: { x, y, tile: placedTile }
        });
        document.dispatchEvent(event);
        
        return true;
    }
    
    isValidCoordinate(x, y) {
        return x >= 0 && x < GameConfig.GRID_WIDTH && y >= 0 && y < GameConfig.GRID_HEIGHT;
    }
    
    hasAdjacentTile(x, y) {
        const adjacentPositions = [
            { x: x - 1, y },     // West
            { x: x + 1, y },     // East
            { x, y: y - 1 },     // North
            { x, y: y + 1 }      // South
        ];
        
        return adjacentPositions.some(pos => 
            this.isValidCoordinate(pos.x, pos.y) && this.tiles.has(`${pos.x},${pos.y}`)
        );
    }
    

    
    getValidPlacementPositions(tileData) {
        const validPositions = [];
        
        // Check all grid positions
        for (let x = 0; x < GameConfig.GRID_WIDTH; x++) {
            for (let y = 0; y < GameConfig.GRID_HEIGHT; y++) {
                // Skip if position is occupied
                if (this.tiles.has(`${x},${y}`)) continue;
                
                // Check if position has adjacent tiles
                if (!this.hasAdjacentTile(x, y)) continue;
                
                // No edge compatibility check needed for conquest game
                
                validPositions.push({ x, y });
            }
        }
        
        return validPositions;
    }
    
    getTile(x, y) {
        return this.tiles.get(`${x},${y}`);
    }
    
    getAdjacentTiles(x, y) {
        const adjacentPositions = [
            { x: x - 1, y },     // West
            { x: x + 1, y },     // East
            { x, y: y - 1 },     // North
            { x, y: y + 1 }      // South
        ];
        
        return adjacentPositions
            .filter(pos => this.isValidCoordinate(pos.x, pos.y))
            .map(pos => this.getTile(pos.x, pos.y))
            .filter(tile => tile !== undefined);
    }
    
    // Local storage persistence
    saveToLocalStorage() {
        try {
            const gameData = this.serialize();
            localStorage.setItem('carcassonne_game_state', JSON.stringify(gameData));
            console.log('Game state saved to localStorage');
        } catch (error) {
            console.error('Failed to save game state:', error);
        }
    }
    
    loadFromLocalStorage() {
        try {
            const savedData = localStorage.getItem('carcassonne_game_state');
            if (savedData) {
                const gameData = JSON.parse(savedData);
                this.deserialize(gameData);
                console.log('Game state loaded from localStorage');
                return true;
            }
        } catch (error) {
            console.error('Failed to load game state:', error);
        }
        return false;
    }
    
    clearLocalStorage() {
        try {
            localStorage.removeItem('carcassonne_game_state');
            console.log('Game state cleared from localStorage');
        } catch (error) {
            console.error('Failed to clear game state:', error);
        }
    }
    
    // Auto-save functionality
    enableAutoSave(interval = 10000) {
        // Save every 10 seconds by default
        this.autoSaveInterval = setInterval(() => {
            this.saveToLocalStorage();
        }, interval);
    }
    
    disableAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }
    
    // Worker Management
    placeWorker(workerId, tileKey) {
        const worker = this.workers.get(workerId);
        if (!worker) {
            console.error(`Worker ${workerId} not found`);
            return false;
        }
        
        if (worker.status !== 'idle') {
            console.error(`Worker ${workerId} is not idle (status: ${worker.status})`);
            return false;
        }
        
        const tile = this.tiles.get(tileKey);
        if (!tile) {
            console.error(`Tile ${tileKey} not found`);
            return false;
        }
        
        // Check if tile is owned by worker's owner
        if (tile.owner !== worker.owner) {
            console.error(`Worker ${workerId} cannot be placed on tile ${tileKey} - not owned by player ${worker.owner}`);
            return false;
        }
        
        // Check if tile can accommodate workers
        const tileStats = GameConfig.TILE_STATS[tile.type];
        if (!tileStats || tileStats.workerCapacity === 0) {
            console.error(`Tile ${tileKey} cannot accommodate workers`);
            return false;
        }
        
        // Check if tile has space for workers
        const workersOnTile = Array.from(this.workers.values()).filter(w => w.tileKey === tileKey && w.status === 'deployed');
        if (workersOnTile.length >= tileStats.workerCapacity) {
            console.error(`Tile ${tileKey} is at full worker capacity`);
            return false;
        }
        
        // Place the worker
        worker.status = 'deployed';
        worker.tileKey = tileKey;
        
        // Emit event for UI updates
        this.emitEvent('workerPlaced', { workerId, tileKey, worker });
        
        console.log(`Worker ${workerId} placed on tile ${tileKey}`);
        return true;
    }
    
    recallWorker(workerId) {
        const worker = this.workers.get(workerId);
        if (!worker) {
            console.error(`Worker ${workerId} not found`);
            return false;
        }
        
        if (worker.status !== 'deployed') {
            console.error(`Worker ${workerId} is not deployed (status: ${worker.status})`);
            return false;
        }
        
        const tileKey = worker.tileKey;
        
        // Remove worker from tile
        worker.status = 'cooldown';
        worker.tileKey = null;
        
        // Clear any existing cooldown timer
        if (worker.cooldownTimer) {
            clearTimeout(worker.cooldownTimer);
        }
        
        // Start cooldown timer
        worker.cooldownTimer = setTimeout(() => {
            worker.status = 'idle';
            worker.cooldownTimer = null;
            console.log(`Worker ${workerId} cooldown finished - now available`);
            
            // Emit event for UI updates
            this.emitEvent('workerCooldownFinished', { workerId, worker });
        }, GameConfig.WORKER_RECALL_TIME);
        
        // Emit event for UI updates
        this.emitEvent('workerRecalled', { workerId, tileKey, worker });
        
        console.log(`Worker ${workerId} recalled from tile ${tileKey} - cooldown for ${GameConfig.WORKER_RECALL_TIME}ms`);
        return true;
    }
    
    getWorkersByPlayer(playerId) {
        return Array.from(this.workers.values()).filter(worker => worker.owner === playerId);
    }
    
    getAvailableWorkers(playerId) {
        return this.getWorkersByPlayer(playerId).filter(worker => worker.status === 'idle');
    }
    
    getDeployedWorkers(playerId) {
        return this.getWorkersByPlayer(playerId).filter(worker => worker.status === 'deployed');
    }
    
    getWorkersOnTile(tileKey) {
        return Array.from(this.workers.values()).filter(worker => worker.tileKey === tileKey && worker.status === 'deployed');
    }
    
    // Helper method to emit events
    emitEvent(eventName, data) {
        const event = new CustomEvent(eventName, { detail: data });
        document.dispatchEvent(event);
    }
    
    // Game state updates
    update(deltaTime) {
        this.gameTime += deltaTime;
        
        // Worker cooldown timers are handled by setTimeout, no need to update here
        
        // Update tile placement timing
        // This will be handled by the TileSystem
        
        // Update unit movements
        // This will be handled by the UnitSystem
    }
    
    // Serialization
    serialize() {
        return {
            players: Array.from(this.players.entries()),
            currentPlayer: this.currentPlayer,
            gamePhase: this.gamePhase,
            winner: this.winner,
            tiles: Array.from(this.tiles.entries()),
            units: Array.from(this.units.entries()),
            workers: Array.from(this.workers.entries()),
            gameTime: this.gameTime,
            lastTilePlacement: this.lastTilePlacement
        };
    }
    
    deserialize(data) {
        this.players = new Map(data.players);
        this.currentPlayer = data.currentPlayer;
        this.gamePhase = data.gamePhase;
        this.winner = data.winner;
        this.tiles = new Map(data.tiles);
        this.units = new Map(data.units);
        this.workers = new Map(data.workers);
        this.gameTime = data.gameTime;
        this.lastTilePlacement = data.lastTilePlacement;
    }
} 