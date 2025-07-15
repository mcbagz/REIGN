// UI Manager Class
class UIManager {
    constructor() {
        this.notifications = [];
        this.modals = new Map();
        this.tooltips = new Map();
        this.initialized = false;
        
        // Bind methods
        this.showNotification = this.showNotification.bind(this);
        this.showModal = this.showModal.bind(this);
        this.hideModal = this.hideModal.bind(this);
        this.updateResourceDisplay = this.updateResourceDisplay.bind(this);
    }
    
    init() {
        console.log('Initializing UI Manager...');
        
        // Set up modal event listeners
        this.setupModalListeners();
        
        // Set up tooltip system
        this.setupTooltips();
        
        // Set up resource display
        this.setupResourceDisplay();
        
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
    
    showPlacementMode(tile) {
        console.log('Showing placement mode UI for tile:', tile);
        
        // Show placement instructions
        const instructionElement = document.createElement('div');
        instructionElement.id = 'placement-instruction';
        instructionElement.className = 'placement-instruction';
        instructionElement.innerHTML = `
            <div class="instruction-content">
                <div class="instruction-text">
                    <strong>Placement Mode:</strong> Click on a highlighted tile to place your ${tile.type.replace('_', ' ')}
                </div>
                <button id="cancel-placement" class="btn btn-secondary">Cancel</button>
            </div>
        `;
        
        document.body.appendChild(instructionElement);
        
        // Add cancel button handler
        document.getElementById('cancel-placement').addEventListener('click', () => {
            this.hidePlacementMode();
            // Dispatch event to exit placement mode
            document.dispatchEvent(new CustomEvent('cancelPlacement'));
        });
    }
    
    hidePlacementMode() {
        console.log('Hiding placement mode UI');
        
        const instructionElement = document.getElementById('placement-instruction');
        if (instructionElement) {
            instructionElement.remove();
        }
    }
    
    showError(message) {
        console.log('Showing error:', message);
        
        // Create error toast
        const errorToast = document.createElement('div');
        errorToast.className = 'error-toast';
        errorToast.textContent = message;
        
        document.body.appendChild(errorToast);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (errorToast.parentNode) {
                errorToast.remove();
            }
        }, 3000);
    }
    
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            this.modals.delete(modalId);
        }
    }
    
    showTooltip(element, text) {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = text;
        
        document.body.appendChild(tooltip);
        
        // Position tooltip
        const rect = element.getBoundingClientRect();
        tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
        tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;
        
        this.tooltips.set(element, tooltip);
    }
    
    hideTooltip(element) {
        const tooltip = this.tooltips.get(element);
        if (tooltip && tooltip.parentNode) {
            tooltip.parentNode.removeChild(tooltip);
            this.tooltips.delete(element);
        }
    }
    
    updateResourceDisplay(resources) {
        const goldCount = document.getElementById('gold-count');
        const foodCount = document.getElementById('food-count');
        const faithCount = document.getElementById('faith-count');
        
        if (goldCount) goldCount.textContent = resources.gold || 0;
        if (foodCount) foodCount.textContent = resources.food || 0;
        if (faithCount) faithCount.textContent = resources.faith || 0;
    }
    
    updatePlayerInfo(playerData) {
        const playerName = document.querySelector('.player-name');
        const playerLevel = document.querySelector('.player-level');
        
        if (playerName) playerName.textContent = playerData.name || 'Player';
        if (playerLevel) playerLevel.textContent = playerData.level || 'Manor';
    }
    
    showTileSelection(tileOptions, onSelect) {
        const modal = document.getElementById('tile-selection-modal');
        const tileOptionsContainer = document.getElementById('tile-options');
        const timer = document.getElementById('selection-timer');
        
        if (!modal || !tileOptionsContainer) return;
        
        // Clear previous options
        tileOptionsContainer.innerHTML = '';
        
        // Create tile option elements
        tileOptions.forEach((tile, index) => {
            const tileOption = document.createElement('div');
            tileOption.className = 'tile-option';
            tileOption.innerHTML = `
                <div class="tile-option-type">${tile.type}</div>
                <div class="tile-option-preview">
                    <!-- Tile preview will be rendered here -->
                </div>
            `;
            
            tileOption.addEventListener('click', () => {
                onSelect(index, tile);
                this.hideModal('tile-selection-modal');
            });
            
            tileOptionsContainer.appendChild(tileOption);
        });
        
        // Start countdown timer
        let timeLeft = 15;
        timer.textContent = timeLeft;
        
        const countdown = setInterval(() => {
            timeLeft--;
            timer.textContent = timeLeft;
            
            if (timeLeft <= 0) {
                clearInterval(countdown);
                // Auto-select first option if no selection made
                if (tileOptions.length > 0) {
                    onSelect(0, tileOptions[0]);
                }
                this.hideModal('tile-selection-modal');
            }
        }, 1000);
        
        // Show modal
        this.showModal('tile-selection-modal');
        
        // Store countdown reference for cleanup
        modal.countdownInterval = countdown;
    }
    
    showTechTree(techData) {
        const modal = document.getElementById('tech-tree-modal');
        const content = document.querySelector('.tech-tree-content');
        
        if (!content) return;
        
        // Clear previous content
        content.innerHTML = '';
        
        // Create tech levels
        Object.entries(GameConfig.TECH_LEVELS).forEach(([key, level]) => {
            const levelDiv = document.createElement('div');
            levelDiv.className = `tech-level ${level}`;
            
            if (techData.currentLevel === level) {
                levelDiv.classList.add('current');
            }
            
            levelDiv.innerHTML = `
                <h4>${level.charAt(0).toUpperCase() + level.slice(1)}</h4>
                <div class="tech-upgrades">
                    <!-- Tech upgrades will be populated here -->
                </div>
            `;
            
            content.appendChild(levelDiv);
        });
        
        this.showModal('tech-tree-modal');
    }
    
    update(deltaTime) {
        // Update any animated UI elements
        // This could include progress bars, animations, etc.
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