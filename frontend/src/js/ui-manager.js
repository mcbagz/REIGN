// UI Manager Class
class UIManager {
    constructor() {
        this.notifications = [];
        this.modals = new Map();
        this.tooltips = new Map();
        this.initialized = false;
        
        // Resource bar properties
        this.resourceBarContainer = null;
        this.resourceTexts = new Map();
        this.resourceCap = 500;
        this.currentValues = { gold: 0, food: 0, faith: 0 };
        this.animationTargets = { gold: 0, food: 0, faith: 0 };
        this.isAnimating = { gold: false, food: false, faith: false };
        this.animationDuration = 300; // 0.3 seconds
        this.tweenStartTime = { gold: 0, food: 0, faith: 0 };
        this.tweenStartValue = { gold: 0, food: 0, faith: 0 };
        
        // Bind methods
        this.showNotification = this.showNotification.bind(this);
        this.showModal = this.showModal.bind(this);
        this.hideModal = this.hideModal.bind(this);
        this.updateResourceDisplay = this.updateResourceDisplay.bind(this);
        this.updateResourceBar = this.updateResourceBar.bind(this);
        this.animateResourceBar = this.animateResourceBar.bind(this);
        this.updateResourceCap = this.updateResourceCap.bind(this);
        this.showOverflowToast = this.showOverflowToast.bind(this);
    }
    
    init(renderer) {
        console.log('Initializing UI Manager...');
        
        this.renderer = renderer;
        
        // Set up modal event listeners
        this.setupModalListeners();
        
        // Set up tooltip system
        this.setupTooltips();
        
        // Set up resource display (both DOM and Pixi)
        this.setupResourceDisplay();
        
        // Set up Pixi resource bar
        this.setupResourceBar();
        
        // Set up worker management
        this.setupWorkerManagement();
        
        this.initialized = true;
        console.log('UI Manager initialized');
    }
    
