/**
 * ConquestSystem - Manages conquest-related UI elements and WebSocket events
 */
class ConquestSystem {
    constructor(app, wsClient, conquestContainer) {
        this.app = app;
        this.wsClient = wsClient;
        this.conquestLayer = conquestContainer; // Use provided container from renderer
        
        // UI Components
        this.capitalHpBars = new Map(); // position -> CapitalHpBar
        this.auraOverlays = new Map(); // position -> AuraOverlay
        this.bannerLayer = null;
        
        // Initialize
        this.setupBannerLayer();
        this.setupWebSocketHandlers();
        this.setupAnimationLoop();
    }
    
    setupBannerLayer() {
        this.bannerLayer = new BannerLayer(this.app.screen.width, this.app.screen.height);
        this.app.stage.addChild(this.bannerLayer.getContainer());
    }
    
    setupWebSocketHandlers() {
        // Handle tile attacks
        this.wsClient.on('tile_attack', (data) => {
            this.handleTileAttack(data);
        });
        
        // Handle raiding
        this.wsClient.on('raid', (data) => {
            this.handleRaid(data);
        });
        
        // Handle player elimination
        this.wsClient.on('player_eliminated', (data) => {
            this.handlePlayerEliminated(data);
        });
        
        // Handle game victory
        this.wsClient.on('game_victory', (data) => {
            this.handleGameVictory(data);
        });
        
        // Handle aura events
        this.wsClient.on('aura_enter', (data) => {
            this.handleAuraEnter(data);
        });
        
        this.wsClient.on('aura_exit', (data) => {
            this.handleAuraExit(data);
        });
        
        // Handle game state updates to sync HP bars
        this.wsClient.on('state', (data) => {
            this.handleGameStateUpdate(data);
        });
    }
    
    setupAnimationLoop() {
        // Animate aura overlays
        this.app.ticker.add(() => {
            this.auraOverlays.forEach(aura => {
                aura.animate();
            });
        });
    }
    
    // Handle tile attack events
    handleTileAttack(data) {
        const { attacker, target, damage, new_hp } = data;
        
        // Create damage indicator
        this.showDamageIndicator(target.position, damage);
        
        // Update HP bar if it's a capital
        if (target.tile_type === 'capital') {
            this.updateCapitalHp(target.position, new_hp, target.max_hp);
        }
        
        // Play attack sound effect
        this.playAttackSound();
        
        console.log(`Tile attack: ${attacker.name} dealt ${damage} damage to ${target.tile_type} at (${target.position.x}, ${target.position.y})`);
    }
    
    // Handle raid events
    handleRaid(data) {
        const { raider, target, resources_stolen } = data;
        
        // Show raid indicator
        this.showRaidIndicator(target.position, resources_stolen);
        
        // Play raid sound effect
        this.playRaidSound();
        
        console.log(`Raid: ${raider.name} stole ${resources_stolen} resources from tile at (${target.position.x}, ${target.position.y})`);
    }
    
    // Handle player elimination
    handlePlayerEliminated(data) {
        const { eliminated_player, eliminated_by } = data;
        
        // Show elimination banner
        this.bannerLayer.showPlayerEliminatedBanner(eliminated_player.name, eliminated_by.name);
        
        // Remove eliminated player's HP bars
        this.removePlayerHpBars(eliminated_player.id);
        
        // Play elimination sound
        this.playEliminationSound();
        
        console.log(`Player eliminated: ${eliminated_player.name} by ${eliminated_by.name}`);
    }
    
    // Handle game victory
    handleGameVictory(data) {
        const { winner, game_duration } = data;
        
        // Show victory banner
        this.bannerLayer.showGameVictoryBanner(winner.name);
        
        // Clear all conquest elements
        this.clearAllElements();
        
        // Play victory sound
        this.playVictorySound();
        
        console.log(`Game victory: ${winner.name} won in ${game_duration} seconds`);
    }
    
    // Handle aura enter events
    handleAuraEnter(data) {
        const { watchtower_position, affected_positions } = data;
        
        // Create aura overlay at watchtower position
        if (!this.auraOverlays.has(this.positionKey(watchtower_position))) {
            const aura = new AuraOverlay(watchtower_position, 2, 0x0088FF, 0.3);
            this.auraOverlays.set(this.positionKey(watchtower_position), aura);
            this.conquestLayer.addChild(aura.getContainer());
        }
        
        // Show the aura
        const aura = this.auraOverlays.get(this.positionKey(watchtower_position));
        aura.show();
        
        console.log(`Aura activated at watchtower (${watchtower_position.x}, ${watchtower_position.y})`);
    }
    
    // Handle aura exit events
    handleAuraExit(data) {
        const { watchtower_position } = data;
        
        // Hide the aura
        const aura = this.auraOverlays.get(this.positionKey(watchtower_position));
        if (aura) {
            aura.hide();
        }
        
        console.log(`Aura deactivated at watchtower (${watchtower_position.x}, ${watchtower_position.y})`);
    }
    
