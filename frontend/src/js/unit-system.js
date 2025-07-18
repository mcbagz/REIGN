// Unit System Class - Complete Implementation with PixiJS Rendering
class UnitSystem {
    constructor(gameState, renderer, tweenSystem = null) {
        if (!gameState) {
            throw new Error('UnitSystem requires gameState parameter');
        }
        if (!renderer) {
            throw new Error('UnitSystem requires renderer parameter');
        }
        
        this.gameState = gameState;
        this.renderer = renderer;
        this.tweenSystem = tweenSystem;
        this.initialized = false;
        this.trainingQueue = [];
        
        // Unit containers
        this.unitContainer = null;
        this.unitSprites = new Map(); // unitId -> PIXI.Container
        this.unitTextures = new Map(); // unitType -> PIXI.Texture
        this.healthBars = new Map(); // unitId -> PIXI.Container
        
        // Animation system (fallback for when tween system is not available)
        this.animations = new Map(); // unitId -> animation data
        this.deadUnits = new Set(); // Units pending removal
        
        // Combat effects
        this.combatEffects = [];
        this.effectPool = [];
        
        console.log('UnitSystem created successfully' + (tweenSystem ? ' with TweenSystem' : ''));
    }
    
    async init() {
        try {
            // Create unit container
            this.unitContainer = new PIXI.Container();
            this.renderer.viewport.addChild(this.unitContainer);
            
            // Load unit sprites
            await this.loadUnitSprites();
            
            this.initialized = true;
            console.log('UnitSystem initialized');
        } catch (error) {
            console.error('Failed to initialize UnitSystem:', error);
            throw error;
        }
    }
    
    async loadUnitSprites() {
        const unitTypes = ['infantry', 'archer', 'knight', 'siege'];
        
        for (const unitType of unitTypes) {
            try {
                // Try to load actual sprite
                const texture = await PIXI.Assets.load(`assets/sprites/${unitType}.png`);
                this.unitTextures.set(unitType, texture);
            } catch (error) {
                console.warn(`Failed to load sprite for ${unitType}, using fallback:`, error);
                // Create fallback colored circle
                const graphics = new PIXI.Graphics();
                const color = this.getUnitColor(unitType);
                graphics.beginFill(color);
                graphics.drawCircle(32, 32, 24);
                graphics.endFill();
                
                // Add type indicator
                graphics.lineStyle(2, 0xffffff);
                graphics.drawRect(24, 24, 16, 16);
                
                this.unitTextures.set(unitType, this.renderer.app.renderer.generateTexture(graphics));
            }
        }
    }
    
    getUnitColor(unitType) {
        const colors = {
            infantry: 0x4a5568,
            archer: 0x38a169,
            knight: 0xd69e2e,
            siege: 0xe53e3e
        };
        return colors[unitType] || 0x718096;
    }
    
    createUnit(unit) {
        if (this.unitSprites.has(unit.id)) {
            console.warn(`Unit ${unit.id} already exists`);
            return;
        }
        
        // Add unit to game state
        if (!this.gameState.units) {
            this.gameState.units = new Map();
        }
        this.gameState.units.set(unit.id, unit);
        
        // Create unit container
        const unitContainer = new PIXI.Container();
        
        // Create unit sprite
        const texture = this.unitTextures.get(unit.type);
        const sprite = new PIXI.Sprite(texture);
        sprite.anchor.set(0.5, 0.5);
        sprite.x = GameConfig.TILE_SIZE / 2;
        sprite.y = GameConfig.TILE_SIZE / 2;
        
        // Scale sprite to fit tile
        const scale = (GameConfig.TILE_SIZE * 0.6) / Math.max(sprite.width, sprite.height);
        sprite.scale.set(scale, scale);
        
        // Add player color tint
        if (unit.owner !== undefined) {
            const playerColor = GameConfig.COLORS.PLAYERS[unit.owner] || 0xffffff;
            sprite.tint = playerColor;
        }
        
        unitContainer.addChild(sprite);
        
        // Create health bar
        const healthBar = this.createHealthBar(unit);
        unitContainer.addChild(healthBar);
        
        // Position unit on grid
        this.positionUnit(unitContainer, unit.position);
        
        // Add to containers and maps
        this.unitContainer.addChild(unitContainer);
        this.unitSprites.set(unit.id, unitContainer);
        this.healthBars.set(unit.id, healthBar);
        
        // Store unit reference
        unitContainer.unitData = unit;
        
        // Add hover effects
        this.addUnitInteraction(unitContainer, unit);
        
        console.log(`Created unit ${unit.id} (${unit.type}) at (${unit.position.x}, ${unit.position.y})`);
    }
    
