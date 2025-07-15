// Main Game Class
class Game {
    constructor(config) {
        this.config = config;
        this.initialized = false;
        this.paused = false;
        this.gameState = null;
        this.renderer = null;
        this.tileSystem = null;
        this.resourceManager = null;
        this.unitSystem = null;
        this.websocketClient = null;
        this.uiManager = null;
        
        // Tile placement state
        this.selectedTileForPlacement = null;
        this.isPlacementMode = false;
        
        // Drag and drop state
        this.draggedTile = null;
        this.draggedTileIndex = null;
        
        // Game loop
        this.lastTime = 0;
        this.gameLoop = this.gameLoop.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleTileClick = this.handleTileClick.bind(this);
        this.handleTilePlaced = this.handleTilePlaced.bind(this);
        
        console.log('Game created with config:', config);
    }
    
    async init() {
        console.log('Initializing game...');
        
        try {
            // Initialize game state
            this.gameState = new GameState(this.config);
            
            // Initialize renderer
            this.renderer = new GameRenderer();
            await this.renderer.init();
            
            // Initialize UI Manager
            this.uiManager = new UIManager();
            this.uiManager.init(this.renderer);
            
            // Initialize game systems
            this.tileSystem = new TileSystem(this.gameState);
            this.resourceManager = new ResourceManager(this.gameState);
            this.unitSystem = new UnitSystem(this.gameState);
            
            // Initialize multiplayer if needed
            if (this.config.mode === 'multiplayer') {
                this.websocketClient = new WebSocketClient();
                await this.websocketClient.connect();
            }
            
            // Set up game state
            this.setupInitialState();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Start game loop
            this.start();
            
            this.initialized = true;
            console.log('Game initialized successfully!');
            
        } catch (error) {
            console.error('Failed to initialize game:', error);
            throw error;
        }
    }
    
    setupInitialState() {
        // Create initial game state based on GDD
        console.log('Setting up initial game state...');
        
        // Initialize players
        this.gameState.initializePlayers(this.config.playerCount);
        
        // For new games, always initialize fresh (clear any existing save)
        localStorage.removeItem('gameState');
        console.log('Starting fresh game - cleared localStorage');
        
        // Initialize new map
        this.gameState.initializeMap();
        
        // Initialize resource manager
        this.resourceManager.initializeResources();
        
        // Enable auto-save
        this.gameState.enableAutoSave();
        
        // Render initial tiles
        this.renderer.renderTiles(this.gameState.tiles);
        
        console.log('Initial game state set up complete');
    }
    
