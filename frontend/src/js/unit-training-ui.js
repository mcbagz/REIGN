// Unit Training UI Component
class UnitTrainingUI {
    constructor(gameState, unitSystem) {
        console.log('=== INITIALIZING UNIT TRAINING UI ===');
        
        this.gameState = gameState;
        this.unitSystem = unitSystem;
        this.trainingQueue = new Map();
        this.trainingTimers = new Map(); // tileId -> timer
        this.isVisible = false;
        this.currentTile = null;
        this.clickOutsideEnabled = true;
        
        console.log('Creating context menu and modal...');
        this.createContextMenu();
        this.createTrainingModal();
        
        console.log('Setting up event listeners...');
        this.setupEventListeners();
        
        console.log('Unit Training UI initialized successfully');
    }
    
    createContextMenu() {
        console.log('Creating context menu DOM element...');
        
        // Create context menu DOM element
        this.contextMenu = document.createElement('div');
        this.contextMenu.id = 'unit-training-context-menu';
        this.contextMenu.className = 'unit-training-context-menu';
        this.contextMenu.innerHTML = `
            <div class="context-menu-header">
                <h3>Train Unit</h3>
                <button class="close-btn">&times;</button>
            </div>
            <div class="context-menu-body">
                <div class="unit-options" id="unit-options">
                    <!-- Units will be populated here -->
                </div>
            </div>
        `;
        
        console.log('Context menu element created:', this.contextMenu);
        
        // Add CSS
        const style = document.createElement('style');
        style.textContent = `
            .unit-training-context-menu {
                position: fixed;
                background: rgba(0, 0, 0, 0.95);
                border: 2px solid #4a5568;
                border-radius: 8px;
                padding: 12px;
                min-width: 200px;
                max-width: 300px;
                z-index: 10000;
                display: none;
                color: white;
                font-family: Arial, sans-serif;
                font-size: 14px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(5px);
            }
            
            .context-menu-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
                padding-bottom: 8px;
                border-bottom: 1px solid #4a5568;
            }
            
            .context-menu-header h3 {
                margin: 0;
                font-size: 16px;
                color: #f7fafc;
            }
            
            .close-btn {
                background: none;
                border: none;
                color: #a0aec0;
                font-size: 18px;
                cursor: pointer;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .close-btn:hover {
                color: #f7fafc;
            }
            
            .unit-option {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 12px;
                margin: 4px 0;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .unit-option:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            
            .unit-option.disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .unit-option.disabled:hover {
                background: rgba(255, 255, 255, 0.1);
            }
            
            .unit-info {
                display: flex;
                flex-direction: column;
                flex: 1;
            }
            
            .unit-name {
                font-weight: bold;
                color: #f7fafc;
                margin-bottom: 2px;
            }
            
            .unit-stats {
                font-size: 12px;
                color: #a0aec0;
            }
            
            .unit-cost {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-left: 8px;
            }
            
            .cost-item {
                display: flex;
                align-items: center;
                gap: 2px;
                font-size: 12px;
            }
            
            .cost-gold { color: #f6e05e; }
            .cost-food { color: #68d391; }
            .cost-faith { color: #9f7aea; }
            
            .training-progress {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(59, 130, 246, 0.8);
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: 12px;
            }
            
            .training-tile-indicator {
                position: absolute;
                top: -20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(59, 130, 246, 0.9);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
                white-space: nowrap;
                z-index: 10;
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(this.contextMenu);
        
        console.log('Context menu added to document body');
    }
    
    createTrainingModal() {
        // Create training progress modal
        this.trainingModal = document.createElement('div');
        this.trainingModal.id = 'training-modal';
        this.trainingModal.className = 'modal';
        this.trainingModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Unit Training</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="training-queue-display">
                        <!-- Training queue will be populated here -->
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.trainingModal);
    }
    
    setupEventListeners() {
        // Close context menu
        this.contextMenu.querySelector('.close-btn').addEventListener('click', () => {
            this.hideContextMenu();
        });
        
        // Close modal
        this.trainingModal.querySelector('.close-btn').addEventListener('click', () => {
            this.hideTrainingModal();
        });
        
        // Close context menu when clicking outside
        document.addEventListener('click', (event) => {
            if (this.isVisible && !this.contextMenu.contains(event.target) && this.clickOutsideEnabled) {
                console.log('Click outside detected, hiding context menu');
                this.hideContextMenu();
            }
        });
        
        // Close context menu on escape key
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.isVisible) {
                console.log('Escape key pressed, hiding context menu');
                this.hideContextMenu();
            }
        });
        
        // Handle double-click events for training menu
        window.addEventListener('tile:doubleclick', (event) => {
            const { x, y, tile, event: originalEvent } = event.detail;
            
            console.log(`Double-click event received at (${x}, ${y}) for tile:`, tile);
            
            // Prevent the double-click from triggering other click handlers
            if (originalEvent) {
                originalEvent.preventDefault();
                originalEvent.stopPropagation();
            }
            
            if (this.canTileTrainUnits(tile)) {
                console.log(`Tile can train units, showing context menu...`);
                this.showContextMenu(x, y, tile);
                
                // Disable click-outside handler temporarily to prevent immediate closing
                this.disableClickOutsideHandler();
                
                // Re-enable click-outside handler after a longer delay
                setTimeout(() => {
                    this.enableClickOutsideHandler();
                }, 500); // Increased delay to 500ms
            } else {
                console.log(`Tile cannot train units:`, tile.type);
            }
        });
        
        // Test function - press 'T' to test context menu
        document.addEventListener('keydown', (event) => {
            if (event.key === 't' || event.key === 'T') {
                this.testContextMenu();
            }
            if (event.key === 'r' || event.key === 'R') {
                this.testRealContextMenu();
            }
        });
        
        // Listen for training completion
        window.addEventListener('unit:training:complete', (e) => {
            const { tileId, unit } = e.detail;
            this.handleTrainingComplete(tileId, unit);
        });
        
        // Listen for server unit updates to clear training state
        window.addEventListener('server:unit:update', (e) => {
            const { units } = e.detail;
            this.handleServerUnitUpdate(units);
        });

        // Listen for server confirmation of training started
        document.addEventListener('unitTrainingStarted', (event) => {
            const { tileId } = event.detail;
            
            // Clear the frontend training indicator
            this.clearTrainingState(tileId);
            console.log(`Training confirmed by server for tile ${tileId}, clearing frontend indicator`);
        });
    }
    
    testRealContextMenu() {
        console.log('=== Testing Real Context Menu ===');
        
        // Create a test tile that can train units
        const testTile = {
            id: 'test-barracks',
            type: 'barracks',
            owner: 0,
            x: 15,
            y: 15
        };
        
        console.log('Showing real context menu for barracks...');
        
        // Disable click-outside handler
        this.disableClickOutsideHandler();
        
        // Show the real context menu
        this.showContextMenu(15, 15, testTile);
        
        // Re-enable click-outside handler after a delay
        setTimeout(() => {
            this.enableClickOutsideHandler();
        }, 1000);
        
        console.log('Real context menu test completed');
    }
    
    disableClickOutsideHandler() {
        this.clickOutsideEnabled = false;
        console.log('Click-outside handler disabled');
    }
    
    enableClickOutsideHandler() {
        this.clickOutsideEnabled = true;
        console.log('Click-outside handler enabled');
    }
    
    handleTileDoubleClick(x, y, tile) {
        console.log(`Double-click on tile at (${x}, ${y}): ${tile.type}`);
        
        // Check if tile can train units
        if (!this.canTileTrainUnits(tile)) {
            console.log(`Tile type '${tile.type}' cannot train units`);
            return;
        }
        
        this.currentTile = { x, y, tile };
        this.showContextMenu(x, y, tile);
    }
    
    canTileTrainUnits(tile) {
        // Check if tile type can train units
        const trainingTiles = ['capital_city', 'city', 'barracks'];
        return trainingTiles.includes(tile.type);
    }
    
    showContextMenu(x, y, tile) {
        console.log(`=== SHOWING CONTEXT MENU ===`);
        console.log(`Position: (${x}, ${y}), Tile:`, tile);
        
        // Set current tile information
        this.currentTile = { x, y, ...tile };
        
        // Get available units for this tile
        const availableUnits = this.getAvailableUnits(tile);
        console.log(`Available units:`, availableUnits);
        
        // Populate unit options
        const unitOptions = this.contextMenu.querySelector('#unit-options');
        unitOptions.innerHTML = '';
        
        for (const unitType of availableUnits) {
            const unitOption = this.createUnitOption(unitType, tile, x, y);
            if (unitOption) { // Only append if unitOption was created successfully
                unitOptions.appendChild(unitOption);
            }
        }
        
        // Position context menu
        const canvas = document.querySelector('#game-canvas-container canvas');
        const rect = canvas.getBoundingClientRect();
        const worldX = x * GameConfig.TILE_SIZE;
        const worldY = y * GameConfig.TILE_SIZE;
        
        // Convert world coordinates to screen coordinates using viewport
        const screenCoords = this.unitSystem.renderer.viewport.toScreen(worldX, worldY);
        
        // Position menu near the tile but ensure it stays within viewport
        let menuX = rect.left + screenCoords.x + 20; // Offset to the right
        let menuY = rect.top + screenCoords.y - 20; // Offset upward
        
        // Ensure menu doesn't go off-screen
        const menuWidth = 250; // Approximate menu width
        const menuHeight = 200; // Approximate menu height
        
        if (menuX + menuWidth > window.innerWidth) {
            menuX = window.innerWidth - menuWidth - 10;
        }
        if (menuY + menuHeight > window.innerHeight) {
            menuY = window.innerHeight - menuHeight - 10;
        }
        if (menuX < 0) menuX = 10;
        if (menuY < 0) menuY = 10;
        
        // Apply styles and show menu
        this.contextMenu.style.left = menuX + 'px';
        this.contextMenu.style.top = menuY + 'px';
        this.contextMenu.style.display = 'block';
        this.contextMenu.style.zIndex = '10000'; // Ensure it appears above everything
        
        this.isVisible = true;
        
        console.log(`Context menu displayed at (${menuX}, ${menuY}), visibility:`, this.isVisible);
        console.log(`Menu element:`, this.contextMenu);
        console.log(`Menu computed style:`, window.getComputedStyle(this.contextMenu));
    }
    
    getAvailableUnits(tile) {
        // Get units available for training based on tile type and tech level
        const currentPlayer = this.gameState.getCurrentPlayer();
        const techLevel = currentPlayer.techLevel;
        
        const unitsByTech = {
            manor: ['infantry', 'archer'],
            duchy: ['infantry', 'archer', 'knight'],
            kingdom: ['infantry', 'archer', 'knight', 'siege']
        };
        
        let availableUnits = unitsByTech[techLevel] || unitsByTech.manor;
        
        // Filter based on tile type
        if (tile.type === 'barracks') {
            // Barracks can train all unit types
            return availableUnits;
        } else if (tile.type === 'capital_city' || tile.type === 'city') {
            // Cities can train basic units
            return availableUnits;
        }
        
        return availableUnits;
    }
    
    createUnitOption(unitType, tile, x, y) {
        try {
            const unitStats = GameConfig.UNIT_STATS[unitType];
            if (!unitStats) {
                console.error(`Unit stats not found for type: ${unitType}`);
                return null;
            }
            
            const currentPlayer = this.gameState.getCurrentPlayer();
            if (!currentPlayer) {
                console.error('No current player found');
                return null;
            }
            
            const canAfford = this.canAffordUnit(unitStats.cost, currentPlayer.resources);
            
            const unitOption = document.createElement('div');
            unitOption.className = `unit-option ${canAfford ? '' : 'disabled'}`;
            
            // Check if already training
            const tileKey = `${x},${y}`;
            const isTraining = this.trainingQueue.has(tileKey);
            
            unitOption.innerHTML = `
                <div class="unit-info">
                    <div class="unit-name">${unitType.charAt(0).toUpperCase() + unitType.slice(1)}</div>
                    <div class="unit-stats">
                        HP: ${unitStats.hp} | ATK: ${unitStats.attack} | RNG: ${unitStats.range}
                    </div>
                </div>
                <div class="unit-cost">
                    ${unitStats.cost.gold > 0 ? `<span class="cost-item cost-gold">⚀ ${unitStats.cost.gold}</span>` : ''}
                    ${unitStats.cost.food > 0 ? `<span class="cost-item cost-food">🌾 ${unitStats.cost.food}</span>` : ''}
                    ${unitStats.cost.faith > 0 ? `<span class="cost-item cost-faith">✦ ${unitStats.cost.faith}</span>` : ''}
                </div>
                ${isTraining ? '<div class="training-progress">Training...</div>' : ''}
            `;
            
            if (canAfford && !isTraining) {
                unitOption.addEventListener('click', () => {
                    this.startTraining(unitType, tile, x, y);
                });
            }
            
            console.log(`Created unit option for ${unitType} at (${x}, ${y})`);
            return unitOption;
            
        } catch (error) {
            console.error('Error creating unit option:', error);
            return null;
        }
    }
    
    canAffordUnit(cost, resources) {
        return resources.gold >= cost.gold && 
               resources.food >= cost.food && 
               resources.faith >= (cost.faith || 0);
    }
    
    startTraining(unitType, tile, x, y) {
        const tileKey = `${x},${y}`;
        const unitStats = GameConfig.UNIT_STATS[unitType];
        const currentPlayer = this.gameState.getCurrentPlayer();
        
        // Check if can afford
        if (!this.canAffordUnit(unitStats.cost, currentPlayer.resources)) {
            this.showError('Not enough resources!');
            return;
        }
        
        // Check if already training
        if (this.trainingQueue.has(tileKey)) {
            this.showError('Already training a unit at this location!');
            return;
        }
        
        // Send training request to server
        this.sendTrainingRequest(unitType, tile.id, x, y);
        
        // Hide context menu
        this.hideContextMenu();
        
        console.log(`Requested training ${unitType} at (${x}, ${y}) for tile ${tile.id}`);
    }
    
    sendTrainingRequest(unitType, tileId, x, y) {
        // Get websocket client from game instance
        const websocketClient = window.gameInstance?.websocketClient;
        if (!websocketClient) {
            console.error('WebSocket client not available for unit training');
            this.showError('Cannot connect to server');
            return;
        }
        
        const command = {
            type: "cmd",
            payload: {
                action: "trainUnit",
                data: {
                    unit_type: unitType,
                    tile_id: tileId
                }
            }
        };
        
        console.log(`Sending unit training command:`, command);
        websocketClient.send(command);
        
        // Show training indicator on tile (optimistic UI)
        this.showTrainingIndicator(x, y);
        
        // Mark as training locally (will be confirmed by server)
        const tileKey = `${x},${y}`;
        this.trainingQueue.set(tileKey, {
            unitType,
            tileId,
            startTime: Date.now(),
            pending: true  // Mark as pending server confirmation
        });
    }
    
    completeTraining(tileKey) {
        const trainingInfo = this.trainingQueue.get(tileKey);
        if (!trainingInfo) return;
        
        const [x, y] = tileKey.split(',').map(Number);
        
        // Create unit
        const unitId = `unit-${Date.now()}`;
        const unit = {
            id: unitId,
            type: trainingInfo.unitType,
            owner: this.gameState.currentPlayer,
            position: { x, y },
            ...GameConfig.UNIT_STATS[trainingInfo.unitType],
            maxHp: GameConfig.UNIT_STATS[trainingInfo.unitType].hp,
            status: 'idle'
        };
        
        // Add to unit system
        this.unitSystem.createUnit(unit);
        
        // Add to game state
        this.gameState.units.set(unitId, unit);
        
        // Clean up training
        this.trainingQueue.delete(tileKey);
        this.trainingTimers.delete(tileKey);
        
        // Remove training indicator
        this.hideTrainingIndicator(x, y);
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('unit:training:complete', {
            detail: { tileId: tileKey, unit }
        }));
        
        console.log(`Completed training ${trainingInfo.unitType} at (${x}, ${y})`);
    }
    
    handleServerUnitUpdate(units) {
        console.log('Handling server unit update for training UI:', units);
        
        // Clear training indicators for any units that now exist on the server
        units.forEach(unit => {
            // Handle both flat and nested position formats
            const unitX = unit.x !== undefined ? unit.x : unit.position?.x;
            const unitY = unit.y !== undefined ? unit.y : unit.position?.y;
            const tileKey = `${unitX},${unitY}`;
            
            // If we have a training indicator for this position, clear it
            if (this.trainingQueue.has(tileKey)) {
                console.log(`Clearing training indicator for tile ${tileKey} - unit now exists`);
                this.trainingQueue.delete(tileKey);
                this.hideTrainingIndicator(unitX, unitY);
                
                // Clear any timers
                if (this.trainingTimers.has(tileKey)) {
                    clearTimeout(this.trainingTimers.get(tileKey));
                    this.trainingTimers.delete(tileKey);
                }
            }
        });
    }
    
    showTrainingIndicator(x, y) {
        // Create visual indicator on tile
        const indicator = document.createElement('div');
        indicator.className = 'training-tile-indicator';
        indicator.textContent = 'Training...';
        indicator.id = `training-indicator-${x}-${y}`;
        
        // Position on tile (this would need adjustment based on actual tile positioning)
        document.body.appendChild(indicator);
    }
    
    hideTrainingIndicator(x, y) {
        const indicator = document.getElementById(`training-indicator-${x}-${y}`);
        if (indicator) {
            indicator.remove();
        }
    }

    clearTrainingState(tileId) {
        const trainingInfo = this.trainingQueue.get(tileId);
        if (!trainingInfo) return;

        const [x, y] = tileId.split(',').map(Number);

        // Clear timer
        const timer = this.trainingTimers.get(tileId);
        if (timer) {
            clearTimeout(timer);
            this.trainingTimers.delete(tileId);
        }

        // Remove from queue
        this.trainingQueue.delete(tileId);

        // Refund resources (partial)
        const currentPlayer = this.gameState.getCurrentPlayer();
        const refundRate = 0.5; // 50% refund
        const unitStats = GameConfig.UNIT_STATS[trainingInfo.unitType];

        currentPlayer.resources.gold += Math.floor(unitStats.cost.gold * refundRate);
        currentPlayer.resources.food += Math.floor(unitStats.cost.food * refundRate);
        currentPlayer.resources.faith += Math.floor((unitStats.cost.faith || 0) * refundRate);

        // Remove training indicator
        this.hideTrainingIndicator(x, y);

        console.log(`Cleared training state for tile ${tileId}`);
    }
    
    showError(message) {
        // Create error notification
        const error = document.createElement('div');
        error.className = 'error-notification';
        error.textContent = message;
        error.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #e53e3e;
            color: white;
            padding: 12px 16px;
            border-radius: 4px;
            z-index: 2000;
            font-weight: bold;
        `;
        
        document.body.appendChild(error);
        
        setTimeout(() => {
            error.remove();
        }, 3000);
    }
    