    setupModalListeners() {
        // Tech tree modal
        const techTreeBtn = document.getElementById('tech-tree-btn');
        const techTreeModal = document.getElementById('tech-tree-modal');
        
        if (techTreeBtn && techTreeModal) {
            techTreeBtn.addEventListener('click', () => {
                this.showModal('tech-tree-modal');
            });
        }
        
        // Close buttons
        const closeButtons = document.querySelectorAll('.close-btn');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    this.hideModal(modal.id);
                }
            });
        });
        
        // Modal background clicks
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal(modal.id);
                }
            });
        });
    }
    
    setupTooltips() {
        // Add tooltip functionality to elements with data-tooltip
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        
        tooltipElements.forEach(element => {
            element.addEventListener('mouseenter', (e) => {
                this.showTooltip(e.target, e.target.dataset.tooltip);
            });
            
            element.addEventListener('mouseleave', (e) => {
                this.hideTooltip(e.target);
            });
        });
    }
    
    setupResourceDisplay() {
        // Initial resource display setup
        this.updateResourceDisplay({
            gold: GameConfig.STARTING_RESOURCES.gold,
            food: GameConfig.STARTING_RESOURCES.food,
            faith: GameConfig.STARTING_RESOURCES.faith
        });
    }
    
    setupResourceBar() {
        if (!this.renderer || !this.renderer.app) {
            console.error('Renderer not available for resource bar setup');
            return;
        }
        
        // Create resource bar container
        this.resourceBarContainer = new PIXI.Container();
        this.resourceBarContainer.x = 10;
        this.resourceBarContainer.y = 10;
        this.resourceBarContainer.zIndex = 1000;
        
        // Style for resource text
        const textStyle = new PIXI.TextStyle({
            fontFamily: 'Arial',
            fontSize: 16,
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            dropShadow: true,
            dropShadowDistance: 2,
            dropShadowColor: '#000000',
            dropShadowAlpha: 0.7
        });
        
        // Create resource texts
        const resources = ['gold', 'food', 'faith'];
        const resourceIcons = { gold: '🪙', food: '🌾', faith: '⛪' };
        
        resources.forEach((resource, index) => {
            const text = new PIXI.Text(`${resourceIcons[resource]} ${this.currentValues[resource]}/${this.resourceCap}`, textStyle);
            text.x = 0;
            text.y = index * 25;
            
            this.resourceTexts.set(resource, text);
            this.resourceBarContainer.addChild(text);
        });
        
        // Add container to stage
        this.renderer.app.stage.addChild(this.resourceBarContainer);
        
        // Make sure the resource bar is on top
        this.resourceBarContainer.sortableChildren = true;
        
        // Initialize with starting values
        this.currentValues = {
            gold: GameConfig.STARTING_RESOURCES.gold,
            food: GameConfig.STARTING_RESOURCES.food,
            faith: GameConfig.STARTING_RESOURCES.faith
        };
        
        this.animationTargets = { ...this.currentValues };
        this.updateResourceBarDisplay();
        
        console.log('Pixi resource bar initialized');
    }
    
    updateResourceBar(resourceDelta, currentResources) {
        if (!this.resourceBarContainer) {
            return;
        }
        
        // Update animation targets
        this.animationTargets = { ...currentResources };
        
        // Start animations for resources that changed
        const resources = ['gold', 'food', 'faith'];
        resources.forEach(resource => {
            if (resourceDelta[resource] && resourceDelta[resource] > 0) {
                this.startResourceAnimation(resource);
            }
        });
        
        // Check for overflow (when production would exceed cap)
        resources.forEach(resource => {
            if (resourceDelta[resource] > 0) {
                const potentialValue = currentResources[resource] + resourceDelta[resource];
                if (potentialValue > this.resourceCap && currentResources[resource] < this.resourceCap) {
                    this.showOverflowToast(resource, resourceDelta[resource]);
                }
            }
        });
    }
    
    startResourceAnimation(resource) {
        this.isAnimating[resource] = true;
        this.tweenStartTime[resource] = performance.now();
        this.tweenStartValue[resource] = this.currentValues[resource];
    }
    
    animateResourceBar() {
        if (!this.resourceBarContainer) return;
        
        const now = performance.now();
        const resources = ['gold', 'food', 'faith'];
        
        resources.forEach(resource => {
            if (this.isAnimating[resource]) {
                const elapsed = now - this.tweenStartTime[resource];
                const progress = Math.min(elapsed / this.animationDuration, 1);
                
                // Ease-out animation
                const easeProgress = 1 - Math.pow(1 - progress, 3);
                
                const startValue = this.tweenStartValue[resource];
                const targetValue = this.animationTargets[resource];
                
                this.currentValues[resource] = Math.round(startValue + (targetValue - startValue) * easeProgress);
                
                if (progress >= 1) {
                    this.isAnimating[resource] = false;
                    this.currentValues[resource] = targetValue;
                }
            }
        });
        
        this.updateResourceBarDisplay();
    }
    
    updateResourceBarDisplay() {
        if (!this.resourceBarContainer) return;
        
        const resources = ['gold', 'food', 'faith'];
        const resourceIcons = { gold: '🪙', food: '🌾', faith: '⛪' };
        
        resources.forEach(resource => {
            const text = this.resourceTexts.get(resource);
            if (text) {
                const value = this.currentValues[resource];
                const cappedValue = Math.min(value, this.resourceCap);
                
                text.text = `${resourceIcons[resource]} ${cappedValue}/${this.resourceCap}`;
                
                // Apply color based on resource level
                if (cappedValue >= this.resourceCap) {
                    text.style.fill = '#ff4444'; // Red when at cap
                } else if (cappedValue >= this.resourceCap * 0.9) {
                    text.style.fill = '#ffaa00'; // Yellow when near cap (90%+)
                } else {
                    text.style.fill = '#ffffff'; // White for normal levels
                }
            }
        });
    }
    
    updateResourceCap(newCap) {
        this.resourceCap = newCap;
        this.updateResourceBarDisplay();
        console.log(`Resource cap updated to ${newCap}`);
    }
    
    showOverflowToast(resource, overflow) {
        const message = `${resource.charAt(0).toUpperCase() + resource.slice(1)} production blocked! (+${overflow} would exceed cap)`;
        this.showNotification(message, 'warning', 2000);
    }
    
    setupWorkerManagement() {
        // Store references to worker UI elements
        this.workerPanel = document.getElementById('worker-panel');
        this.workerList = document.getElementById('worker-list');
        this.workerCount = document.getElementById('worker-count');
        
        // Initialize worker UI state
        this.isDragging = false;
        this.draggedWorker = null;
        this.dragOverlay = null;
        this.selectedWorker = null; // For click-to-select functionality
        
        // Bind event handlers
        this.handleWorkerDragStart = this.handleWorkerDragStart.bind(this);
        this.handleWorkerDragEnd = this.handleWorkerDragEnd.bind(this);
        this.handleWorkerClick = this.handleWorkerClick.bind(this);
        this.handleWorkerPlaced = this.handleWorkerPlaced.bind(this);
        this.handleWorkerRecalled = this.handleWorkerRecalled.bind(this);
        this.handleWorkerCooldownFinished = this.handleWorkerCooldownFinished.bind(this);
        this.handleWorkerSelect = this.handleWorkerSelect.bind(this);
        
        // Listen for worker events from game state
        document.addEventListener('workerPlaced', this.handleWorkerPlaced);
        document.addEventListener('workerRecalled', this.handleWorkerRecalled);
        document.addEventListener('workerCooldownFinished', this.handleWorkerCooldownFinished);
        
        console.log('Worker management UI initialized');
    }
    
    getWorkerJobName(tileType) {
        const jobNames = {
            'field': 'Farmer',
            'monastery': 'Monk',
            'city': 'Magistrate',
            'capital': 'Magistrate'
        };
        return jobNames[tileType] || 'Worker';
    }
    
    getWorkerResourceGeneration(worker, gameState) {
        if (!worker || worker.status !== 'deployed' || !worker.tileKey) {
            return { gold: 0, food: 0, faith: 0 };
        }
        
        const tile = gameState.tiles.get(worker.tileKey);
        if (!tile) return { gold: 0, food: 0, faith: 0 };
        
        const tileStats = GameConfig.TILE_STATS[tile.type];
        if (!tileStats || !tileStats.yield) return { gold: 0, food: 0, faith: 0 };
        
        // Return the base yield that this worker enables
        return tileStats.yield;
    }
    
    createWorkerItem(worker) {
        const workerItem = document.createElement('div');
        workerItem.className = 'worker-item';
        workerItem.dataset.workerId = worker.id;
        
        // Add status-based styling
        let statusClass = '';
        let statusText = '';
        let jobName = 'Worker';
        let resourceInfo = '';
        
        switch (worker.status) {
            case 'idle':
                statusClass = 'idle';
                statusText = 'Available';
                break;
            case 'deployed':
                statusClass = 'deployed';
                statusText = 'Deployed';
                // Get job name based on tile type
                if (worker.tileKey && window.game && window.game.gameState) {
                    const tile = window.game.gameState.tiles.get(worker.tileKey);
                    if (tile) {
                        jobName = this.getWorkerJobName(tile.type);
                        const resourceGen = this.getWorkerResourceGeneration(worker, window.game.gameState);
                        const resourceParts = [];
                        if (resourceGen.gold > 0) resourceParts.push(`🪙${resourceGen.gold}/s`);
                        if (resourceGen.food > 0) resourceParts.push(`🌾${resourceGen.food}/s`);
                        if (resourceGen.faith > 0) resourceParts.push(`⛪${resourceGen.faith}/s`);
                        resourceInfo = resourceParts.join(' ');
                    }
                }
                break;
            case 'cooldown':
                statusClass = 'cooldown';
                statusText = 'Cooldown';
                break;
        }
        
        workerItem.className = `worker-item ${statusClass}`;
        
        // Add selection visual state
        if (this.selectedWorker && this.selectedWorker.id === worker.id) {
            workerItem.classList.add('selected');
        }
        
        workerItem.innerHTML = `
            <div class="worker-icon">👷</div>
            <div class="worker-info">
                <div class="worker-name">${jobName}</div>
                <div class="worker-status">${statusText}</div>
                ${resourceInfo ? `<div class="worker-resources">${resourceInfo}</div>` : ''}
                ${worker.status === 'cooldown' ? `<div class="cooldown-timer" data-worker-id="${worker.id}">10s</div>` : ''}
            </div>
        `;
        
        // Add event listeners
        if (worker.status === 'idle') {
            workerItem.draggable = true;
            workerItem.addEventListener('dragstart', this.handleWorkerDragStart);
            workerItem.addEventListener('dragend', this.handleWorkerDragEnd);
            workerItem.addEventListener('click', this.handleWorkerSelect);
        } else if (worker.status === 'deployed') {
            workerItem.addEventListener('click', this.handleWorkerClick);
        }
        
        return workerItem;
    }
    
    getWorkerStatusIcon(status) {
        const icons = {
            idle: '✓',
            deployed: '⚡',
            cooldown: '⏰'
        };
        return icons[status] || '?';
    }
    
    startCooldownDisplay(workerId) {
        const timerElement = document.getElementById(`cooldown-${workerId}`);
        if (!timerElement) return;
        
        let timeLeft = 10;
        const interval = setInterval(() => {
            timeLeft--;
            if (timerElement) {
                timerElement.textContent = `${timeLeft}s`;
            }
            
            if (timeLeft <= 0) {
                clearInterval(interval);
            }
        }, 1000);
    }
    
    handleWorkerDragStart(e) {
        const workerId = parseInt(e.target.dataset.workerId);
        this.draggedWorker = workerId;
        this.isDragging = true;
        
        // Add dragging class
        e.target.classList.add('dragging');
        
        // Create drag overlay
        this.dragOverlay = document.createElement('div');
        this.dragOverlay.className = 'worker-drag-overlay';
        document.body.appendChild(this.dragOverlay);
        
        // Set drag data
        e.dataTransfer.setData('text/plain', JSON.stringify({
            workerId: workerId,
            type: 'worker'
        }));
        
        // Emit event for tile highlighting
        const event = new CustomEvent('workerDragStart', {
            detail: { workerId }
        });
        document.dispatchEvent(event);
        
        console.log(`Started dragging worker ${workerId}`);
    }
    
    handleWorkerDragEnd(e) {
        this.isDragging = false;
        
        // Remove dragging class
        e.target.classList.remove('dragging');
        
        // Remove drag overlay
        if (this.dragOverlay) {
            this.dragOverlay.remove();
            this.dragOverlay = null;
        }
        
        // Emit event for tile unhighlighting
        const event = new CustomEvent('workerDragEnd', {
            detail: { workerId: this.draggedWorker }
        });
        document.dispatchEvent(event);
        
        console.log(`Finished dragging worker ${this.draggedWorker}`);
        this.draggedWorker = null;
    }
    
    handleWorkerClick(e) {
        const workerId = parseInt(e.currentTarget.dataset.workerId);
        
        // Only handle clicks on deployed workers (for recall)
        if (e.currentTarget.classList.contains('deployed')) {
            const event = new CustomEvent('workerRecallRequest', {
                detail: { workerId }
            });
            document.dispatchEvent(event);
        }
    }
    
    handleWorkerPlaced(e) {
        const { workerId, tileKey } = e.detail;
        console.log(`Worker ${workerId} placed on tile ${tileKey}`);
        
        // Update the worker display
        if (window.game && window.game.gameState) {
            this.updateWorkerDisplay(window.game.gameState);
        }
    }
    
    handleWorkerRecalled(e) {
        const { workerId, tileKey } = e.detail;
        console.log(`Worker ${workerId} recalled from tile ${tileKey}`);
        
        // Update the worker display
        if (window.game && window.game.gameState) {
            this.updateWorkerDisplay(window.game.gameState);
        }
    }
    
    handleWorkerCooldownFinished(e) {
        const { workerId } = e.detail;
        console.log(`Worker ${workerId} cooldown finished`);
        
        // Update the worker display
        if (window.game && window.game.gameState) {
            this.updateWorkerDisplay(window.game.gameState);
        }
    }
    
    handleWorkerSelect(event) {
        const workerId = parseInt(event.currentTarget.dataset.workerId);
        const gameState = window.game ? window.game.gameState : null;
        
        if (!gameState) return;
        
        const worker = gameState.workers.get(workerId);
        if (!worker || worker.status !== 'idle') return;
        
        // Toggle selection
        if (this.selectedWorker && this.selectedWorker.id === workerId) {
            this.selectedWorker = null;
            console.log('Worker deselected');
        } else {
            this.selectedWorker = worker;
            console.log('Worker selected:', worker.id);
        }
        
        // Update UI to show selection
        this.updateWorkerDisplay(gameState);
        
        // Show placement hints if worker is selected
        if (this.selectedWorker) {
            this.showWorkerPlacementHints(this.selectedWorker.id);
        } else {
            this.hideWorkerPlacementHints();
        }
    }
    
    showWorkerPlacementHints(workerId) {
        if (!window.game || !window.game.renderer) return;
        
        const validPlacements = window.game.getValidWorkerPlacements(workerId);
        
        // Highlight valid tiles
        validPlacements.forEach(pos => {
            const tileKey = `${pos.x},${pos.y}`;
            const tileContainer = window.game.renderer.tileContainers.get(tileKey);
            if (tileContainer) {
                // Add highlight effect
                const highlight = new PIXI.Graphics();
                highlight.beginFill(0xffff00, 0.3);
                highlight.drawRect(0, 0, GameConfig.TILE_SIZE, GameConfig.TILE_SIZE);
                highlight.endFill();
                highlight.name = 'worker-placement-hint';
                tileContainer.addChild(highlight);
            }
        });
    }
    
    hideWorkerPlacementHints() {
        if (!window.game || !window.game.renderer) return;
        
        // Remove all placement hints
        window.game.renderer.tileContainers.forEach(tileContainer => {
            const hints = tileContainer.children.filter(child => child.name === 'worker-placement-hint');
            hints.forEach(hint => tileContainer.removeChild(hint));
        });
    }
    
    // Handle tile click for worker placement
    handleTileClickForWorkerPlacement(x, y) {
        if (!this.selectedWorker) return false;
        
        const gameState = window.game ? window.game.gameState : null;
        if (!gameState) return false;
        
        const tileKey = `${x},${y}`;
        const tile = gameState.tiles.get(tileKey);
        
        if (!tile) return false;
        
        // Check if this is a valid placement
        const validPlacements = window.game.getValidWorkerPlacements(this.selectedWorker.id);
        const isValidPlacement = validPlacements.some(pos => pos.x === x && pos.y === y);
        
        if (isValidPlacement) {
            // Place the worker
            const success = gameState.placeWorker(this.selectedWorker.id, tileKey);
            if (success) {
                console.log('Worker placed via click:', this.selectedWorker.id, 'at', tileKey);
                this.selectedWorker = null;
                this.hideWorkerPlacementHints();
                return true;
            }
        }
        
        return false;
    }
    
    startCooldownDisplay(workerId) {
        const timerElement = document.querySelector(`[data-worker-id="${workerId}"]`);
        if (!timerElement) return;
        
        let timeLeft = 10;
        const updateTimer = () => {
            timerElement.textContent = `${timeLeft}s`;
            timeLeft--;
            
            if (timeLeft >= 0) {
                setTimeout(updateTimer, 1000);
            } else {
                timerElement.textContent = 'Available';
                // Force UI refresh
                if (window.game && window.game.gameState) {
                    this.updateWorkerDisplay(window.game.gameState);
                }
            }
        };
        
        updateTimer();
    }
    
    handleWorkerCooldownFinished(event) {
        console.log('Worker cooldown finished:', event.detail);
        // Force immediate UI refresh
        if (window.game && window.game.gameState) {
            this.updateWorkerDisplay(window.game.gameState);
        }
    }
    
    // Worker Management Methods
    updateWorkerDisplay(gameState) {
        if (!this.workerList || !gameState) return;
        
        const currentPlayer = gameState.getCurrentPlayer();
        if (!currentPlayer) return;
        
        const workers = gameState.getWorkersByPlayer(currentPlayer.id);
        const availableWorkers = workers.filter(w => w.status === 'idle');
        
        // Update worker count
        this.workerCount.textContent = `${availableWorkers.length}/${workers.length}`;
        
        // Clear existing worker items
        this.workerList.innerHTML = '';
        
        // Create worker items
        workers.forEach(worker => {
            const workerItem = this.createWorkerItem(worker);
            this.workerList.appendChild(workerItem);
        });
        
        // Start cooldown displays for workers that are on cooldown
        workers.forEach(worker => {
            if (worker.status === 'cooldown') {
                this.startCooldownDisplay(worker.id);
            }
        });
    }
    
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-message">${message}</div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after duration
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, duration);
        
        // Add to notifications array
        this.notifications.push({
            element: notification,
            message,
            type,
            timestamp: Date.now()
        });
        
        // Limit notifications
        if (this.notifications.length > 5) {
            const oldNotification = this.notifications.shift();
            if (oldNotification.element.parentNode) {
                oldNotification.element.parentNode.removeChild(oldNotification.element);
            }
        }
    }
    
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
        }
    }
    
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            this.modals.delete(modalId);
        }
    }
    
    updateResourceDisplay(resources) {
        const goldCount = document.getElementById('gold-count');
        const foodCount = document.getElementById('food-count');
        const faithCount = document.getElementById('faith-count');
        
        if (goldCount) goldCount.textContent = resources.gold || 0;
        if (foodCount) foodCount.textContent = resources.food || 0;
        if (faithCount) faithCount.textContent = resources.faith || 0;
        
        // Also update Pixi resource bar if it exists
        if (this.resourceBarContainer) {
            this.currentValues = { ...resources };
            this.animationTargets = { ...resources };
            this.updateResourceBarDisplay();
        }
    }
    
    update(deltaTime) {
        // Update any animated UI elements
        // This could include progress bars, animations, etc.
        
        // Update resource bar animations
        if (this.resourceBarContainer) {
            this.animateResourceBar();
        }
        
        // Update worker display periodically
        if (window.game && window.game.gameState) {
            this.updateWorkerDisplay(window.game.gameState);
        }
    }
    
    cleanup() {
        console.log('UIManager cleanup');
        
        // Clean up tooltips
        this.tooltips.forEach(tooltip => {
            if (tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
        });
        this.tooltips.clear();
        
        // Clean up modals
        this.modals.clear();
    }
} 