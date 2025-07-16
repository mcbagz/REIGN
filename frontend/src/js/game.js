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
        
        // UI feedback components
        this.toastManager = null;
        this.cycleTimer = null;
        this.offlineBanner = null;
        
        // Debug components
        this.latencyMonitor = null;
        this.debugOverlay = null;
        
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
            // Make game instance available globally
            window.game = this;
            
            // Initialize game state
            this.gameState = new GameState(this.config);
            
            // Initialize renderer
            this.renderer = new GameRenderer();
            await this.renderer.init();
            
            // Set game state reference for renderer
            this.renderer.gameState = this.gameState;
            
            // Initialize tween system
            this.tweenSystem = new TweenSystem(this.renderer.app);
            
            // Initialize UI Manager
            this.uiManager = new UIManager();
            this.uiManager.tweenSystem = this.tweenSystem;
            this.uiManager.init(this.renderer);
            
            // Initialize UI feedback components
            this.toastManager = new ToastManager({
                position: 'top-right',
                maxVisible: 3,
                defaultDuration: 3000
            });
            
            // Connect toast manager to UI manager for error display
            this.uiManager.toastManager = this.toastManager;
            
            this.cycleTimer = new CycleTimer({
                position: 'top-center',
                baseTimePerPlayer: 15,
                maxPlayers: 4,
                minTime: 30,
                maxTime: 60
            });
            
            this.offlineBanner = new OfflineBanner({
                position: 'top',
                hideDelay: 5000,
                autoHide: true
            });
            
            // Initialize game systems
            this.tileSystem = new TileSystem(this.gameState);
            this.resourceManager = new ResourceManager(this.gameState);
            
            this.unitSystem = new UnitSystem(this.gameState, this.renderer, this.tweenSystem);
            
            // Initialize unit system
            await this.unitSystem.init();
            
            // Pass tween system to renderer for tile animations
            this.renderer.tweenSystem = this.tweenSystem;
            
            // Initialize unit training UI
            this.unitTrainingUI = new UnitTrainingUI(this.gameState, this.unitSystem);
            
            // Initialize unit commands system
            this.unitCommands = new UnitCommands(this.gameState, this.unitSystem);
            
            // Initialize multiplayer if needed
            if (this.config.mode === 'multiplayer') {
                this.websocketClient = new WebSocketClient();
                
                // Connect to WebSocket with matchmaking
                const playerName = `player_${Date.now()}`;
                const matchResult = await this.websocketClient.connectWithMatchmaking(playerName);
                console.log('Multiplayer matchmaking result:', matchResult);
                
                // Initialize debug components
                this.latencyMonitor = new LatencyMonitor(this.websocketClient);
                this.debugOverlay = new DebugOverlay(this.renderer.app, this.latencyMonitor, {
                    position: 'top-left'
                });
                
                // Set up WebSocket event handlers for UI feedback
                this.setupWebSocketEventHandlers();
            }
            
            // Set up game state
            this.setupInitialState();
            
                    // Set up event listeners
        this.setupEventListeners();
        
        // Add unit system event listeners
        this.setupUnitEventListeners();
            
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
        
        // Log tile creation summary
        console.log(`Created ${this.gameState.tiles.size} tiles on the map`);
        
        // Initialize resource manager
        this.resourceManager.initializeResources();
        
        // Enable auto-save
        this.gameState.enableAutoSave();
        
        // Render initial tiles
        this.renderer.renderTiles(this.gameState.tiles);
        
        // Create some test units for development
        this.createTestUnits();
        
        console.log('Initial game state set up complete');
    }
    
    createTestUnits() {
        // Create some test units for development
        if (!this.unitSystem || !this.unitSystem.initialized) return;
        
        const testUnits = [
            {
                id: 'test-unit-1',
                type: 'infantry',
                owner: 0,
                position: { x: 15, y: 15 },
                hp: 100,
                maxHp: 100,
                attack: 20,
                defense: 15,
                speed: 1.0,
                range: 1,
                status: 'idle'
            },
            {
                id: 'test-unit-2',
                type: 'archer',
                owner: 1,
                position: { x: 17, y: 15 },
                hp: 75,
                maxHp: 75,
                attack: 25,
                defense: 10,
                speed: 1.5,
                range: 2,
                status: 'idle'
            },
            {
                id: 'test-unit-3',
                type: 'knight',
                owner: 0,
                position: { x: 20, y: 20 },
                hp: 120,
                maxHp: 150,
                attack: 30,
                defense: 20,
                speed: 0.8,
                range: 1,
                status: 'idle'
            },
            {
                id: 'test-unit-4',
                type: 'siege',
                owner: 1,
                position: { x: 25, y: 25 },
                hp: 120,
                maxHp: 120,
                attack: 50,
                defense: 5,
                speed: 0.5,
                range: 2,
                status: 'idle'
            }
        ];
        
        for (const unit of testUnits) {
            this.unitSystem.createUnit(unit);
        }
        
        console.log('Created test units for development');
    }
    
    setupUnitEventListeners() {
        // Listen for unit selection events
        window.addEventListener('unit:selected', (event) => {
            const { unit } = event.detail;
            console.log('Unit selected:', unit);
            
            // Highlight selected unit (could add visual feedback here)
            this.selectedUnit = unit;
        });
        
        // Listen for unit training events
        window.addEventListener('unit:train', (event) => {
            const { tileId, unitType } = event.detail;
            console.log('Unit training requested:', { tileId, unitType });
            
            // This would send request to backend when WebSocket is implemented
        });
        
        console.log('Unit event listeners set up');
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
        
        // Add keyboard event listeners
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                // Exit placement mode on Escape key
                if (this.isPlacementMode) {
                    this.exitPlacementMode();
                }
            }
        });
        
        // Add right-click to cancel placement mode
        document.addEventListener('contextmenu', (event) => {
            if (this.isPlacementMode) {
                event.preventDefault();
                this.exitPlacementMode();
            }
        });
        
        // Debug key bindings
        document.addEventListener('keydown', (e) => {
            // Toggle tween system with backtick/tilde key
            if (e.key === '`' || e.key === '~') {
                if (this.tweenSystem) {
                    const isEnabled = !this.tweenSystem.isEnabled;
                    this.tweenSystem.setEnabled(isEnabled);
                    this.tweenSystem.setDebugMode(isEnabled);
                    console.log(`TweenSystem ${isEnabled ? 'enabled' : 'disabled'}`);
                    
                    // Show debug stats if enabled
                    if (isEnabled) {
                        console.log('TweenSystem Stats:', this.tweenSystem.getDebugStats());
                    }
                }
                
                // Also toggle debug overlay
                if (this.debugOverlay) {
                    this.debugOverlay.toggle();
                    const isVisible = this.debugOverlay.isOverlayVisible();
                    console.log(`DebugOverlay ${isVisible ? 'shown' : 'hidden'}`);
                    
                    // Show performance stats if enabled
                    if (isVisible) {
                        console.log('Performance Stats:', this.debugOverlay.getPerformanceStats());
                        console.log('Latency Metrics:', this.latencyMonitor.getMetrics());
                    }
                }
                
                e.preventDefault();
            }
        });
        
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
    
    setupWebSocketEventHandlers() {
        if (!this.websocketClient) return;
        
        // Handle WebSocket connection events
        this.websocketClient.on('connected', () => {
            console.log('WebSocket connected');
            this.offlineBanner.setConnectedState();
            
            // Start latency monitoring
            if (this.latencyMonitor) {
                this.latencyMonitor.start();
            }
        });
        
        this.websocketClient.on('disconnected', () => {
            console.log('WebSocket disconnected');
            this.offlineBanner.show('Connection lost', 'Disconnected');
            this.cycleTimer.pause();
            
            // Stop latency monitoring
            if (this.latencyMonitor) {
                this.latencyMonitor.stop();
            }
        });
        
        this.websocketClient.on('reconnecting', (attempts) => {
            console.log(`WebSocket reconnecting (attempt ${attempts})`);
            this.offlineBanner.show('Reconnecting...', `Reconnecting... (attempt ${attempts})`);
            this.offlineBanner.updateReconnectAttempts(attempts);
        });
        
        this.websocketClient.on('reconnected', () => {
            console.log('WebSocket reconnected');
            this.offlineBanner.setConnectedState();
            this.toastManager.showSuccess('Connection restored');
        });
        
        // Handle game state updates
        this.websocketClient.on('state', (gameState) => {
            console.log('Received game state update');
            
            // Update cycle timer based on players alive
            if (gameState.playersAlive !== undefined) {
                this.cycleTimer.updatePlayersAlive(gameState.playersAlive);
            }
            
            // Update debug overlay tick information
            if (this.debugOverlay && gameState.tick !== undefined) {
                this.debugOverlay.updateTick(gameState.tick);
            }
            
            // Handle any other state-based UI updates
            this.handleGameStateUpdate(gameState);
        });
        
        // Handle player action messages
        this.websocketClient.on('action', (actionMessage) => {
            console.log('Received action message:', actionMessage);
            
            if (actionMessage.msg && actionMessage.player) {
                this.toastManager.showActionToast(actionMessage.player, actionMessage.msg);
            } else if (actionMessage.msg) {
                this.toastManager.showInfo(actionMessage.msg);
            }
        });
        
        // Handle WebSocket errors
        this.websocketClient.on('error', (error) => {
            console.error('WebSocket error:', error);
            this.toastManager.showError('Connection error occurred');
        });
        
        // Handle connection events
        this.websocketClient.on('disconnected', (data) => {
            console.log('WebSocket disconnected:', data);
            this.offlineBanner.show();
            this.toastManager.showWarning('Connection lost');
        });
        
        // Handle successful connection
        this.websocketClient.socket.addEventListener('open', () => {
            console.log('WebSocket connected');
            this.offlineBanner.hide();
            this.toastManager.showSuccess('Connected to game');
        });
        
        // Set up offline banner reconnect handler
        this.offlineBanner.onReconnectClick(() => {
            if (this.websocketClient) {
                this.websocketClient.reconnect();
            }
        });
        
        // Set up cycle timer callbacks
        this.cycleTimer.onComplete(() => {
            this.handleCycleTimerComplete();
        });
        
        this.cycleTimer.onTick((currentTime, maxTime) => {
            this.handleCycleTimerTick(currentTime, maxTime);
        });
    }
    
    handleGameStateUpdate(gameState) {
        // Update game state
        if (this.gameState) {
            this.gameState.updateFromServer(gameState);
        }
        
        // Update UI components
        this.uiManager.updateFromGameState(gameState);
        
        // Update renderer
        if (this.renderer) {
            this.renderer.update(gameState);
        }
    }
    
    handleCycleTimerComplete() {
        console.log('Cycle timer completed');
        this.toastManager.showWarning('Time\'s up! Moving to next phase');
        
        // Handle end of placement phase
        if (this.isPlacementMode) {
            this.exitPlacementMode();
        }
        
        // Send time up event if in multiplayer
        if (this.websocketClient) {
            this.websocketClient.send({
                type: 'timeUp',
                timestamp: Date.now()
            });
        }
    }
    
    handleCycleTimerTick(currentTime, maxTime) {
        // Show warnings at specific time intervals
        if (currentTime === 10 && maxTime > 10) {
            this.toastManager.showWarning('10 seconds remaining!');
        } else if (currentTime === 5 && maxTime > 5) {
            this.toastManager.showWarning('5 seconds remaining!');
        }
    }
    
    startCycleTimer(duration = null) {
        if (this.cycleTimer) {
            this.cycleTimer.start(duration);
            console.log('Cycle timer started');
        }
    }
    
    stopCycleTimer() {
        if (this.cycleTimer) {
            this.cycleTimer.stop();
            console.log('Cycle timer stopped');
        }
    }
    
    pauseCycleTimer() {
        if (this.cycleTimer) {
            this.cycleTimer.pause();
            console.log('Cycle timer paused');
        }
    }
    
    resetCycleTimer() {
        if (this.cycleTimer) {
            this.cycleTimer.reset();
            console.log('Cycle timer reset');
        }
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
                console.log('Tile placed successfully');
                // Remove from tile bank
                this.tileSystem.removeTileFromBank(this.selectedTileForPlacement);
                
                // Exit placement mode
                this.exitPlacementMode();
            } else {
                console.log('Tile placement failed - but NOT exiting placement mode');
                // Show error feedback but don't exit placement mode
                this.showPlacementError(x, y);
                
                // Allow user to try again or manually exit placement mode
                // They can click outside the game area or press Escape to exit
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
        
        // Hide placement mode UI
        if (this.uiManager) {
            this.uiManager.hidePlacementMode();
        }
        
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
        
        // Update training UI
        if (this.unitTrainingUI) {
            this.unitTrainingUI.update(deltaTime);
        }
        
        // Update UI
        this.uiManager.update(deltaTime);
    }
    
    render() {
        // Clear renderer
        this.renderer.clear();
        
        // Render game elements
        this.renderer.renderTiles(this.gameState.tiles);
        // Units and workers are now rendered by their respective systems
        // this.renderer.renderUnits(this.gameState.units);
        // this.renderer.renderWorkers(this.gameState.workers);
        
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
        if (this.unitTrainingUI) {
            this.unitTrainingUI.cleanup();
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