    hideContextMenu() {
        console.log(`=== HIDING CONTEXT MENU ===`);
        console.log(`Was visible:`, this.isVisible);
        
        this.contextMenu.style.display = 'none';
        this.contextMenu.style.transform = 'none'; // Reset transform
        this.isVisible = false;
        this.currentTile = null;
        
        console.log(`Context menu hidden, visibility:`, this.isVisible);
    }
    
    showTrainingModal() {
        this.trainingModal.style.display = 'block';
        this.updateTrainingQueueDisplay();
    }
    
    hideTrainingModal() {
        this.trainingModal.style.display = 'none';
    }
    
    updateTrainingQueueDisplay() {
        const display = this.trainingModal.querySelector('#training-queue-display');
        display.innerHTML = '';
        
        for (const [tileKey, trainingInfo] of this.trainingQueue) {
            const [x, y] = tileKey.split(',').map(Number);
            const elapsed = Date.now() - trainingInfo.startTime;
            const progress = Math.min(elapsed / trainingInfo.duration, 1);
            
            const item = document.createElement('div');
            item.className = 'training-queue-item';
            item.innerHTML = `
                <div class="training-item-header">
                    <span>${trainingInfo.unitType.charAt(0).toUpperCase() + trainingInfo.unitType.slice(1)}</span>
                    <span>at (${x}, ${y})</span>
                </div>
                <div class="training-progress-bar">
                    <div class="progress-fill" style="width: ${progress * 100}%"></div>
                </div>
                <div class="training-time">${Math.ceil((trainingInfo.duration - elapsed) / 1000)}s remaining</div>
            `;
            
            display.appendChild(item);
        }
    }
    
