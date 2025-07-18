/**
 * Follower System
 * Manages follower placement, recall, and UI for Carcassonne: War of Ages
 */

export class FollowerSystem {
    constructor(game) {
        this.game = game;
        this.followers = new Map(); // follower_id -> follower data
        this.selectedTileForPlacement = null;
        this.isPlacingFollower = false;
        this.recallingFollowers = new Map(); // follower_id -> recall start time
        
        // Follower types with their descriptions
        this.followerTypes = {
            magistrate: {
                name: "Magistrate",
                description: "Claims cities for gold production",
                icon: "👔",
                validTiles: ["capital_city", "city"]
            },
            farmer: {
                name: "Farmer", 
                description: "Claims fields for food production",
                icon: "🌾",
                validTiles: ["field"]
            },
            monk: {
                name: "Monk",
                description: "Claims monasteries for faith production", 
                icon: "🙏",
                validTiles: ["monastery"]
            },
            scout: {
                name: "Scout",
                description: "Claims any tile for the player",
                icon: "🔍",
                validTiles: null // Can claim any tile
            }
        };
    }
    
    init() {
        this.setupEventListeners();
        this.createFollowerUI();
    }
    
    setupEventListeners() {
        // Listen for follower-related websocket messages
        this.game.websocketClient.on('follower_placed', (data) => this.handleFollowerPlaced(data));
        this.game.websocketClient.on('follower_recalled', (data) => this.handleFollowerRecalled(data));
        this.game.websocketClient.on('follower_recall_complete', (data) => this.handleFollowerRecallComplete(data));
    }
    