    createHealthBar(unit) {
        const healthBarContainer = new PIXI.Container();
        
        // Background
        const background = new PIXI.Graphics();
        background.beginFill(0x000000, 0.7);
        background.drawRect(-20, -35, 40, 6);
        background.endFill();
        
        // Health bar - handle both camelCase and snake_case
        const maxHp = unit.maxHp || unit.max_hp || 100;
        const healthBar = new PIXI.Graphics();
        const healthPercent = unit.hp / maxHp;
        const healthColor = healthPercent > 0.6 ? 0x00ff00 : 
                           healthPercent > 0.3 ? 0xffff00 : 0xff0000;
        
        healthBar.beginFill(healthColor);
        healthBar.drawRect(-19, -34, 38 * healthPercent, 4);
        healthBar.endFill();
        
        healthBarContainer.addChild(background);
        healthBarContainer.addChild(healthBar);
        
        // Store references for updates
        healthBarContainer.healthBar = healthBar;
        
        return healthBarContainer;
    }
    
    updateHealthBar(unitId, hp, maxHp) {
        const healthBarContainer = this.healthBars.get(unitId);
        if (!healthBarContainer) return;
        
        const healthBar = healthBarContainer.healthBar;
        const healthPercent = hp / maxHp;
        const healthColor = healthPercent > 0.6 ? 0x00ff00 : 
                           healthPercent > 0.3 ? 0xffff00 : 0xff0000;
        
        healthBar.clear();
        healthBar.beginFill(healthColor);
        healthBar.drawRect(-19, -34, 38 * healthPercent, 4);
        healthBar.endFill();
    }
    
    addUnitInteraction(unitContainer, unit) {
        unitContainer.interactive = true;
        unitContainer.buttonMode = true;
        
        unitContainer.on('pointerover', () => {
            unitContainer.scale.set(1.1, 1.1);
            this.showUnitTooltip(unit);
        });
        
        unitContainer.on('pointerout', () => {
            unitContainer.scale.set(1.0, 1.0);
            this.hideUnitTooltip();
        });
        
        unitContainer.on('pointerdown', () => {
            this.selectUnit(unit);
        });
    }
    
    showUnitTooltip(unit) {
        // Create tooltip showing unit stats
        const tooltip = document.getElementById('unit-tooltip') || document.createElement('div');
        tooltip.id = 'unit-tooltip';
        tooltip.style.position = 'absolute';
        tooltip.style.backgroundColor = 'rgba(0,0,0,0.8)';
        tooltip.style.color = 'white';
        tooltip.style.padding = '8px';
        tooltip.style.borderRadius = '4px';
        tooltip.style.fontSize = '12px';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.zIndex = '1000';
        
        const maxHp = unit.maxHp || unit.max_hp || 100;
        tooltip.innerHTML = `
            <div><strong>${unit.type.charAt(0).toUpperCase() + unit.type.slice(1)}</strong></div>
            <div>HP: ${unit.hp}/${maxHp}</div>
            <div>Attack: ${unit.attack}</div>
            <div>Speed: ${unit.speed}</div>
            <div>Range: ${unit.range}</div>
            <div>Owner: Player ${unit.owner + 1}</div>
        `;
        
        document.body.appendChild(tooltip);
        
        // Position tooltip near cursor
        document.addEventListener('mousemove', this.updateTooltipPosition);
    }
    
