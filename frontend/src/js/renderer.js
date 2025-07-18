// Game Renderer Class - Enhanced with Grid Support
class GameRenderer {
    constructor(unitSystem = null) {
        this.app = null;
        this.container = null;
        this.viewport = null;
        this.gridContainer = null;
        this.gridTexture = null;
        this.tileContainers = new Map(); // key: "x,y", value: PIXI.Container
        this.conquestContainer = null; // For conquest system visual elements
        this.initialized = false;
        this.gameState = null; // Reference to game state
        this.unitSystem = unitSystem; // Reference to unit system for proper unit rendering
    }
    
    async init() {
        try {
            // Initialize PixiJS application
            this.app = new PIXI.Application({
                width: GameConfig.CANVAS_WIDTH,
                height: GameConfig.CANVAS_HEIGHT,
                backgroundColor: 0x1a252f,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true
            });
            
            // Add canvas to DOM
            this.container = document.getElementById('game-canvas-container');
            if (this.container) {
                this.container.appendChild(this.app.view);
                
                // Prevent default context menu on canvas
                this.app.view.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            }
            
            // Load sprite textures
            await this.loadSprites();
            
            // Initialize viewport with pan/zoom
            await this.initializeViewport();
            
            // Initialize grid system
            await this.initializeGrid();
            
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize renderer:', error);
            throw error;
        }
    }
    
    async loadSprites() {
        // Define sprite paths for all tile types
        const spritePaths = {
            'capital_city': 'assets/sprites/Capital.png',
            'city': 'assets/sprites/City.png',
            'field': 'assets/sprites/Field.png',
            'marsh': 'assets/sprites/Marsh.png',
            'barracks': 'assets/sprites/Barracks.png',
            'monastery': 'assets/sprites/Monastery.png',
            'mine': 'assets/sprites/Mine.png',
            'orchard': 'assets/sprites/Orchard.png',
            'watchtower': 'assets/sprites/Watchtower.png'
        };
        
        // Load all sprites
        this.sprites = {};
        for (const [type, path] of Object.entries(spritePaths)) {
            try {
                const texture = await PIXI.Assets.load(path);
                this.sprites[type] = texture;
                console.log(`Loaded sprite for ${type}`);
            } catch (error) {
                console.log(`No sprite found for ${type}, using fallback`);
                // Create a fallback colored rectangle
                const graphics = new PIXI.Graphics();
                graphics.beginFill(this.getTileColor(type));
                graphics.drawRect(0, 0, GameConfig.TILE_SIZE, GameConfig.TILE_SIZE);
                graphics.endFill();
                
                // Add a text label for the tile type
                const text = new PIXI.Text(type.replace('_', '\n'), {
                    fontFamily: 'Arial',
                    fontSize: 14,
                    fill: 0xffffff,
                    align: 'center'
                });
                text.anchor.set(0.5);
                text.x = GameConfig.TILE_SIZE / 2;
                text.y = GameConfig.TILE_SIZE / 2;
                graphics.addChild(text);
                
                this.sprites[type] = this.app.renderer.generateTexture(graphics);
            }
        }
    }
    
