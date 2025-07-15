// Tile System Class - Enhanced Implementation with Tile Offer Cycle
class TileSystem {
    constructor(gameState) {
        this.gameState = gameState;
        this.initialized = false;
        
        // Tile placement state
        this.placementInterval = null;
        this.currentTileOptions = [];
        this.tileBank = [];
        this.selectedTile = null;
        this.placementCallback = null;
        
        // Modal elements
        this.modal = null;
        this.tileOptionsContainer = null;
        this.selectionTimer = null;
        this.timerDisplay = null;
        
        console.log('TileSystem created');
    }
    
    start() {
        console.log('TileSystem started');
        this.initialized = true;
        this.initializeModal();
        this.startPlacementCycle();
        
        // Debug: Generate some initial tiles for testing
        this.currentTileOptions = this.generateTileOptions();
        
        // Add tiles directly to bank for immediate testing
        this.currentTileOptions.forEach(tile => {
            this.addToTileBank(tile);
        });
        
        // Also show the modal immediately for testing
        this.showTileOptions();
    }
    
    pause() {
        console.log('TileSystem paused');
        this.stopPlacementCycle();
    }
    
    initializeModal() {
        this.modal = document.getElementById('tile-selection-modal');
        this.tileOptionsContainer = document.getElementById('tile-options');
        this.timerDisplay = document.getElementById('selection-timer');
                
        if (!this.modal || !this.tileOptionsContainer || !this.timerDisplay) {
            console.error('Modal elements not found');
            console.error('- Modal:', this.modal);
            console.error('- Container:', this.tileOptionsContainer);
            console.error('- Timer:', this.timerDisplay);
            return;
        }
        
        // Setup modal event listeners
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });
    }
    
    startPlacementCycle() {
        // Add a counter to track cycles
        this.cycleCount = 0;
        
        // Start the 15-second cycle
        this.placementInterval = setInterval(() => {
            this.cycleCount++;
            this.showTileOptions();
        }, GameConfig.TILE_PLACEMENT_INTERVAL);
    }
    
    stopPlacementCycle() {
        if (this.placementInterval) {
            clearInterval(this.placementInterval);
            this.placementInterval = null;
        }
        
        if (this.selectionTimer) {
            clearInterval(this.selectionTimer);
            this.selectionTimer = null;
        }
        
        this.closeModal();
    }
    
    showTileOptions() {
        // Check if modal is already visible
        const isModalVisible = this.modal && !this.modal.classList.contains('hidden');
        
        if (isModalVisible) {
            return;
        }
        
        // Generate 3 random tile options
        this.currentTileOptions = this.generateTileOptions();
        
        // Update modal UI
        this.updateModalUI();
        
        // Show modal
        this.modal.classList.remove('hidden');
        
        // Start 15-second selection timer
        this.startSelectionTimer();
    }
    
    generateTileOptions() {
        const options = [];
        const tileTypes = Object.values(GameConfig.TILE_TYPES);
        
        // Filter out capital cities (only available during initialization)
        const availableTileTypes = tileTypes.filter(type => type !== GameConfig.TILE_TYPES.CAPITAL_CITY);
        
        for (let i = 0; i < 3; i++) {
            const randomType = availableTileTypes[Math.floor(Math.random() * availableTileTypes.length)];
            const tileOption = {
                id: `tile_${Date.now()}_${i}`,
                type: randomType,
                resources: this.getTileResources(randomType),
                hp: this.getTileHP(randomType),
                maxHp: this.getTileHP(randomType)
            };
            options.push(tileOption);
        }
        
        return options;
    }
    
    getTileResources(tileType) {
        const resourceMappings = {
            [GameConfig.TILE_TYPES.MINE]: { gold: 25, food: 0, faith: 0 },
            [GameConfig.TILE_TYPES.ORCHARD]: { gold: 0, food: 25, faith: 0 },
            [GameConfig.TILE_TYPES.MONASTERY]: { gold: 0, food: 0, faith: 25 },
            [GameConfig.TILE_TYPES.CITY]: { gold: 15, food: 15, faith: 0 },
            [GameConfig.TILE_TYPES.FIELD]: { gold: 0, food: 10, faith: 0 },
            [GameConfig.TILE_TYPES.BARRACKS]: { gold: 0, food: 0, faith: 0 },
            [GameConfig.TILE_TYPES.WATCHTOWER]: { gold: 0, food: 0, faith: 0 },
            [GameConfig.TILE_TYPES.MARSH]: { gold: 0, food: 0, faith: 0 }
        };
        
        return resourceMappings[tileType] || { gold: 0, food: 0, faith: 0 };
    }
    

    
    getTileHP(tileType) {
        const hpMappings = {
            [GameConfig.TILE_TYPES.CAPITAL_CITY]: 100,
            [GameConfig.TILE_TYPES.CITY]: 75,
            [GameConfig.TILE_TYPES.BARRACKS]: 80,
            [GameConfig.TILE_TYPES.WATCHTOWER]: 60,
            [GameConfig.TILE_TYPES.MONASTERY]: 50,
            [GameConfig.TILE_TYPES.MINE]: 40,
            [GameConfig.TILE_TYPES.ORCHARD]: 30,
            [GameConfig.TILE_TYPES.FIELD]: 25,
            [GameConfig.TILE_TYPES.MARSH]: 20
        };
        
        return hpMappings[tileType] || 25;
    }
    
    updateModalUI() {
        // Clear existing options
        this.tileOptionsContainer.innerHTML = '';

        // Create tile option elements
        this.currentTileOptions.forEach((tile, index) => {
            const tileElement = document.createElement('div');
            tileElement.className = 'tile-option';
            tileElement.setAttribute('data-tile-index', index);
            
            // Get tile visual info
            const symbol = this.getTileSymbol(tile.type);
            const color = this.getTileColor(tile.type);
            
            tileElement.innerHTML = `
                <div class="tile-preview" style="background-color: ${color}">
                    <div class="tile-symbol">${symbol}</div>
                    <div class="tile-type">${tile.type.replace('_', ' ')}</div>
                </div>
                <div class="tile-info">
                    <div class="tile-resources">
                        ${tile.resources.gold > 0 ? `<span class="resource gold">${tile.resources.gold}g</span>` : ''}
                        ${tile.resources.food > 0 ? `<span class="resource food">${tile.resources.food}f</span>` : ''}
                        ${tile.resources.faith > 0 ? `<span class="resource faith">${tile.resources.faith}i</span>` : ''}
                    </div>
                    <div class="tile-hp">HP: ${tile.hp}</div>
                </div>
            `;
            
            // Add click handler
            tileElement.addEventListener('click', () => {
                this.selectTile(index);
            });
            
            this.tileOptionsContainer.appendChild(tileElement);
        });
    }
    
    getTileSymbol(tileType) {
        const symbols = {
            'capital_city': '⚔️',
            'city': '🏘️',
            'field': '🌾',
            'monastery': '⛪',
            'marsh': '🌊',
            'mine': '⛏️',
            'orchard': '🍎',
            'barracks': '🏰',
            'watchtower': '👁️'
        };
        return symbols[tileType] || '?';
    }
    
    getTileColor(tileType) {
        const colors = {
            'capital_city': '#8b4513',
            'city': '#654321',
            'field': '#228b22',
            'monastery': '#483d8b',
            'marsh': '#2f4f4f',
            'mine': '#696969',
            'orchard': '#9acd32',
            'barracks': '#8b0000',
            'watchtower': '#2f4f4f'
        };
        return colors[tileType] || '#666666';
    }
    
    startSelectionTimer() {
        // Clear any existing selection timer first
        if (this.selectionTimer) {
            clearInterval(this.selectionTimer);
            this.selectionTimer = null;
        }
        
        let timeLeft = 15;
        this.timerDisplay.textContent = timeLeft;
        this.timerDisplay.setAttribute('data-time-left', timeLeft);
        
        this.selectionTimer = setInterval(() => {
            timeLeft--;
            this.timerDisplay.textContent = timeLeft;
            this.timerDisplay.setAttribute('data-time-left', timeLeft);
            
            
            if (timeLeft <= 0) {
                // Auto-select first tile if no selection made
                if (this.currentTileOptions && this.currentTileOptions.length > 0) {
                    this.selectTile(0);
                } else {
                    console.warn('No tiles available for auto-selection');
                    this.closeModal();
                }
            }
        }, 1000);
    }
    
    selectTile(index) {
        if (index < 0 || index >= this.currentTileOptions.length) {
            console.error('Invalid tile index:', index);
            return;
        }
        
        const selectedTile = this.currentTileOptions[index];
        
        // Add to tile bank
        this.addToTileBank(selectedTile);
        
        // Close modal
        this.closeModal();
    }
    
    addToTileBank(tile) {
        // Add to bank
        this.tileBank.push(tile);
        
        // Maintain bank size limit (max 3)
        if (this.tileBank.length > 3) {
            const removedTile = this.tileBank.shift();
        }
        
        // Update UI to show bank
        this.updateTileBankUI();
    }
    
    removeTileFromBank(tile) {
        const index = this.tileBank.findIndex(bankTile => bankTile.id === tile.id);
        if (index !== -1) {
            this.tileBank.splice(index, 1);
            
            // Update UI to show bank
            this.updateTileBankUI();
            
            return true;
        }
        
        console.warn('Tile not found in bank:', tile);
        return false;
    }
    
    updateTileBankUI() {
        const tileBankContainer = document.getElementById('tile-bank-tiles');
        const tileBankCount = document.getElementById('tile-bank-count');
        
        if (!tileBankContainer || !tileBankCount) {
            console.error('Tile bank UI elements not found');
            return;
        }
        
        // Update count
        tileBankCount.textContent = `${this.tileBank.length}/3`;
        
        // Clear existing tiles
        tileBankContainer.innerHTML = '';
        
        if (this.tileBank.length === 0) {
            // Show empty state
            const emptyState = document.createElement('div');
            emptyState.className = 'tile-bank-empty';
            emptyState.textContent = 'No tiles in bank';
            tileBankContainer.appendChild(emptyState);
            return;
        }
        
        // Create tile elements
        this.tileBank.forEach((tile, index) => {
            const tileElement = this.createBankTileElement(tile, index);
            tileBankContainer.appendChild(tileElement);
        });
    }
    
    createBankTileElement(tile, index) {
        const tileElement = document.createElement('div');
        tileElement.className = 'bank-tile';
        tileElement.setAttribute('data-tile-index', index);
        tileElement.setAttribute('data-tile-id', tile.id);
        
        // Make draggable
        tileElement.draggable = true;
        
        // Get tile visual info
        const symbol = this.getTileSymbol(tile.type);
        const color = this.getTileColor(tile.type);
        
        tileElement.innerHTML = `
            <div class="bank-tile-preview" style="background-color: ${color}">
                ${symbol}
            </div>
            <div class="bank-tile-info">
                <div class="bank-tile-type">${tile.type.replace('_', ' ')}</div>
                <div class="bank-tile-resources">
                    ${tile.resources.gold > 0 ? `<span class="bank-tile-resource gold">${tile.resources.gold}g</span>` : ''}
                    ${tile.resources.food > 0 ? `<span class="bank-tile-resource food">${tile.resources.food}f</span>` : ''}
                    ${tile.resources.faith > 0 ? `<span class="bank-tile-resource faith">${tile.resources.faith}f</span>` : ''}
                </div>
            </div>
            <div class="bank-tile-hp">HP: ${tile.hp}</div>
        `;
        
        // Add event listeners
        tileElement.addEventListener('click', (e) => {
            this.selectTileFromBank(tile, index);
        });
        
        tileElement.addEventListener('dragstart', (e) => {
            this.handleDragStart(e, tile, index);
        });
        
        tileElement.addEventListener('dragend', (e) => {
            this.handleDragEnd(e, tile, index);
        });
        
        return tileElement;
    }
    
    selectTileFromBank(tile, index) {
        // Remove any existing selection
        document.querySelectorAll('.bank-tile.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Add selection to clicked tile
        const tileElement = document.querySelector(`[data-tile-index="${index}"]`);
        if (tileElement) {
            tileElement.classList.add('selected');
        }
        
        // Emit event for game to handle placement mode
        const event = new CustomEvent('tileSelectedFromBank', {
            detail: { tile, index }
        });
        document.dispatchEvent(event);
    }
    
    handleDragStart(e, tile, index) {
        // Store drag data
        e.dataTransfer.setData('text/plain', JSON.stringify({
            tile: tile,
            index: index,
            source: 'bank'
        }));
        
        // Add dragging class
        e.target.classList.add('dragging');
        
        // Create drag overlay
        const overlay = document.createElement('div');
        overlay.className = 'drag-overlay';
        overlay.id = 'drag-overlay';
        document.body.appendChild(overlay);
        
        // Emit event for game to show valid placements
        const event = new CustomEvent('tileDragStart', {
            detail: { tile, index }
        });
        document.dispatchEvent(event);
    }
    
    handleDragEnd(e, tile, index) {
        // Remove dragging class
        e.target.classList.remove('dragging');
        
        // Remove drag overlay
        const overlay = document.getElementById('drag-overlay');
        if (overlay) {
            overlay.remove();
        }
        
        // Emit event for game to hide valid placements
        const event = new CustomEvent('tileDragEnd', {
            detail: { tile, index }
        });
        document.dispatchEvent(event);
    }
    
    // Method to get tile by ID (for external access)
    getTileFromBank(tileId) {
        return this.tileBank.find(tile => tile.id === tileId);
    }
    
    // Method to get tile by index (for external access)
    getTileFromBankByIndex(index) {
        return this.tileBank[index];
    }
    
    // Method to clear bank selection
    clearBankSelection() {
        document.querySelectorAll('.bank-tile.selected').forEach(el => {
            el.classList.remove('selected');
        });
    }
    
    closeModal() {
        if (this.modal) {
            this.modal.classList.add('hidden');
        }
        
        if (this.selectionTimer) {
            clearInterval(this.selectionTimer);
            this.selectionTimer = null;
        }
        
        // Clear current options
        this.currentTileOptions = [];
    }
    
    placeTile(x, y, tileData) {
        return this.gameState.placeTile(x, y, tileData);
    }
    
    placeWorker(x, y, workerType) {
        // TODO: Implement worker placement
        return false;
    }
    
    recallWorker(workerId) {
        return this.gameState.recallWorker(workerId);
    }
    
    update(deltaTime) {
        // TODO: Update tile system
    }
    
    cleanup() {
        this.stopPlacementCycle();
    }
} 