    // Handle game state updates
    handleGameStateUpdate(data) {
        if (data.game_state && data.game_state.players) {
            // Update capital HP bars for all players
            data.game_state.players.forEach(player => {
                if (player.capital_position && player.capital_hp !== undefined) {
                    this.updateCapitalHp(player.capital_position, player.capital_hp, 1000);
                }
            });
        }
    }
    
    // Update or create capital HP bar
    updateCapitalHp(position, currentHp, maxHp = 1000) {
        const key = this.positionKey(position);
        
        if (!this.capitalHpBars.has(key)) {
            // Create new HP bar
            const hpBar = new CapitalHpBar(position, maxHp, currentHp);
            this.capitalHpBars.set(key, hpBar);
            this.conquestLayer.addChild(hpBar.getContainer());
        } else {
            // Update existing HP bar
            const hpBar = this.capitalHpBars.get(key);
            hpBar.setHp(currentHp);
            hpBar.setMaxHp(maxHp);
            
            // Animate damage if HP decreased
            if (currentHp < hpBar.currentHp) {
                hpBar.animateDamage(hpBar.currentHp - currentHp);
            }
        }
    }
    
    // Show damage indicator
    showDamageIndicator(position, damage) {
        // Create floating damage text
        const damageText = new PIXI.Text(`-${damage}`, {
            fontSize: 16,
            fill: 0xFF0000,
            fontFamily: 'Arial',
            fontWeight: 'bold'
        });
        
        damageText.anchor.set(0.5, 0.5);
        damageText.position.set(
            position.x * 32 + 16,
            position.y * 32 + 16
        );
        
        this.conquestLayer.addChild(damageText);
        
        // Animate damage text floating up and fading out
        let startY = damageText.position.y;
        let alpha = 1;
        
        const animateDamage = () => {
            damageText.position.y -= 1;
            alpha -= 0.02;
            damageText.alpha = alpha;
            
            if (alpha > 0) {
                requestAnimationFrame(animateDamage);
            } else {
                this.conquestLayer.removeChild(damageText);
                damageText.destroy();
            }
        };
        
        requestAnimationFrame(animateDamage);
    }
    
    // Show raid indicator
    showRaidIndicator(position, resourcesStolen) {
        // Create floating resource text
        const raidText = new PIXI.Text(`+${resourcesStolen}`, {
            fontSize: 14,
            fill: 0xFFD700,
            fontFamily: 'Arial',
            fontWeight: 'bold'
        });
        
        raidText.anchor.set(0.5, 0.5);
        raidText.position.set(
            position.x * 32 + 16,
            position.y * 32 + 16
        );
        
        this.conquestLayer.addChild(raidText);
        
        // Animate raid text floating up and fading out
        let alpha = 1;
        
        const animateRaid = () => {
            raidText.position.y -= 0.5;
            alpha -= 0.015;
            raidText.alpha = alpha;
            
            if (alpha > 0) {
                requestAnimationFrame(animateRaid);
            } else {
                this.conquestLayer.removeChild(raidText);
                raidText.destroy();
            }
        };
        
        requestAnimationFrame(animateRaid);
    }
    
    // Remove HP bars for eliminated player
    removePlayerHpBars(playerId) {
        // Note: This would need player ID tracking in HP bars
        // For now, we'll clear all HP bars when a player is eliminated
        this.capitalHpBars.forEach((hpBar, key) => {
            this.conquestLayer.removeChild(hpBar.getContainer());
            hpBar.destroy();
        });
        this.capitalHpBars.clear();
    }
    
    // Clear all conquest elements
    clearAllElements() {
        // Clear HP bars
        this.capitalHpBars.forEach((hpBar, key) => {
            this.conquestLayer.removeChild(hpBar.getContainer());
            hpBar.destroy();
        });
        this.capitalHpBars.clear();
        
        // Clear auras
        this.auraOverlays.forEach((aura, key) => {
            this.conquestLayer.removeChild(aura.getContainer());
            aura.destroy();
        });
        this.auraOverlays.clear();
    }
    
    // Helper to create position key
    positionKey(position) {
        return `${position.x},${position.y}`;
    }
    
    // Sound effects (placeholders)
    playAttackSound() {
        // TODO: Implement attack sound
        console.log('Attack sound');
    }
    
    playRaidSound() {
        // TODO: Implement raid sound
        console.log('Raid sound');
    }
    
    playEliminationSound() {
        // TODO: Implement elimination sound
        console.log('Elimination sound');
    }
    
    playVictorySound() {
        // TODO: Implement victory sound
        console.log('Victory sound');
    }
    
    // Update screen size
    updateScreenSize(width, height) {
        this.bannerLayer.updateScreenSize(width, height);
    }
    
    // Cleanup
    destroy() {
        this.clearAllElements();
        this.bannerLayer.destroy();
        // Note: conquestLayer is owned by renderer, don't destroy it here
    }
}

// Make it available globally
window.ConquestSystem = ConquestSystem; 