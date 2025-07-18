/**
 * Tech Tree UI System
 * Manages technology progression interface for Carcassonne: War of Ages
 */

export class TechTreeUI {
    constructor(game) {
        this.game = game;
        this.isOpen = false;
        this.currentLevel = 'manor';
        this.techTree = null;
        
        // Tech level descriptions
        this.techLevels = {
            manor: {
                name: "Manor",
                description: "Starting technology level",
                units: ["Infantry", "Archer"],
                buildings: ["City", "Field", "Monastery"]
            },
            duchy: {
                name: "Duchy",
                description: "Advanced medieval technology",
                units: ["Knight"],
                buildings: ["Barracks", "Watchtower"],
                cost: { gold: 200, food: 100, faith: 100 }
            },
            kingdom: {
                name: "Kingdom",
                description: "Peak medieval power",
                units: ["Siege"],
                buildings: ["Mine", "Orchard"],
                cost: { gold: 400, food: 200, faith: 200 }
            }
        };
    }
    
    init() {
        this.createTechTreeButton();
        this.createTechTreeModal();
        this.setupEventListeners();
    }
    
    createTechTreeButton() {
        // Add tech tree button to UI
        const techButton = document.createElement('button');
        techButton.id = 'tech-tree-btn';
        techButton.className = 'tech-tree-btn';
        techButton.innerHTML = `
            <span class="tech-icon">🏰</span>
            <span class="tech-level">${this.techLevels[this.currentLevel].name}</span>
        `;
        techButton.title = 'Open Tech Tree';
        
        // Add to game UI
        const gameUI = document.querySelector('.game-ui');
        if (gameUI) {
            gameUI.appendChild(techButton);
        }
        
        techButton.addEventListener('click', () => this.toggleTechTree());
    }
    