    update(deltaTime) {
        // Update training progress
        if (this.trainingModal.style.display === 'block') {
            this.updateTrainingQueueDisplay();
        }
    }
    
    handleTrainingComplete(tileId, unit) {
        console.log(`Training complete for ${unit.type} at ${tileId}`);
    }
    
    cancelTraining(tileKey) {
        const trainingInfo = this.trainingQueue.get(tileKey);
        if (!trainingInfo) return;
        
        // Clear timer
        const timer = this.trainingTimers.get(tileKey);
        if (timer) {
            clearTimeout(timer);
            this.trainingTimers.delete(tileKey);
        }
        
        // Remove from queue
        this.trainingQueue.delete(tileKey);
        
        // Refund resources (partial)
        const currentPlayer = this.gameState.getCurrentPlayer();
        const refundRate = 0.5; // 50% refund
        const unitStats = GameConfig.UNIT_STATS[trainingInfo.unitType];
        
        currentPlayer.resources.gold += Math.floor(unitStats.cost.gold * refundRate);
        currentPlayer.resources.food += Math.floor(unitStats.cost.food * refundRate);
        currentPlayer.resources.faith += Math.floor((unitStats.cost.faith || 0) * refundRate);
        
        // Remove training indicator
        const [x, y] = tileKey.split(',').map(Number);
        this.hideTrainingIndicator(x, y);
        
        console.log(`Cancelled training at ${tileKey}`);
    }
    