    async initializeViewport() {
        // Create viewport options
        const viewportOptions = {
            screenWidth: GameConfig.CANVAS_WIDTH,
            screenHeight: GameConfig.CANVAS_HEIGHT,
            worldWidth: GameConfig.GRID_WIDTH * GameConfig.TILE_SIZE,
            worldHeight: GameConfig.GRID_HEIGHT * GameConfig.TILE_SIZE,
            events: this.app.renderer.events
        };

        // Wait for pixi-viewport to load with timeout
        const maxWaitTime = 5000; // 5 seconds
        const startTime = Date.now();
        
        while (!window.pixiViewportLoaded) {
            if (Date.now() - startTime > maxWaitTime) {
                throw new Error('pixi-viewport failed to load within 5 seconds');
            }
            // Small delay to prevent blocking
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // For pixi-viewport 6.0.3 UMD, Viewport should be available on window.pixi_viewport
        if (!window.pixi_viewport || typeof window.pixi_viewport.Viewport === 'undefined') {
            throw new Error('pixi-viewport 6.0.3 not loaded - window.pixi_viewport.Viewport is undefined');
        }
        
        const ViewportConstructor = window.pixi_viewport.Viewport;
        
        // Create viewport using pixi-viewport 6.0.3 API
        this.viewport = new ViewportConstructor({
            screenWidth: GameConfig.CANVAS_WIDTH,
            screenHeight: GameConfig.CANVAS_HEIGHT,
            worldWidth: GameConfig.GRID_WIDTH * GameConfig.TILE_SIZE,
            worldHeight: GameConfig.GRID_HEIGHT * GameConfig.TILE_SIZE,
            events: this.app.renderer.events
        });
        
        // Add viewport to stage
        this.app.stage.addChild(this.viewport);
        
        // Configure viewport plugins
        this.viewport
            .drag()
            .pinch()
            .wheel()
            .decelerate()
            .clampZoom({
                minScale: 0.5,
                maxScale: 3
            })
            .clamp({
                direction: 'all'
            });
        
        // Center viewport on grid
        this.viewport.moveCenter(
            (GameConfig.GRID_WIDTH * GameConfig.TILE_SIZE) / 2,
            (GameConfig.GRID_HEIGHT * GameConfig.TILE_SIZE) / 2
        );
    }
    
    async initializeGrid() {
        // Create grid container
        this.gridContainer = new PIXI.Container();
        this.viewport.addChild(this.gridContainer);
        
        // Create grid background
        this.createGridBackground();
        
        // Create tile containers for each grid position
        for (let x = 0; x < GameConfig.GRID_WIDTH; x++) {
            for (let y = 0; y < GameConfig.GRID_HEIGHT; y++) {
                const tileContainer = new PIXI.Container();
                tileContainer.x = x * GameConfig.TILE_SIZE;
                tileContainer.y = y * GameConfig.TILE_SIZE;
                
                // Add subtle tile border/highlight
                const tileBackground = new PIXI.Graphics();
                tileBackground.beginFill(0x000000, 0.1);
                tileBackground.drawRect(0, 0, GameConfig.TILE_SIZE, GameConfig.TILE_SIZE);
                tileBackground.endFill();
                tileBackground.lineStyle(1, 0x333333, 0.5);
                tileBackground.drawRect(0, 0, GameConfig.TILE_SIZE, GameConfig.TILE_SIZE);
                
                tileContainer.addChild(tileBackground);
                
                // Make tile interactive
                tileContainer.interactive = true;
                tileContainer.buttonMode = true;
                tileContainer.on('pointerover', () => this.onTileHover(x, y));
                tileContainer.on('pointerout', () => this.onTileLeave(x, y));
                tileContainer.on('pointerdown', (e) => this.onTileClick(x, y, e));
                tileContainer.on('rightclick', (e) => this.onTileRightClick(x, y, e));
                
                // Add double-click handler for unit training
                let clickCount = 0;
                let clickTimer = null;
                tileContainer.on('pointerup', (e) => {
                    clickCount++;
                    if (clickCount === 1) {
                        clickTimer = setTimeout(() => {
                            // Single click - do nothing special for now
                            clickCount = 0;
                        }, 400);
                    } else if (clickCount === 2) {
                        clearTimeout(clickTimer);
                        clickCount = 0;
                        
                        // Stop the event from propagating
                        e.stopPropagation();
                        e.preventDefault();
                        
                        this.onTileDoubleClick(x, y, e);
                    }
                });
                
                // Add drag and drop event listeners to the DOM element
                const domElement = tileContainer.getBounds();
                this.setupTileDropEvents(x, y, tileContainer);
                
                this.gridContainer.addChild(tileContainer);
                this.tileContainers.set(`${x},${y}`, tileContainer);
            }
        }
    }
    
    setupTileDropEvents(x, y, tileContainer) {
        // We need to add drop events to the canvas, not the container
        // This will be handled by the game class with canvas-level events
        
        // Store coordinates on the container for reference
        tileContainer.gridX = x;
        tileContainer.gridY = y;
    }
    
    createGridBackground() {
        const graphics = new PIXI.Graphics();
        
        // Draw grid lines
        graphics.lineStyle(1, 0x2a3a4a, 0.3);
        
        // Vertical lines
        for (let x = 0; x <= GameConfig.GRID_WIDTH; x++) {
            graphics.moveTo(x * GameConfig.TILE_SIZE, 0);
            graphics.lineTo(x * GameConfig.TILE_SIZE, GameConfig.GRID_HEIGHT * GameConfig.TILE_SIZE);
        }
        
        // Horizontal lines
        for (let y = 0; y <= GameConfig.GRID_HEIGHT; y++) {
            graphics.moveTo(0, y * GameConfig.TILE_SIZE);
            graphics.lineTo(GameConfig.GRID_WIDTH * GameConfig.TILE_SIZE, y * GameConfig.TILE_SIZE);
        }
        
        this.gridContainer.addChild(graphics);
    }
    
    onTileHover(x, y) {
        const tileContainer = this.tileContainers.get(`${x},${y}`);
        if (tileContainer) {
            // Add hover effect
            const hoverGraphics = new PIXI.Graphics();
            hoverGraphics.beginFill(0x4a90e2, 0.2);
            hoverGraphics.drawRect(0, 0, GameConfig.TILE_SIZE, GameConfig.TILE_SIZE);
            hoverGraphics.endFill();
            hoverGraphics.name = 'hover';
            tileContainer.addChild(hoverGraphics);
        }
    }
    
    onTileLeave(x, y) {
        const tileContainer = this.tileContainers.get(`${x},${y}`);
        if (tileContainer) {
            // Remove hover effect
            const hoverGraphics = tileContainer.getChildByName('hover');
            if (hoverGraphics) {
                tileContainer.removeChild(hoverGraphics);
            }
        }
    }
    
    onTileClick(x, y, event) {
        // Emit custom event for tile click
        const clickEvent = new CustomEvent('tileClick', {
            detail: { x, y, event }
        });
        document.dispatchEvent(clickEvent);
    }
    
    onTileRightClick(x, y, event) {
        console.log(`Tile right-clicked at (${x}, ${y})`);
        
        // Prevent default browser right-click menu
        event.preventDefault();
        event.stopPropagation();
        
        // Get tile data from game state using the game instance
        const game = window.game;
        let tile = null;
        
        if (game && game.gameState) {
            tile = game.gameState.getTile(x, y);
        }
        
        // Dispatch custom event for unit commands
        window.dispatchEvent(new CustomEvent('tile:rightclick', {
            detail: { x, y, tile, event }
        }));
    }
    
    onTileDoubleClick(x, y, event) {
        console.log(`Tile double-clicked at (${x}, ${y})`);
        
        // Stop event propagation to prevent other handlers from firing
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        
        // Get tile data from game state using the game instance
        const game = window.game;
        let tile = null;
        
        if (game && game.gameState) {
            tile = game.gameState.getTile(x, y);
        }
        
        console.log('Tile found for double-click:', tile);
        
        // Always dispatch the event, even if no tile is found
        window.dispatchEvent(new CustomEvent('tile:doubleclick', {
            detail: { x, y, tile, event }
        }));
    }
    
    renderTile(x, y, tileData) {
        const tileContainer = this.tileContainers.get(`${x},${y}`);
        if (!tileContainer) {
            console.error(`No tile container found for ${x},${y}`);
            return;
        }
        
        // Remove existing tile graphics (but keep background and hover)
        const existingTile = tileContainer.getChildByName('tile');
        if (existingTile) {
            tileContainer.removeChild(existingTile);
        }
        
        // Create tile sprite if texture is available
        const texture = this.sprites[tileData.type];
        if (texture) {
            const tileSprite = new PIXI.Sprite(texture);
            tileSprite.name = 'tile';
            
            // Scale sprite to fit tile size (256x256 -> GameConfig.TILE_SIZE)
            const scale = GameConfig.TILE_SIZE / 256;
            tileSprite.scale.set(scale);
            
            // Anchor sprite to bottom center of tile (for taller sprites)
            tileSprite.anchor.set(0.5, 1.0);
            tileSprite.x = GameConfig.TILE_SIZE / 2;
            tileSprite.y = GameConfig.TILE_SIZE;
            
            tileContainer.addChild(tileSprite);
        } else {
            // Fallback to graphics if sprite not available
            const tileGraphics = new PIXI.Graphics();
            tileGraphics.name = 'tile';
            
            // Draw tile based on type
            const color = this.getTileColor(tileData.type);
            tileGraphics.beginFill(color);
            tileGraphics.drawRect(2, 2, GameConfig.TILE_SIZE - 4, GameConfig.TILE_SIZE - 4);
            tileGraphics.endFill();
            
            // Add tile icon/text
            const tileText = new PIXI.Text(this.getTileSymbol(tileData.type), {
                fontFamily: 'Arial',
                fontSize: 12,
                fill: 0xffffff,
                align: 'center'
            });
            tileText.anchor.set(0.5);
            tileText.x = GameConfig.TILE_SIZE / 2;
            tileText.y = GameConfig.TILE_SIZE / 2;
            
            tileGraphics.addChild(tileText);
            tileContainer.addChild(tileGraphics);
        }
    }
    
    getTileColor(tileType) {
        const colors = {
            'capital_city': 0x8b4513,
            'city': 0x654321,
            'field': 0x228b22,
            'monastery': 0x483d8b,
            'marsh': 0x2f4f4f,
            'mine': 0x696969,
            'orchard': 0x9acd32,
            'barracks': 0x8b0000,
            'watchtower': 0x2f4f4f
        };
        return colors[tileType] || 0x666666;
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
    
    highlightValidPlacements(validPositions) {
        // Remove existing highlights
        this.clearHighlights();
        
        // Add highlights for valid positions
        validPositions.forEach(pos => {
            const tileContainer = this.tileContainers.get(`${pos.x},${pos.y}`);
            if (tileContainer) {
                const highlight = new PIXI.Graphics();
                highlight.beginFill(0x00ff00, 0.3);
                highlight.drawRect(0, 0, GameConfig.TILE_SIZE, GameConfig.TILE_SIZE);
                highlight.endFill();
                highlight.name = 'valid-highlight';
                tileContainer.addChild(highlight);
            }
        });
    }
    
    clearHighlights() {
        this.tileContainers.forEach(container => {
            const highlight = container.getChildByName('valid-highlight');
            if (highlight) {
                container.removeChild(highlight);
            }
        });
    }
    
    showPlacementError(x, y) {
        const tileContainer = this.tileContainers.get(`${x},${y}`);
        if (tileContainer) {
            // Add red error highlight
            const errorHighlight = new PIXI.Graphics();
            errorHighlight.beginFill(0xff0000, 0.5);
            errorHighlight.drawRect(0, 0, GameConfig.TILE_SIZE, GameConfig.TILE_SIZE);
            errorHighlight.endFill();
            errorHighlight.name = 'error-highlight';
            tileContainer.addChild(errorHighlight);
            
            // Remove after 1 second
            setTimeout(() => {
                const highlight = tileContainer.getChildByName('error-highlight');
                if (highlight) {
                    tileContainer.removeChild(highlight);
                }
            }, 1000);
        }
    }
    
    clear() {
        if (this.app) {
            this.app.renderer.clear();
        }
    }
    
    // Update renderer with game state
    update(gameState) {
        try {
            console.log('Updating renderer with game state:', gameState);
            
            // Store reference to game state
            this.gameState = gameState;
            
            // Render tiles if available
            if (gameState.tiles && gameState.tiles.length > 0) {
                const tilesMap = new Map();
                gameState.tiles.forEach(tile => {
                    const key = `${tile.x},${tile.y}`;
                    tilesMap.set(key, tile);
                });
                this.renderTiles(tilesMap);
            }
            
            // Render units if available
            if (gameState.units && gameState.units.length > 0) {
                this.renderUnits(gameState.units);
                this.renderTrainingIndicators(gameState.units);
            }
            
            // Render workers if available
            if (gameState.workers && gameState.workers.length > 0) {
                this.renderWorkers(gameState.workers);
            }
            
            // Render UI elements
            this.renderUI(gameState);
            
            // Present the rendered frame
            this.present();
            
        } catch (error) {
            console.error('Error updating renderer:', error);
        }
    }
    
    renderTiles(tiles) {
        tiles.forEach((tileData, position) => {
            const [x, y] = position.split(',').map(Number);
            this.renderTile(x, y, tileData);
        });
    }
    
    renderUnits(units) {
        console.log('Rendering units:', units.length);
        
        // If we have a UnitSystem, delegate to it for proper unit rendering
        if (this.unitSystem && this.unitSystem.initialized) {
            console.log('Using UnitSystem for unit rendering');
            
            // Only render units that are not in training status
            const completedUnits = units.filter(unit => unit.status !== 'training');
            console.log(`Filtering ${units.length} total units to ${completedUnits.length} completed units`);
            
            // Update or create units using the UnitSystem
            completedUnits.forEach((unit) => {
                // Handle both flat (unit.x, unit.y) and nested (unit.position.x, unit.position.y) formats
                const unitX = unit.x !== undefined ? unit.x : unit.position?.x;
                const unitY = unit.y !== undefined ? unit.y : unit.position?.y;
                
                // Convert snake_case to camelCase for frontend compatibility
                const unitData = {
                    id: unit.id,
                    type: unit.type,
                    owner: unit.owner,
                    position: { x: unitX, y: unitY },
                    hp: unit.hp,
                    maxHp: unit.max_hp || unit.maxHp, // Handle both formats
                    attack: unit.attack,
                    defense: unit.defense,
                    speed: unit.speed,
                    range: unit.range,
                    status: unit.status,
                    createdAt: unit.created_at || unit.createdAt
                };
                
                console.log(`Updating unit ${unit.id} at (${unitX}, ${unitY}) via UnitSystem`);
                this.unitSystem.updateUnit(unitData);
            });
            
            console.log(`Successfully updated ${completedUnits.length} units via UnitSystem`);
            return;
        }
        
        // Fallback to improved rendering method if UnitSystem is not available
        console.warn('UnitSystem not available, using fallback rendering');
        
        // Clear existing unit sprites
        if (this.unitContainer) {
            this.unitContainer.removeChildren();
        } else {
            this.unitContainer = new PIXI.Container();
            this.viewport.addChild(this.unitContainer);
        }

        // Player colors: Green for P1, Red for P2, Blue for P3, Yellow for P4
        const PLAYER_COLORS = {
            0: 0x00ff00, // Player 1 - Green
            1: 0xff0000, // Player 2 - Red  
            2: 0x0066ff, // Player 3 - Blue
            3: 0xffff00  // Player 4 - Yellow
        };
        
        // Only render units that are not in training status
        const completedUnits = units.filter(unit => unit.status !== 'training');
        console.log(`Filtering ${units.length} total units to ${completedUnits.length} completed units`);
        
        completedUnits.forEach((unit) => {
            // Handle both flat (unit.x, unit.y) and nested (unit.position.x, unit.position.y) formats
            const unitX = unit.x !== undefined ? unit.x : unit.position?.x;
            const unitY = unit.y !== undefined ? unit.y : unit.position?.y;
            
            if (unitX === undefined || unitY === undefined) {
                console.warn(`Unit ${unit.id} has invalid position:`, unit);
                return;
            }
            
            // Create unit container
            const unitContainer = new PIXI.Container();
            
            // Create unit sprite (colored circle as placeholder)
            const unitSprite = new PIXI.Graphics();
            const playerColor = PLAYER_COLORS[unit.owner] || 0xffffff;
            unitSprite.beginFill(playerColor, 0.8);
            unitSprite.drawCircle(0, 0, GameConfig.TILE_SIZE * 0.3);
            unitSprite.endFill();
            
            // Add unit type indicator
            unitSprite.lineStyle(2, 0x000000);
            unitSprite.drawRect(-8, -8, 16, 16);
            
            // Position sprite in center of tile
            unitSprite.x = GameConfig.TILE_SIZE / 2;
            unitSprite.y = GameConfig.TILE_SIZE / 2;
            
            // Add sprite to container
            unitContainer.addChild(unitSprite);
            
            // Create health bar
            const healthBar = new PIXI.Container();
            const healthBg = new PIXI.Graphics();
            healthBg.beginFill(0x000000, 0.7);
            healthBg.drawRect(-20, -35, 40, 6);
            healthBg.endFill();
            
            const maxHp = unit.max_hp || unit.maxHp || 100;
            const healthPercent = unit.hp / maxHp;
            const healthColor = healthPercent > 0.6 ? 0x00ff00 : 
                               healthPercent > 0.3 ? 0xffff00 : 0xff0000;
            
            const healthFill = new PIXI.Graphics();
            healthFill.beginFill(healthColor);
            healthFill.drawRect(-19, -34, 38 * healthPercent, 4);
            healthFill.endFill();
            
            healthBar.addChild(healthBg);
            healthBar.addChild(healthFill);
            healthBar.x = GameConfig.TILE_SIZE / 2;
            healthBar.y = GameConfig.TILE_SIZE / 2;
            
            unitContainer.addChild(healthBar);
            
            // Add interaction
            unitContainer.interactive = true;
            unitContainer.buttonMode = true;
            
            // Store unit data for interaction
            unitContainer.unitData = {
                id: unit.id,
                type: unit.type,
                owner: unit.owner,
                hp: unit.hp,
                maxHp: maxHp,
                attack: unit.attack,
                defense: unit.defense,
                speed: unit.speed,
                range: unit.range,
                status: unit.status
            };
            
            // Add hover effects
            unitContainer.on('pointerover', () => {
                unitContainer.scale.set(1.1, 1.1);
                this.showUnitTooltip(unitContainer.unitData);
            });
            
            unitContainer.on('pointerout', () => {
                unitContainer.scale.set(1.0, 1.0);
                this.hideUnitTooltip();
            });
            
            unitContainer.on('pointerdown', () => {
                this.selectUnit(unitContainer.unitData);
            });
            
            // Position unit on grid
            unitContainer.x = unitX * GameConfig.TILE_SIZE;
            unitContainer.y = unitY * GameConfig.TILE_SIZE;
            
            // Add to main container
            this.unitContainer.addChild(unitContainer);
            
            console.log(`Rendered unit ${unit.id} (${unit.type}) at (${unitX}, ${unitY}) with ${unit.hp}/${maxHp} HP`);
        });
        
        console.log(`Successfully rendered ${completedUnits.length} units using fallback method`);
    }

    renderTrainingIndicators(units) {
        console.log('Rendering training indicators');
        
        // Clear existing training indicators
        if (this.trainingContainer) {
            this.trainingContainer.removeChildren();
        } else {
            this.trainingContainer = new PIXI.Container();
            this.viewport.addChild(this.trainingContainer);
        }

        // Player colors for training indicators
        const PLAYER_COLORS = {
            0: 0x00ff00, // Player 1 - Green
            1: 0xff0000, // Player 2 - Red  
            2: 0x0066ff, // Player 3 - Blue
            3: 0xffff00  // Player 4 - Yellow
        };
        
        // Only render indicators for units in training status
        const trainingUnits = units.filter(unit => unit.status === 'training');
        console.log(`Rendering ${trainingUnits.length} training indicators`);
        
        trainingUnits.forEach((unit) => {
            // Handle both flat (unit.x, unit.y) and nested (unit.position.x, unit.position.y) formats
            const unitX = unit.x !== undefined ? unit.x : unit.position?.x;
            const unitY = unit.y !== undefined ? unit.y : unit.position?.y;
            
            console.log(`Rendering training indicator for unit ${unit.id} at (${unitX}, ${unitY}), owner: ${unit.owner}`);
            
            // Create animated progress indicator
            const trainingIndicator = new PIXI.Graphics();
            
            // Use player-specific color
            const color = PLAYER_COLORS[unit.owner] || 0x888888;
            
            // Draw a pulsing circle outline to indicate training
            trainingIndicator.lineStyle(3, color, 0.8);
            trainingIndicator.drawCircle(0, 0, 20);
            
            // Add inner loading circle
            trainingIndicator.lineStyle(2, color, 0.5);
            trainingIndicator.drawCircle(0, 0, 10);
            
            // Position the indicator
            const indicatorX = unitX * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2;
            const indicatorY = unitY * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2;
            
            trainingIndicator.x = indicatorX;
            trainingIndicator.y = indicatorY;
            
            this.trainingContainer.addChild(trainingIndicator);
        });
        
        console.log(`Successfully rendered ${this.trainingContainer.children.length} training indicators`);
    }
    
    renderWorkers(workers) {
        // TODO: Render workers on tiles
    }
    
    renderUI(gameState) {
        // TODO: Render UI elements
    }
    
    present() {
        if (this.app) {
            this.app.renderer.render(this.app.stage);
        }
    }
    
    handleResize() {
        if (this.app && this.container) {
            const rect = this.container.getBoundingClientRect();
            this.app.renderer.resize(rect.width, rect.height);
            
            if (this.viewport) {
                this.viewport.resize(rect.width, rect.height);
            }
        }
    }
    
    cleanup() {
        console.log('Renderer cleanup');
        if (this.app) {
            this.app.destroy();
        }
    }

    generateGridTexture() {
        const graphics = new PIXI.Graphics();
        
        // Draw the grid pattern
        graphics.lineStyle(1, 0x2a3a4a, 0.3);
        
        // Draw vertical lines
        for (let x = 0; x <= GameConfig.GRID_WIDTH; x++) {
            graphics.moveTo(x * GameConfig.TILE_SIZE, 0);
            graphics.lineTo(x * GameConfig.TILE_SIZE, GameConfig.GRID_HEIGHT * GameConfig.TILE_SIZE);
        }
        
        // Draw horizontal lines
        for (let y = 0; y <= GameConfig.GRID_HEIGHT; y++) {
            graphics.moveTo(0, y * GameConfig.TILE_SIZE);
            graphics.lineTo(GameConfig.GRID_WIDTH * GameConfig.TILE_SIZE, y * GameConfig.TILE_SIZE);
        }
        
        // Generate texture from graphics
        return this.app.renderer.generateTexture(graphics);
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
        
        tooltip.innerHTML = `
            <div><strong>${unit.type.charAt(0).toUpperCase() + unit.type.slice(1)}</strong></div>
            <div>HP: ${unit.hp}/${unit.maxHp}</div>
            <div>Attack: ${unit.attack}</div>
            <div>Defense: ${unit.defense}</div>
            <div>Speed: ${unit.speed}</div>
            <div>Range: ${unit.range}</div>
            <div>Owner: Player ${unit.owner + 1}</div>
        `;
        
        document.body.appendChild(tooltip);
        
        // Position tooltip near mouse
        const updateTooltipPosition = (e) => {
            tooltip.style.left = e.clientX + 10 + 'px';
            tooltip.style.top = e.clientY + 10 + 'px';
        };
        
        document.addEventListener('mousemove', updateTooltipPosition);
        tooltip.updatePosition = updateTooltipPosition; // Store for cleanup
    }
    
    hideUnitTooltip() {
        const tooltip = document.getElementById('unit-tooltip');
        if (tooltip) {
            if (tooltip.updatePosition) {
                document.removeEventListener('mousemove', tooltip.updatePosition);
            }
            tooltip.remove();
        }
    }
    
    selectUnit(unit) {
        console.log('Unit selected:', unit);
        
        // Dispatch unit selection event
        window.dispatchEvent(new CustomEvent('unit:select', {
            detail: { unit: unit }
        }));
        
        // Visual feedback (if needed)
        if (this.selectedUnit) {
            this.selectedUnit.tint = 0xffffff; // Reset previous selection
        }
        
        // Store selected unit reference (would need to be updated for proper implementation)
        this.selectedUnit = unit;
    }
    
    // Setup conquest container following the same pattern as other containers
    setupConquestContainer() {
        if (this.conquestContainer) {
            this.conquestContainer.removeChildren();
        } else {
            this.conquestContainer = new PIXI.Container();
            this.conquestContainer.zIndex = 50; // Above tiles but below UI
            this.viewport.addChild(this.conquestContainer);
        }
        
        return this.conquestContainer;
    }
} 