    hideUnitTooltip() {
        const tooltip = document.getElementById('unit-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
        document.removeEventListener('mousemove', this.updateTooltipPosition);
    }
    
    updateTooltipPosition = (event) => {
        const tooltip = document.getElementById('unit-tooltip');
        if (tooltip) {
            tooltip.style.left = (event.clientX + 10) + 'px';
            tooltip.style.top = (event.clientY - 10) + 'px';
        }
    }
    
    selectUnit(unit) {
        // Dispatch unit selection event
        window.dispatchEvent(new CustomEvent('unit:selected', {
            detail: { unit }
        }));
        
        console.log(`Selected unit ${unit.id} (${unit.type})`);
    }
    
    positionUnit(unitContainer, position) {
        unitContainer.x = position.x * GameConfig.TILE_SIZE;
        unitContainer.y = position.y * GameConfig.TILE_SIZE;
    }
    
    moveUnit(unitId, newPosition, duration = 1000) {
        const unitContainer = this.unitSprites.get(unitId);
        if (!unitContainer) return;
        
        const startX = unitContainer.x;
        const startY = unitContainer.y;
        const endX = newPosition.x * GameConfig.TILE_SIZE;
        const endY = newPosition.y * GameConfig.TILE_SIZE;
        
        // Use tween system if available, otherwise fallback to old animation
        if (this.tweenSystem) {
            // Use smooth tween animation
            this.tweenSystem.tweenUnitPosition(
                unitContainer, 
                endX, 
                endY, 
                unitId,
                {
                    onComplete: () => {
                        // Animation complete
                        console.log(`Unit ${unitId} movement animation completed`);
                    }
                }
            );
        } else {
            // Fallback to old animation system
            const animation = {
                unitId,
                startX,
                startY,
                endX,
                endY,
                duration,
                elapsed: 0,
                type: 'movement'
            };
            
            this.animations.set(unitId, animation);
        }
        
        // Update unit data
        if (unitContainer.unitData) {
            unitContainer.unitData.position = newPosition;
        }
        
        console.log(`Moving unit ${unitId} to (${newPosition.x}, ${newPosition.y})`);
    }
    
    updateUnit(unitData) {
        const unitContainer = this.unitSprites.get(unitData.id);
        if (!unitContainer) {
            // Unit doesn't exist, create it
            this.createUnit(unitData);
            return;
        }
        
        // Update unit data
        unitContainer.unitData = unitData;
        
        // Update health bar - handle both camelCase and snake_case
        const maxHp = unitData.maxHp || unitData.max_hp || 100;
        this.updateHealthBar(unitData.id, unitData.hp, maxHp);
        
        // Handle death
        if (unitData.hp <= 0 && !this.deadUnits.has(unitData.id)) {
            this.startDeathAnimation(unitData.id);
        }
        
        // Update position if needed
        const currentPos = {
            x: Math.round(unitContainer.x / GameConfig.TILE_SIZE),
            y: Math.round(unitContainer.y / GameConfig.TILE_SIZE)
        };
        
        if (currentPos.x !== unitData.position.x || currentPos.y !== unitData.position.y) {
            this.moveUnit(unitData.id, unitData.position);
        }
    }
    
    startDeathAnimation(unitId) {
        const unitContainer = this.unitSprites.get(unitId);
        if (!unitContainer) return;
        
        this.deadUnits.add(unitId);
        
        const animation = {
            unitId,
            type: 'death',
            duration: 1000,
            elapsed: 0
        };
        
        this.animations.set(unitId, animation);
        
        // Create death effect
        this.createDeathEffect(unitContainer.x + GameConfig.TILE_SIZE / 2, 
                              unitContainer.y + GameConfig.TILE_SIZE / 2);
        
        console.log(`Starting death animation for unit ${unitId}`);
    }
    
    createDeathEffect(x, y) {
        const graphics = new PIXI.Graphics();
        graphics.beginFill(0xff0000, 0.8);
        graphics.drawCircle(0, 0, 20);
        graphics.endFill();
        graphics.x = x;
        graphics.y = y;
        
        this.unitContainer.addChild(graphics);
        
        // Animate death effect
        const effect = {
            sprite: graphics,
            duration: 500,
            elapsed: 0,
            type: 'death-effect'
        };
        
        this.combatEffects.push(effect);
    }
    
    createCombatEffect(attackerPos, targetPos, damage) {
        // Create damage number
        const damageText = new PIXI.Text(damage.toString(), {
            fontFamily: 'Arial',
            fontSize: 16,
            fill: 0xffffff,
            stroke: 0x000000,
            strokeThickness: 2
        });
        
        damageText.anchor.set(0.5, 0.5);
        damageText.x = targetPos.x * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2;
        damageText.y = targetPos.y * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2;
        
        this.unitContainer.addChild(damageText);
        
        // Animate damage text
        const effect = {
            sprite: damageText,
            duration: 1000,
            elapsed: 0,
            type: 'damage-text',
            startY: damageText.y
        };
        
        this.combatEffects.push(effect);
    }
    
    removeUnit(unitId) {
        const unitContainer = this.unitSprites.get(unitId);
        if (unitContainer) {
            this.unitContainer.removeChild(unitContainer);
            this.unitSprites.delete(unitId);
            this.healthBars.delete(unitId);
            this.animations.delete(unitId);
            this.deadUnits.delete(unitId);
            
            // Remove from game state
            if (this.gameState.units) {
                this.gameState.units.delete(unitId);
            }
            
            console.log(`Removed unit ${unitId} from both renderer and game state`);
        }
    }
    
    trainUnit(tileId, unitType) {
        console.log(`Training ${unitType} at tile ${tileId}`);
        
        // Send training request to backend (when WebSocket is implemented)
        window.dispatchEvent(new CustomEvent('unit:train', {
            detail: { tileId, unitType }
        }));
        
        return true;
    }
    
    update(deltaTime) {
        if (!this.initialized) return;
        
        // Update animations
        this.updateAnimations(deltaTime);
        
        // Update combat effects
        this.updateCombatEffects(deltaTime);
        
        // Update training queue
        this.updateTrainingQueue(deltaTime);
    }
    
    updateAnimations(deltaTime) {
        for (const [unitId, animation] of this.animations) {
            animation.elapsed += deltaTime;
            const progress = Math.min(animation.elapsed / animation.duration, 1);
            
            const unitContainer = this.unitSprites.get(unitId);
            if (!unitContainer) continue;
            
            if (animation.type === 'movement') {
                // Smooth movement interpolation
                const x = animation.startX + (animation.endX - animation.startX) * progress;
                const y = animation.startY + (animation.endY - animation.startY) * progress;
                unitContainer.x = x;
                unitContainer.y = y;
            } else if (animation.type === 'death') {
                // Fade out death animation
                unitContainer.alpha = 1 - progress;
                unitContainer.scale.set(1 - progress * 0.5, 1 - progress * 0.5);
            }
            
            // Remove completed animations
            if (progress >= 1) {
                if (animation.type === 'death') {
                    this.removeUnit(unitId);
                }
                this.animations.delete(unitId);
            }
        }
    }
    
    updateCombatEffects(deltaTime) {
        for (let i = this.combatEffects.length - 1; i >= 0; i--) {
            const effect = this.combatEffects[i];
            effect.elapsed += deltaTime;
            const progress = Math.min(effect.elapsed / effect.duration, 1);
            
            if (effect.type === 'damage-text') {
                effect.sprite.y = effect.startY - progress * 30;
                effect.sprite.alpha = 1 - progress;
            } else if (effect.type === 'death-effect') {
                effect.sprite.scale.set(1 + progress * 2, 1 + progress * 2);
                effect.sprite.alpha = 1 - progress;
            }
            
            if (progress >= 1) {
                this.unitContainer.removeChild(effect.sprite);
                this.combatEffects.splice(i, 1);
            }
        }
    }
    
    updateTrainingQueue(deltaTime) {
        // Update training queue (placeholder for now)
        // This will be implemented when WebSocket integration is done
    }
    
    handleCombatEvent(event) {
        const { attackerId, targetId, damage, position } = event;
        
        // Create combat effect
        const attackerContainer = this.unitSprites.get(attackerId);
        const targetContainer = this.unitSprites.get(targetId);
        
        if (attackerContainer && targetContainer) {
            const attackerPos = {
                x: Math.round(attackerContainer.x / GameConfig.TILE_SIZE),
                y: Math.round(attackerContainer.y / GameConfig.TILE_SIZE)
            };
            
            const targetPos = {
                x: Math.round(targetContainer.x / GameConfig.TILE_SIZE),
                y: Math.round(targetContainer.y / GameConfig.TILE_SIZE)
            };
            
            this.createCombatEffect(attackerPos, targetPos, damage);
        }
    }
    
    getUnitAt(position) {
        for (const [unitId, unitContainer] of this.unitSprites) {
            const unitPos = {
                x: Math.round(unitContainer.x / GameConfig.TILE_SIZE),
                y: Math.round(unitContainer.y / GameConfig.TILE_SIZE)
            };
            
            if (unitPos.x === position.x && unitPos.y === position.y) {
                return unitContainer.unitData;
            }
        }
        return null;
    }
    
    getUnitsInArea(center, radius) {
        const unitsInArea = [];
        
        for (const [unitId, unitContainer] of this.unitSprites) {
            const unitPos = {
                x: Math.round(unitContainer.x / GameConfig.TILE_SIZE),
                y: Math.round(unitContainer.y / GameConfig.TILE_SIZE)
            };
            
            const distance = Math.abs(unitPos.x - center.x) + Math.abs(unitPos.y - center.y);
            if (distance <= radius) {
                unitsInArea.push(unitContainer.unitData);
            }
        }
        
        return unitsInArea;
    }
    
    // Unit highlighting for selection
    highlightUnit(unitId, highlighted) {
        const unitSprite = this.unitSprites.get(unitId);
        if (!unitSprite) return;
        
        // Remove existing highlight
        const existingHighlight = unitSprite.getChildByName('selection-highlight');
        if (existingHighlight) {
            unitSprite.removeChild(existingHighlight);
        }
        
        if (highlighted) {
            // Add selection highlight
            const highlight = new PIXI.Graphics();
            highlight.name = 'selection-highlight';
            highlight.lineStyle(3, 0x00ff00, 1);
            highlight.drawCircle(0, 0, 32);
            unitSprite.addChild(highlight);
        }
    }
    
    // Attack target functionality
    attackTarget(unitId, target) {
        const unit = this.gameState.units.get(unitId);
        if (!unit) {
            console.warn(`Unit ${unitId} not found for attack`);
            return;
        }
        
        console.log(`Unit ${unitId} attacking target:`, target);
        
        // Determine target position
        let targetPosition;
        if (target.position) {
            targetPosition = target.position;
        } else if (target.x !== undefined && target.y !== undefined) {
            targetPosition = { x: target.x, y: target.y };
        } else {
            console.warn('Invalid target for attack:', target);
            return;
        }
        
        // Check if target is a tile (has tile_type property or is a building)
        const isTileTarget = target.tile_type || target.type === 'tile' || (!target.id && !target.owner === undefined);
        
        if (isTileTarget) {
            // Send tile attack command via WebSocket
            this.sendTileAttackCommand(unitId, targetPosition);
        } else {
            // Send unit attack command (if needed in the future)
            this.sendUnitAttackCommand(unitId, target);
        }
        
        // Show combat effect
        this.createCombatEffect(unit.position, targetPosition, 25);
    }
    
    // Send tile attack command via WebSocket
    sendTileAttackCommand(unitId, targetPosition) {
        if (window.game && window.game.websocketClient) {
            const message = {
                type: 'command',
                payload: {
                    action: 'attackTile',
                    parameters: {
                        unit_id: unitId,
                        target_position: targetPosition
                    }
                },
                timestamp: Date.now(),
                message_id: `attack_tile_${Date.now()}_${Math.random()}`,
                player_id: window.game.myPlayerId
            };
            
            window.game.websocketClient.send(message);
            console.log('Sent tile attack command:', message);
        } else {
            console.warn('WebSocket client not available for tile attack command');
        }
    }
    
    // Send unit attack command via WebSocket (for future use)
    sendUnitAttackCommand(unitId, target) {
        if (window.game && window.game.websocketClient) {
            const message = {
                type: 'command',
                payload: {
                    action: 'attack_unit',
                    parameters: {
                        unit_id: unitId,
                        target_id: target.id
                    }
                },
                timestamp: Date.now(),
                message_id: `attack_unit_${Date.now()}_${Math.random()}`,
                player_id: window.game.myPlayerId
            };
            
            window.game.websocketClient.send(message);
            console.log('Sent unit attack command:', message);
        } else {
            console.warn('WebSocket client not available for unit attack command');
        }
    }
    
    // Send raid command via WebSocket
    sendRaidCommand(unitId, targetPosition) {
        if (window.game && window.game.websocketClient) {
            const message = {
                type: 'command',
                payload: {
                    action: 'raidTile',
                    parameters: {
                        unit_id: unitId,
                        target_position: targetPosition
                    }
                },
                timestamp: Date.now(),
                message_id: `raid_tile_${Date.now()}_${Math.random()}`,
                player_id: window.game.myPlayerId
            };
            
            window.game.websocketClient.send(message);
            console.log('Sent raid command:', message);
        } else {
            console.warn('WebSocket client not available for raid command');
        }
    }
    
    cleanup() {
        console.log('UnitSystem cleanup');
        
        // Remove all units
        for (const unitId of this.unitSprites.keys()) {
            this.removeUnit(unitId);
        }
        
        // Clear containers
        if (this.unitContainer && this.unitContainer.parent) {
            this.unitContainer.parent.removeChild(this.unitContainer);
        }
        
        // Clear maps
        this.unitSprites.clear();
        this.unitTextures.clear();
        this.healthBars.clear();
        this.animations.clear();
        this.deadUnits.clear();
        this.combatEffects.length = 0;
        
        this.initialized = false;
    }
} 