    createTechTreeModal() {
        // Create modal structure
        const modal = document.createElement('div');
        modal.id = 'tech-tree-modal';
        modal.className = 'tech-tree-modal hidden';
        modal.innerHTML = `
            <div class="tech-tree-content">
                <div class="tech-tree-header">
                    <h2>Technology Tree</h2>
                    <button class="close-btn">&times;</button>
                </div>
                
                <div class="tech-levels">
                    <div class="tech-level-item manor active" data-level="manor">
                        <h3>Manor</h3>
                        <p>Starting Level</p>
                        <div class="unlocks">
                            <div class="unlock-section">
                                <h4>Units:</h4>
                                <span>Infantry, Archer</span>
                            </div>
                            <div class="unlock-section">
                                <h4>Buildings:</h4>
                                <span>City, Field, Monastery</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="tech-progress-arrow">→</div>
                    
                    <div class="tech-level-item duchy" data-level="duchy">
                        <h3>Duchy</h3>
                        <p>Cost: 200 Gold, 100 Food, 100 Faith</p>
                        <div class="unlocks">
                            <div class="unlock-section">
                                <h4>Units:</h4>
                                <span>Knight</span>
                            </div>
                            <div class="unlock-section">
                                <h4>Buildings:</h4>
                                <span>Barracks, Watchtower</span>
                            </div>
                        </div>
                        <button class="advance-btn" data-level="duchy">Advance to Duchy</button>
                    </div>
                    
                    <div class="tech-progress-arrow">→</div>
                    
                    <div class="tech-level-item kingdom" data-level="kingdom">
                        <h3>Kingdom</h3>
                        <p>Cost: 400 Gold, 200 Food, 200 Faith</p>
                        <div class="unlocks">
                            <div class="unlock-section">
                                <h4>Units:</h4>
                                <span>Siege</span>
                            </div>
                            <div class="unlock-section">
                                <h4>Buildings:</h4>
                                <span>Mine, Orchard</span>
                            </div>
                        </div>
                        <button class="advance-btn" data-level="kingdom">Advance to Kingdom</button>
                    </div>
                </div>
                
                <div class="tech-upgrades">
                    <h3>Available Upgrades</h3>
                    <div id="upgrade-list" class="upgrade-list">
                        <!-- Upgrades will be populated here -->
                    </div>
                </div>
                
                <div class="special-abilities">
                    <h3>Special Abilities</h3>
                    <div id="ability-list" class="ability-list">
                        <!-- Abilities will be populated here -->
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Setup close button
        modal.querySelector('.close-btn').addEventListener('click', () => {
            this.closeTechTree();
        });
        
        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeTechTree();
            }
        });
    }
    
    setupEventListeners() {
        // Listen for tech tree updates from server
        this.game.websocketClient.on('tech_level_advanced', (data) => {
            this.handleTechLevelAdvanced(data);
        });
        
        this.game.websocketClient.on('tech_upgrade_purchased', (data) => {
            this.handleUpgradePurchased(data);
        });
        
        this.game.websocketClient.on('special_ability_used', (data) => {
            this.handleAbilityUsed(data);
        });
        
        // Setup advance buttons
        document.querySelectorAll('.advance-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const level = e.target.dataset.level;
                this.requestTechAdvancement(level);
            });
        });
    }
    
    toggleTechTree() {
        if (this.isOpen) {
            this.closeTechTree();
        } else {
            this.openTechTree();
        }
    }
    
    openTechTree() {
        this.isOpen = true;
        document.getElementById('tech-tree-modal').classList.remove('hidden');
        this.updateTechTreeDisplay();
    }
    
    closeTechTree() {
        this.isOpen = false;
        document.getElementById('tech-tree-modal').classList.add('hidden');
    }
    
    updateTechTreeDisplay() {
        if (!this.game.gameState) return;
        
        const player = this.game.gameState.players.find(p => p.id === this.game.playerId);
        if (!player) return;
        
        // Update current level
        this.currentLevel = player.tech_level || 'manor';
        this.techTree = player.tech_tree;
        
        // Update tech level button
        const techButton = document.getElementById('tech-tree-btn');
        if (techButton) {
            techButton.querySelector('.tech-level').textContent = this.techLevels[this.currentLevel].name;
        }
        
        // Update level displays
        this.updateLevelDisplay();
        
        // Update upgrades
        this.updateUpgradesList();
        
        // Update abilities
        this.updateAbilitiesList();
    }
    
    updateLevelDisplay() {
        // Update active level
        document.querySelectorAll('.tech-level-item').forEach(item => {
            const level = item.dataset.level;
            const isActive = this.isLevelUnlocked(level);
            const isCurrent = level === this.currentLevel;
            
            item.classList.toggle('active', isActive);
            item.classList.toggle('current', isCurrent);
            
            // Update advance button state
            const advanceBtn = item.querySelector('.advance-btn');
            if (advanceBtn) {
                const canAdvance = this.canAdvanceToLevel(level);
                advanceBtn.disabled = !canAdvance;
                
                if (!canAdvance && this.techLevels[level].cost) {
                    // Show why can't advance
                    const player = this.game.gameState.players.find(p => p.id === this.game.playerId);
                    if (player) {
                        const cost = this.techLevels[level].cost;
                        const missing = [];
                        
                        if (player.resources.gold < cost.gold) {
                            missing.push(`${cost.gold - player.resources.gold} gold`);
                        }
                        if (player.resources.food < cost.food) {
                            missing.push(`${cost.food - player.resources.food} food`);
                        }
                        if (player.resources.faith < cost.faith) {
                            missing.push(`${cost.faith - player.resources.faith} faith`);
                        }
                        
                        if (missing.length > 0) {
                            advanceBtn.title = `Need: ${missing.join(', ')}`;
                        }
                    }
                }
            }
        });
    }
    
    updateUpgradesList() {
        const upgradeList = document.getElementById('upgrade-list');
        if (!upgradeList || !this.techTree) return;
        
        upgradeList.innerHTML = '';
        
        // Filter upgrades by type
        const militaryUpgrades = this.techTree.upgrades.filter(u => u.type === 'military');
        const defensiveUpgrades = this.techTree.upgrades.filter(u => u.type === 'defensive');
        
        // Add military upgrades
        if (militaryUpgrades.length > 0) {
            const militarySection = this.createUpgradeSection('Military', militaryUpgrades);
            upgradeList.appendChild(militarySection);
        }
        
        // Add defensive upgrades
        if (defensiveUpgrades.length > 0) {
            const defensiveSection = this.createUpgradeSection('Defensive', defensiveUpgrades);
            upgradeList.appendChild(defensiveSection);
        }
    }
    
    createUpgradeSection(title, upgrades) {
        const section = document.createElement('div');
        section.className = 'upgrade-section';
        
        const header = document.createElement('h4');
        header.textContent = title;
        section.appendChild(header);
        
        upgrades.forEach(upgrade => {
            const upgradeEl = document.createElement('div');
            upgradeEl.className = 'upgrade-item';
            upgradeEl.classList.toggle('unlocked', upgrade.unlocked);
            upgradeEl.classList.toggle('purchased', upgrade.purchased);
            
            upgradeEl.innerHTML = `
                <div class="upgrade-info">
                    <h5>${upgrade.name}</h5>
                    <p>${upgrade.description}</p>
                    <div class="upgrade-cost">
                        ${this.formatCost(upgrade.cost)}
                    </div>
                </div>
                ${upgrade.unlocked && !upgrade.purchased ? 
                    `<button class="purchase-btn" data-upgrade="${upgrade.id}">Purchase</button>` : 
                    upgrade.purchased ? '<span class="purchased-label">Purchased</span>' : 
                    '<span class="locked-label">Locked</span>'
                }
            `;
            
            // Add purchase listener
            const purchaseBtn = upgradeEl.querySelector('.purchase-btn');
            if (purchaseBtn) {
                purchaseBtn.addEventListener('click', () => {
                    this.requestUpgradePurchase(upgrade.id);
                });
            }
            
            section.appendChild(upgradeEl);
        });
        
        return section;
    }
    
    updateAbilitiesList() {
        const abilityList = document.getElementById('ability-list');
        if (!abilityList || !this.techTree) return;
        
        abilityList.innerHTML = '';
        
        // Filter special abilities
        const abilities = this.techTree.upgrades.filter(u => u.type === 'special_ability' && u.purchased);
        
        abilities.forEach(ability => {
            const abilityEl = document.createElement('div');
            abilityEl.className = 'ability-item';
            
            abilityEl.innerHTML = `
                <div class="ability-info">
                    <h5>${ability.name}</h5>
                    <p>${ability.description}</p>
                    <div class="ability-cost">
                        Cost per use: ${this.formatCost(ability.cost)}
                    </div>
                </div>
                <button class="use-ability-btn" data-ability="${ability.id}">Use Ability</button>
            `;
            
            // Add use listener
            const useBtn = abilityEl.querySelector('.use-ability-btn');
            useBtn.addEventListener('click', () => {
                this.requestAbilityUse(ability.id);
            });
            
            abilityList.appendChild(abilityEl);
        });
        
        if (abilities.length === 0) {
            abilityList.innerHTML = '<p class="no-abilities">No special abilities unlocked yet</p>';
        }
    }
    
    formatCost(cost) {
        const parts = [];
        if (cost.gold > 0) parts.push(`${cost.gold} Gold`);
        if (cost.food > 0) parts.push(`${cost.food} Food`);
        if (cost.faith > 0) parts.push(`${cost.faith} Faith`);
        return parts.join(', ');
    }
    
    isLevelUnlocked(level) {
        const levelOrder = ['manor', 'duchy', 'kingdom'];
        const currentIndex = levelOrder.indexOf(this.currentLevel);
        const targetIndex = levelOrder.indexOf(level);
        return targetIndex <= currentIndex;
    }
    
    canAdvanceToLevel(level) {
        if (!this.game.gameState) return false;
        
        const player = this.game.gameState.players.find(p => p.id === this.game.playerId);
        if (!player) return false;
        
        // Check if it's the next level
        const levelOrder = ['manor', 'duchy', 'kingdom'];
        const currentIndex = levelOrder.indexOf(this.currentLevel);
        const targetIndex = levelOrder.indexOf(level);
        
        if (targetIndex !== currentIndex + 1) return false;
        
        // Check resources
        const cost = this.techLevels[level].cost;
        if (!cost) return false;
        
        return player.resources.gold >= cost.gold &&
               player.resources.food >= cost.food &&
               player.resources.faith >= cost.faith;
    }
    
    requestTechAdvancement(level) {
        this.game.websocketClient.send({
            type: 'cmd',
            payload: {
                action: 'advanceTechLevel',
                data: {
                    target_level: level
                }
            }
        });
    }
    
    requestUpgradePurchase(upgradeId) {
        this.game.websocketClient.send({
            type: 'cmd',
            payload: {
                action: 'purchaseTechUpgrade',
                data: {
                    upgrade_id: upgradeId
                }
            }
        });
    }
    
    requestAbilityUse(abilityId) {
        this.game.websocketClient.send({
            type: 'cmd',
            payload: {
                action: 'useSpecialAbility',
                data: {
                    ability_id: abilityId
                }
            }
        });
    }
    
    handleTechLevelAdvanced(data) {
        const { player_numeric_id, new_level, message } = data;
        
        if (player_numeric_id === this.game.playerId) {
            this.currentLevel = new_level;
            this.game.uiManager.showToast(message, 'success');
            this.updateTechTreeDisplay();
        }
    }
    
    handleUpgradePurchased(data) {
        const { player_numeric_id, upgrade_id, message } = data;
        
        if (player_numeric_id === this.game.playerId) {
            this.game.uiManager.showToast(message, 'success');
            this.updateTechTreeDisplay();
        }
    }
    
    handleAbilityUsed(data) {
        const { player_numeric_id, ability_id, message } = data;
        
        if (player_numeric_id === this.game.playerId) {
            this.game.uiManager.showToast(message, 'info');
        }
    }
    
    updateFromGameState(gameState) {
        // Update tech tree when game state changes
        const player = gameState.players.find(p => p.id === this.game.playerId);
        if (player) {
            this.currentLevel = player.tech_level || 'manor';
            this.techTree = player.tech_tree;
            
            // Update button
            const techButton = document.getElementById('tech-tree-btn');
            if (techButton) {
                techButton.querySelector('.tech-level').textContent = this.techLevels[this.currentLevel].name;
            }
            
            // Update display if open
            if (this.isOpen) {
                this.updateTechTreeDisplay();
            }
        }
    }
}