    createFollowerUI() {
        // Create follower panel
        const followerPanel = document.createElement('div');
        followerPanel.id = 'follower-panel';
        followerPanel.className = 'follower-panel';
        followerPanel.innerHTML = `
            <h3>Followers</h3>
            <div class="follower-count">
                Available: <span id="followers-available">8</span> / 8
            </div>
            <div class="follower-types">
                ${Object.entries(this.followerTypes).map(([type, info]) => `
                    <button class="follower-type-btn" data-type="${type}" title="${info.description}">
                        <span class="follower-icon">${info.icon}</span>
                        <span class="follower-name">${info.name}</span>
                    </button>
                `).join('')}
            </div>
            <div class="placed-followers">
                <h4>Placed Followers</h4>
                <div id="placed-followers-list"></div>
            </div>
        `;
        
        // Add to UI
        const gameUI = document.querySelector('.game-ui');
        gameUI.appendChild(followerPanel);
        
        // Add event listeners to follower type buttons
        document.querySelectorAll('.follower-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.type;
                this.startFollowerPlacement(type);
            });
        });
    }
    
    startFollowerPlacement(followerType) {
        if (!this.game.gameState) return;
        
        const player = this.game.gameState.players.find(p => p.id === this.game.playerId);
        if (!player || player.followers_available <= 0) {
            this.game.uiManager.showToast("No followers available!", 'error');
            return;
        }
        
        this.isPlacingFollower = true;
        this.selectedFollowerType = followerType;
        
        // Highlight valid tiles
        this.highlightValidTiles(followerType);
        
        // Update UI
        document.querySelectorAll('.follower-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === followerType);
        });
        
        this.game.uiManager.showToast(`Select a tile to place ${this.followerTypes[followerType].name}`, 'info');
    }
    
    highlightValidTiles(followerType) {
        if (!this.game.tileSystem || !this.game.gameState) return;
        
        const followerInfo = this.followerTypes[followerType];
        const player = this.game.gameState.players.find(p => p.id === this.game.playerId);
        if (!player) return;
        
        // Clear previous highlights
        this.game.tileSystem.clearHighlights();
        
        // Highlight owned tiles that can accept this follower type
        this.game.gameState.tiles.forEach(tile => {
            if (tile.owner === this.game.playerId && !tile.follower_id) {
                // Check if follower type is valid for this tile
                if (!followerInfo.validTiles || followerInfo.validTiles.includes(tile.type)) {
                    this.game.tileSystem.highlightTile(tile.x, tile.y, 0x00ff00, 0.5);
                }
            }
        });
    }
    
    handleTileClick(x, y) {
        if (!this.isPlacingFollower) return false;
        
        const tile = this.game.gameState.tiles.find(t => t.x === x && t.y === y);
        if (!tile) return false;
        
        // Check if tile is valid for placement
        const followerInfo = this.followerTypes[this.selectedFollowerType];
        if (tile.owner !== this.game.playerId || tile.follower_id) {
            this.game.uiManager.showToast("Cannot place follower on this tile", 'error');
            return true;
        }
        
        if (followerInfo.validTiles && !followerInfo.validTiles.includes(tile.type)) {
            this.game.uiManager.showToast(`${followerInfo.name} cannot be placed on ${tile.type} tiles`, 'error');
            return true;
        }
        
        // Send placement command
        this.placeFollower(tile.id, this.selectedFollowerType);
        
        // Cancel placement mode
        this.cancelFollowerPlacement();
        
        return true; // Handled
    }
    
    placeFollower(tileId, followerType) {
        this.game.websocketClient.send({
            type: 'cmd',
            payload: {
                action: 'placeFollower',
                data: {
                    tile_id: tileId,
                    follower_type: followerType
                }
            }
        });
    }
    
    recallFollower(followerId) {
        this.game.websocketClient.send({
            type: 'cmd',
            payload: {
                action: 'recallFollower',
                data: {
                    follower_id: followerId
                }
            }
        });
    }
    
    cancelFollowerPlacement() {
        this.isPlacingFollower = false;
        this.selectedFollowerType = null;
        this.game.tileSystem.clearHighlights();
        
        document.querySelectorAll('.follower-type-btn').forEach(btn => {
            btn.classList.remove('active');
        });
    }
    
    handleFollowerPlaced(data) {
        const { follower_id, follower_type, tile_id, player_numeric_id, followers_available } = data;
        
        // Add follower to our tracking
        this.followers.set(follower_id, {
            id: follower_id,
            type: follower_type,
            tile_id: tile_id,
            player_id: player_numeric_id
        });
        
        // Update UI if it's our follower
        if (player_numeric_id === this.game.playerId) {
            document.getElementById('followers-available').textContent = followers_available;
            this.updatePlacedFollowersList();
        }
        
        // Update tile visual
        const tile = this.game.gameState.tiles.find(t => t.id === tile_id);
        if (tile && this.game.tileSystem) {
            this.game.tileSystem.addFollowerToTile(tile, follower_type, player_numeric_id);
        }
    }
    
    handleFollowerRecalled(data) {
        const { follower_id, recall_duration } = data;
        
        // Start tracking recall
        this.recallingFollowers.set(follower_id, Date.now());
        
        // Update UI
        this.updatePlacedFollowersList();
        
        // Show visual indicator on tile
        const follower = this.followers.get(follower_id);
        if (follower && this.game.tileSystem) {
            const tile = this.game.gameState.tiles.find(t => t.id === follower.tile_id);
            if (tile) {
                this.game.tileSystem.showRecallAnimation(tile);
            }
        }
    }
    
    handleFollowerRecallComplete(data) {
        const { follower_id, player_id } = data;
        
        // Remove from tracking
        const follower = this.followers.get(follower_id);
        if (follower) {
            // Remove visual from tile
            const tile = this.game.gameState.tiles.find(t => t.id === follower.tile_id);
            if (tile && this.game.tileSystem) {
                this.game.tileSystem.removeFollowerFromTile(tile);
            }
            
            this.followers.delete(follower_id);
        }
        
        this.recallingFollowers.delete(follower_id);
        
        // Update UI
        if (parseInt(player_id) === this.game.playerId) {
            const player = this.game.gameState.players.find(p => p.id === this.game.playerId);
            if (player) {
                document.getElementById('followers-available').textContent = player.followers_available;
            }
            this.updatePlacedFollowersList();
        }
    }
    
    updatePlacedFollowersList() {
        const listContainer = document.getElementById('placed-followers-list');
        listContainer.innerHTML = '';
        
        // Get followers for current player
        const playerFollowers = Array.from(this.followers.values())
            .filter(f => f.player_id === this.game.playerId);
        
        if (playerFollowers.length === 0) {
            listContainer.innerHTML = '<p class="no-followers">No followers placed</p>';
            return;
        }
        
        playerFollowers.forEach(follower => {
            const tile = this.game.gameState.tiles.find(t => t.id === follower.tile_id);
            if (!tile) return;
            
            const followerInfo = this.followerTypes[follower.type];
            const isRecalling = this.recallingFollowers.has(follower.id);
            
            const followerEl = document.createElement('div');
            followerEl.className = 'placed-follower-item' + (isRecalling ? ' recalling' : '');
            followerEl.innerHTML = `
                <span class="follower-info">
                    ${followerInfo.icon} ${followerInfo.name} at (${tile.x}, ${tile.y})
                </span>
                ${!isRecalling ? `
                    <button class="recall-btn" onclick="game.followerSystem.recallFollower('${follower.id}')">
                        Recall
                    </button>
                ` : '<span class="recall-status">Recalling...</span>'}
            `;
            
            listContainer.appendChild(followerEl);
        });
    }
    
    updateGameState(gameState) {
        // Sync followers from game state
        if (gameState.followers) {
            this.followers.clear();
            gameState.followers.forEach(follower => {
                this.followers.set(follower.id, follower);
            });
        }
        
        // Update UI
        const player = gameState.players.find(p => p.id === this.game.playerId);
        if (player) {
            document.getElementById('followers-available').textContent = player.followers_available || 0;
        }
        
        this.updatePlacedFollowersList();
    }
    
    cleanup() {
        this.followers.clear();
        this.recallingFollowers.clear();
        this.cancelFollowerPlacement();
    }
}