    setupEventListeners() {
        // Tile click events from renderer
        document.addEventListener('tileClick', this.handleTileClick);
        
        // Tile placement events from game state
        document.addEventListener('tilePlaced', this.handleTilePlaced);
        
        // Cancel placement event from UI
        document.addEventListener('cancelPlacement', () => {
            this.exitPlacementMode();
        });
        
        // Tile bank events
        document.addEventListener('tileSelectedFromBank', this.handleTileSelectedFromBank.bind(this));
        document.addEventListener('tileDragStart', this.handleTileDragStart.bind(this));
        document.addEventListener('tileDragEnd', this.handleTileDragEnd.bind(this));
        
        // Worker events
        document.addEventListener('workerDragStart', this.handleWorkerDragStart.bind(this));
        document.addEventListener('workerDragEnd', this.handleWorkerDragEnd.bind(this));
        document.addEventListener('workerRecallRequest', this.handleWorkerRecallRequest.bind(this));
        
        // Canvas drag and drop events
        this.setupCanvasDragDrop();
        
        // Window resize
        window.addEventListener('resize', this.handleResize);
        
        // Add cleanup event listeners
        window.addEventListener('beforeunload', () => {
            this.stop();
        });
        
        window.addEventListener('unload', () => {
            this.stop();
        });
        
        // Also cleanup on page visibility change (when tab is hidden)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('Page hidden, pausing timers');
                this.stop();
            }
        });
    }
    
    setupCanvasDragDrop() {
        const canvasContainer = document.getElementById('game-canvas-container');
        if (!canvasContainer) return;
        
        canvasContainer.addEventListener('dragover', (e) => {
            e.preventDefault(); // Allow drop
        });
        
        canvasContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            this.handleCanvasDrop(e);
        });
    }
    
    handleTileSelectedFromBank(event) {
        const { tile, index } = event.detail;
        // Enter placement mode with selected tile
        this.enterPlacementMode(tile);
    }
    
    handleTileDragStart(event) {
        const { tile, index } = event.detail;
        
        // Show valid placement positions
        const validPositions = this.gameState.getValidPlacementPositions(tile);
        this.renderer.highlightValidPlacements(validPositions);
        
        // Store the dragged tile
        this.draggedTile = tile;
        this.draggedTileIndex = index;
    }
    
    handleTileDragEnd(event) {
        const { tile, index } = event.detail;
        
        // Clear highlights
        this.renderer.clearHighlights();
        
        // Clear dragged tile
        this.draggedTile = null;
        this.draggedTileIndex = null;
    }
    
    handleCanvasDrop(event) {
        // Check for worker drag data
        const dragData = event.dataTransfer.getData('text/plain');
        if (dragData) {
            try {
                const data = JSON.parse(dragData);
                if (data.type === 'worker' && data.workerId) {
                    // Handle worker drop
                    this.handleWorkerDrop(event, data.workerId);
                    return;
                }
            } catch (error) {
                console.error('Error parsing drag data:', error);
            }
        }
        
        // Handle tile drop (existing logic)
        if (!this.draggedTile) return;
        
        // Get drop position relative to canvas
        const rect = event.target.getBoundingClientRect();
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;
        
        // Convert canvas coordinates to world coordinates
        const worldCoords = this.renderer.viewport.toWorld(canvasX, canvasY);
        
        // Convert world coordinates to grid coordinates
        const gridX = Math.floor(worldCoords.x / GameConfig.TILE_SIZE);
        const gridY = Math.floor(worldCoords.y / GameConfig.TILE_SIZE);
        
        // Attempt to place the tile
        const success = this.gameState.placeTile(gridX, gridY, this.draggedTile);
        
        if (success) {
            // Remove from tile bank
            this.tileSystem.removeTileFromBank(this.draggedTile);
            
            // Clear bank selection
            this.tileSystem.clearBankSelection();
            
            // Exit placement mode if active
            if (this.isPlacementMode) {
                this.exitPlacementMode();
            }
        } else {
            // Show error feedback
            this.showPlacementError(gridX, gridY);
        }
    }
    
    handleWorkerDrop(event, workerId) {
        // Get drop position relative to canvas
        const rect = event.target.getBoundingClientRect();
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;
        
        // Convert canvas coordinates to world coordinates
        const worldCoords = this.renderer.viewport.toWorld(canvasX, canvasY);
        
        // Convert world coordinates to grid coordinates
        const gridX = Math.floor(worldCoords.x / GameConfig.TILE_SIZE);
        const gridY = Math.floor(worldCoords.y / GameConfig.TILE_SIZE);
        
        const tileKey = `${gridX},${gridY}`;
        
        // Attempt to place the worker
        const success = this.gameState.placeWorker(workerId, tileKey);
        
        if (success) {
            console.log(`Worker ${workerId} placed on tile at (${gridX}, ${gridY})`);
            
            // Update UI
            this.updateWorkerUI();
        } else {
            console.log(`Failed to place worker ${workerId} on tile at (${gridX}, ${gridY})`);
        }
    }
    
    handleWorkerDragStart(event) {
        const { workerId } = event.detail;
        
        // Show valid placement positions for workers
        const validPositions = this.getValidWorkerPlacements(workerId);
        this.highlightValidWorkerPlacements(validPositions);
        
        console.log(`Worker ${workerId} drag started`);
    }
    
    handleWorkerDragEnd(event) {
        const { workerId } = event.detail;
        
        // Clear valid placement highlights
        this.clearValidWorkerPlacements();
        
        console.log(`Worker ${workerId} drag ended`);
    }
    
    handleWorkerRecallRequest(event) {
        const { workerId } = event.detail;
        
        // Recall the worker
        const success = this.gameState.recallWorker(workerId);
        
        if (success) {
            console.log(`Worker ${workerId} recalled successfully`);
            
            // Update UI
            this.updateWorkerUI();
        } else {
            console.log(`Failed to recall worker ${workerId}`);
        }
    }
    
    getValidWorkerPlacements(workerId) {
        const currentPlayer = this.gameState.getCurrentPlayer();
        if (!currentPlayer) return [];
        
        const validPositions = [];
        
        // Check all tiles owned by current player
        for (const [tileKey, tile] of this.gameState.tiles.entries()) {
            if (tile.owner === currentPlayer.id) {
                const tileStats = GameConfig.TILE_STATS[tile.type];
                if (tileStats && tileStats.workerCapacity > 0) {
                    // Check if tile has available worker slots
                    const workersOnTile = this.gameState.getWorkersOnTile(tileKey);
                    if (workersOnTile.length < tileStats.workerCapacity) {
                        validPositions.push({ x: tile.x, y: tile.y });
                    }
                }
            }
        }
        
        return validPositions;
    }
    
    highlightValidWorkerPlacements(positions) {
        // TODO: Implement tile highlighting in renderer
        console.log('Highlighting valid worker placements:', positions);
    }
    
    clearValidWorkerPlacements() {
        // TODO: Clear tile highlights in renderer
        console.log('Clearing valid worker placement highlights');
    }
    
    updateWorkerUI() {
        // Update worker display in UI manager
        if (this.uiManager && this.uiManager.updateWorkerDisplay) {
            this.uiManager.updateWorkerDisplay(this.gameState);
        }
    }
    
    handleTileClick(event) {
        const { x, y } = event.detail;
        
        // Check for worker placement first
        if (this.uiManager && this.uiManager.handleTileClickForWorkerPlacement(x, y)) {
            return; // Worker was placed, don't continue with tile placement
        }
        
        if (this.isPlacementMode && this.selectedTileForPlacement) {
            // Attempt to place the selected tile
            const success = this.gameState.placeTile(x, y, this.selectedTileForPlacement);
            
            if (success) {
                // Remove from tile bank
                this.tileSystem.removeTileFromBank(this.selectedTileForPlacement);
                
                // Exit placement mode
                this.exitPlacementMode();
            } else {
                console.log('Tile placement failed');
                // Show error feedback
                this.showPlacementError(x, y);
            }
        } else {
            console.log('Not in placement mode or no tile selected');
        }
    }
    
    handleTilePlaced(event) {
        const { x, y, tile } = event.detail;
        // Update renderer
        this.renderer.renderTile(x, y, tile);
        
        // Update resources if tile produces resources
        if (tile.resources) {
            this.resourceManager.addResources(tile.owner, tile.resources);
        }
    }
    
    enterPlacementMode(tile) {
        this.selectedTileForPlacement = tile;
        this.isPlacementMode = true;
        
        // Show valid placement positions
        const validPositions = this.gameState.getValidPlacementPositions(tile);
        this.renderer.highlightValidPlacements(validPositions);
        
        // Update UI to show placement mode
        this.uiManager.showPlacementMode(tile);
    }
    
    exitPlacementMode() {
        this.selectedTileForPlacement = null;
        this.isPlacementMode = false;
        
        // Clear valid placement highlights
        this.renderer.clearHighlights();
        
        // Clear dragged tile
        this.draggedTile = null;
        this.draggedTileIndex = null;
        
        // Clear bank selection
        this.tileSystem.clearBankSelection();
        
        // Update UI
        this.uiManager.hidePlacementMode();
    }
    
    showPlacementError(x, y) {
        // Show visual error feedback
        this.renderer.showPlacementError(x, y);
        
        // Show UI error message
        this.uiManager.showError('Invalid tile placement!');
    }
    
    // Method to be called when user selects a tile from the bank
    selectTileForPlacement(tile) {
        if (this.isPlacementMode) {
            this.exitPlacementMode();
        }
        
        this.enterPlacementMode(tile);
    }
    
    start() {
        if (this.paused) {
            this.paused = false;
        }
        
        // Start systems
        this.resourceManager.start();
        this.tileSystem.start();
        
        // Initialize worker UI
        this.updateWorkerUI();
        
        // Start game loop
        requestAnimationFrame(this.gameLoop);
        
        console.log('Game started');
    }
    
    pause() {
        this.paused = true;
        
        // Pause systems
        this.resourceManager.pause();
        this.tileSystem.pause();
        
        console.log('Game paused');
    }
    
    gameLoop(currentTime) {
        if (this.paused) return;
        
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // Update game systems
        this.update(deltaTime);
        
        // Render
        this.render();
        
        // Continue loop
        requestAnimationFrame(this.gameLoop);
    }
    
    update(deltaTime) {
        // Update game state
        this.gameState.update(deltaTime);
        
        // Update systems
        this.resourceManager.update(deltaTime);
        this.tileSystem.update(deltaTime);
        this.unitSystem.update(deltaTime);
        
        // Update UI
        this.uiManager.update(deltaTime);
    }
    
    render() {
        // Clear renderer
        this.renderer.clear();
        
        // Render game elements
        this.renderer.renderTiles(this.gameState.tiles);
        this.renderer.renderUnits(this.gameState.units);
        this.renderer.renderWorkers(this.gameState.workers);
        
        // Render UI elements
        this.renderer.renderUI(this.gameState);
        
        // Present frame
        this.renderer.present();
    }
    
    handleResize() {
        if (this.renderer) {
            this.renderer.handleResize();
        }
    }
    
    cleanup() {
        console.log('Cleaning up game...');
        
        // Remove event listeners
        window.removeEventListener('resize', this.handleResize);
        
        // Cleanup systems
        if (this.resourceManager) {
            this.resourceManager.cleanup();
        }
        if (this.tileSystem) {
            this.tileSystem.cleanup();
        }
        if (this.unitSystem) {
            this.unitSystem.cleanup();
        }
        if (this.websocketClient) {
            this.websocketClient.disconnect();
        }
        if (this.renderer) {
            this.renderer.cleanup();
        }
        
        // Save final game state and cleanup auto-save
        if (this.gameState) {
            this.gameState.saveToLocalStorage();
            this.gameState.disableAutoSave();
        }
        
        console.log('Game cleanup complete');
    }
    
    stop() {
        console.log('Stopping game and cleaning up timers...');
        
        // Stop all tile system timers
        if (this.tileSystem) {
            this.tileSystem.stopPlacementCycle();
        }
        
        // Stop resource manager
        if (this.resourceManager) {
            this.resourceManager.stopResourceLoop();
        }
        
        // Stop autosave timer
        if (this.gameState && this.gameState.autoSaveInterval) {
            clearInterval(this.gameState.autoSaveInterval);
            this.gameState.autoSaveInterval = null;
        }
        
        // Exit placement mode
        this.exitPlacementMode();
        
        console.log('Game stopped and timers cleaned up');
    }
    
    // Game actions
    placeTile(x, y, tileData) {
        return this.tileSystem.placeTile(x, y, tileData);
    }
    
    placeWorker(x, y, workerType) {
        return this.tileSystem.placeWorker(x, y, workerType);
    }
    
    recallWorker(workerId) {
        return this.tileSystem.recallWorker(workerId);
    }
    
    trainUnit(tileId, unitType) {
        return this.unitSystem.trainUnit(tileId, unitType);
    }
    
    moveUnit(unitId, targetX, targetY) {
        return this.unitSystem.moveUnit(unitId, targetX, targetY);
    }
    
    // Getters for game state
    getGameState() {
        return this.gameState;
    }
    
    getPlayerResources(playerId) {
        return this.resourceManager.getPlayerResources(playerId);
    }
    
    canAfford(playerId, cost) {
        return this.resourceManager.canAfford(playerId, cost);
    }
} 