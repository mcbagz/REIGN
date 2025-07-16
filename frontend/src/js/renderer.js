// Game Renderer Class - Enhanced with Grid Support
class GameRenderer {
    constructor() {
        this.app = null;
        this.container = null;
        this.viewport = null;
        this.gridContainer = null;
        this.gridTexture = null;
        this.tileContainers = new Map(); // key: "x,y", value: PIXI.Container
        this.initialized = false;
        this.gameState = null; // Reference to game state
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
        
        // Clear existing unit sprites
        if (this.unitContainer) {
            this.unitContainer.removeChildren();
        } else {
            this.unitContainer = new PIXI.Container();
            this.viewport.addChild(this.unitContainer);
        }
        
        // Render each unit
        units.forEach(unit => {
            console.log('Unit:', unit);
            
            // Create a simple colored circle for the unit
            const unitSprite = new PIXI.Graphics();
            unitSprite.beginFill(unit.owner === 0 ? 0x00ff00 : 0xff0000); // Green for player 0, red for others
            unitSprite.drawCircle(0, 0, 15);
            unitSprite.endFill();
            
            // Position the unit sprite
            unitSprite.x = unit.x * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2;
            unitSprite.y = unit.y * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2;
            
            // Make it interactive
            unitSprite.interactive = true;
            unitSprite.cursor = 'pointer';
            
            // Add click handler
            unitSprite.on('click', (event) => {
                console.log('Unit clicked:', unit);
                // Dispatch unit click event
                window.dispatchEvent(new CustomEvent('unit:click', {
                    detail: { unit: unit, event: event }
                }));
            });
            
            this.unitContainer.addChild(unitSprite);
        });
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
} 