    testContextMenu() {
        console.log('=== Testing Context Menu ===');
        
        // Create a test tile
        const testTile = {
            type: 'barracks',
            owner: 0,
            x: 15,
            y: 15
        };
        
        console.log('Creating test context menu for barracks...');
        
        // Clear any existing menu content
        const unitOptions = this.contextMenu.querySelector('#unit-options');
        if (unitOptions) {
            unitOptions.innerHTML = '';
        }
        
        // Create test content
        const testContent = document.createElement('div');
        testContent.innerHTML = `
            <div style="color: white; padding: 10px; text-align: center;">
                <h4>Test Menu</h4>
                <p>This is a test context menu for barracks.</p>
                <button onclick="this.closest('.unit-training-context-menu').style.display='none'" 
                        style="background: #4a5568; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">
                    Close Test Menu
                </button>
                <br><br>
                <small>Press ESC to close</small>
            </div>
        `;
        
        if (unitOptions) {
            unitOptions.appendChild(testContent);
        }
        
        // Position at center of screen
        this.contextMenu.style.left = '50%';
        this.contextMenu.style.top = '50%';
        this.contextMenu.style.transform = 'translate(-50%, -50%)';
        this.contextMenu.style.display = 'block';
        this.contextMenu.style.zIndex = '10000';
        this.contextMenu.style.position = 'fixed';
        
        this.isVisible = true;
        
        console.log('Test context menu should now be visible at center of screen');
    }
    
    getTrainingProgress(tileKey) {
        const trainingInfo = this.trainingQueue.get(tileKey);
        if (!trainingInfo) return 0;
        
        const elapsed = Date.now() - trainingInfo.startTime;
        return Math.min(elapsed / trainingInfo.duration, 1);
    }
    
    isTraining(tileKey) {
        return this.trainingQueue.has(tileKey);
    }
    
    cleanup() {
        // Clear all timers
        for (const timer of this.trainingTimers.values()) {
            clearTimeout(timer);
        }
        
        this.trainingTimers.clear();
        this.trainingQueue.clear();
        
        // Remove DOM elements
        if (this.contextMenu) {
            this.contextMenu.remove();
        }
        
        if (this.trainingModal) {
            this.trainingModal.remove();
        }
    }
} 