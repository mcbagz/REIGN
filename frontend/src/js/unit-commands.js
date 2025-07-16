// Unit Commands System - Handle unit selection, movement, and combat orders
class UnitCommands {
    constructor(gameState, unitSystem) {
        this.gameState = gameState;
        this.unitSystem = unitSystem;
        this.selectedUnits = new Set();
        this.commandIndicators = new Map();
        this.processingRightClick = false;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        console.log('Unit Commands system initialized');
    }
    
    setupEventListeners() {
        // Handle unit selection on single click
        document.addEventListener('tileClick', (e) => {
            const { x, y, event } = e.detail;
            
            // Don't process left clicks if they're part of a right-click sequence
            if (event && event.button === 2) {
                return;
            }
            
            // Add a small delay to prevent race conditions with right-click
            setTimeout(() => {
                if (!this.processingRightClick) {
                    this.handleTileClick(x, y);
                }
            }, 10);
        });
        
        // Handle unit commands on right click
        window.addEventListener('tile:rightclick', (e) => {
            const { x, y, tile } = e.detail;
            this.processingRightClick = true;
            this.handleTileRightClick(x, y, tile);
            setTimeout(() => {
                this.processingRightClick = false;
            }, 100);
        });
        
        // Handle unit selection directly
        window.addEventListener('unit:click', (e) => {
            const { unit } = e.detail;
            this.selectUnit(unit);
        });
        
        // Test keyboard shortcut for debugging
        document.addEventListener('keydown', (e) => {
            if (e.key === 'u' || e.key === 'U') {
                this.debugUnitSelection();
            }
            if (e.key === 'm' || e.key === 'M') {
                this.testMoveCommand();
            }
        });
    }
    
    debugUnitSelection() {
        console.log('=== Unit Selection Debug ===');
        console.log('Selected units:', this.selectedUnits.size);
        console.log('All units in game state:', this.gameState.units.size);
        
        // Show all units
        for (const [unitId, unit] of this.gameState.units) {
            console.log(`Unit ${unitId} at (${unit.position.x}, ${unit.position.y}):`, unit);
        }
        
        // Show selected units
        for (const unit of this.selectedUnits) {
            console.log(`Selected unit:`, unit);
        }
        
        // Try to select the first unit owned by current player
        const currentPlayer = this.gameState.getCurrentPlayer();
        if (this.gameState.units.size > 0) {
            let firstOwnedUnit = null;
            for (const [unitId, unit] of this.gameState.units) {
                if (unit.owner === currentPlayer.id) {
                    firstOwnedUnit = unit;
                    break;
                }
            }
            
            if (firstOwnedUnit) {
                console.log('Selecting first owned unit:', firstOwnedUnit);
                this.selectUnit(firstOwnedUnit);
            } else {
                console.log('No units owned by current player found');
            }
        } else {
            console.log('No units found in game state');
        }
    }
    
    handleTileClick(x, y) {
        // Check if there's a unit at this position
        const unitsAtPosition = this.getUnitsAt(x, y);
        
        console.log(`Tile clicked at (${x}, ${y}), units found:`, unitsAtPosition.length);
        
        if (unitsAtPosition.length > 0) {
            // Select the first unit at this position
            const unit = unitsAtPosition[0];
            console.log(`Found unit at (${x}, ${y}):`, unit);
            this.selectUnit(unit);
        } else {
            // Only clear selection if no units are currently selected
            // This prevents clearing selection during right-click movement commands
            if (this.selectedUnits.size > 0) {
                console.log('Keeping selection active for potential commands');
            } else {
                this.clearSelection();
            }
        }
    }
    
    handleTileRightClick(x, y, tile) {
        console.log(`Right-click at (${x}, ${y}), selected units:`, this.selectedUnits.size);
        
        if (this.selectedUnits.size === 0) {
            console.log('No units selected, ignoring right-click');
            return; // No units selected
        }
        
        // Check if right-clicking on enemy unit/tile for attack
        const currentPlayer = this.gameState.getCurrentPlayer();
        const unitsAtPosition = this.getUnitsAt(x, y);
        
        console.log(`Units at target position:`, unitsAtPosition);
        
        if (unitsAtPosition.length > 0 && unitsAtPosition[0].owner !== currentPlayer.id) {
            console.log('Attacking enemy unit');
            // Attack enemy unit
            this.issueAttackCommand(x, y, unitsAtPosition[0]);
        } else if (tile && tile.owner !== null && tile.owner !== currentPlayer.id) {
            console.log('Attacking enemy tile');
            // Attack enemy tile
            this.issueAttackCommand(x, y, tile);
        } else {
            console.log('Moving to position');
            // Move to position
            this.issueMoveCommand(x, y);
        }
    }
    
    selectUnit(unit) {
        // Clear previous selection
        this.clearSelection();
        
        // Select the unit
        this.selectedUnits.add(unit);
        this.highlightSelectedUnits();
        
        console.log(`Selected unit: ${unit.id} (${unit.type}) at (${unit.position.x}, ${unit.position.y})`);
        
        // Dispatch selection event
        window.dispatchEvent(new CustomEvent('unit:selected', {
            detail: { unit }
        }));
    }
    
    clearSelection() {
        this.selectedUnits.clear();
        this.clearHighlights();
        console.log('Selection cleared');
    }
    
    issueMoveCommand(x, y) {
        console.log(`=== MOVE COMMAND ===`);
        console.log(`Target position: (${x}, ${y})`);
        console.log(`Selected units: ${this.selectedUnits.size}`);
        
        for (const unit of this.selectedUnits) {
            console.log(`Moving unit ${unit.id} from (${unit.position.x}, ${unit.position.y}) to (${x}, ${y})`);
            
            // Send move command to unit system
            this.unitSystem.moveUnit(unit.id, { x, y });
            
            // Show move indicator
            this.showCommandIndicator(x, y, 'move');
        }
        
        console.log(`Move command completed for ${this.selectedUnits.size} units`);
    }
    
    issueAttackCommand(x, y, target) {
        console.log(`=== ATTACK COMMAND ===`);
        console.log(`Target position: (${x}, ${y})`);
        console.log(`Target:`, target);
        console.log(`Selected units: ${this.selectedUnits.size}`);
        
        for (const unit of this.selectedUnits) {
            console.log(`Unit ${unit.id} attacking target at (${x}, ${y})`);
            
            // Send attack command to unit system
            this.unitSystem.attackTarget(unit.id, target);
            
            // Show attack indicator
            this.showCommandIndicator(x, y, 'attack');
        }
        
        console.log(`Attack command completed for ${this.selectedUnits.size} units`);
    }
    
    getUnitsAt(x, y) {
        const units = [];
        for (const [unitId, unit] of this.gameState.units) {
            if (unit.position.x === x && unit.position.y === y) {
                units.push(unit);
            }
        }
        return units;
    }
    
    highlightSelectedUnits() {
        for (const unit of this.selectedUnits) {
            this.unitSystem.highlightUnit(unit.id, true);
        }
    }
    
    clearHighlights() {
        // Clear all unit highlights
        for (const [unitId, unit] of this.gameState.units) {
            this.unitSystem.highlightUnit(unitId, false);
        }
    }
    
    showCommandIndicator(x, y, commandType) {
        const indicator = {
            x, y,
            type: commandType,
            timestamp: Date.now(),
            duration: 2000 // 2 seconds
        };
        
        this.commandIndicators.set(`${x},${y}`, indicator);
        
        // Remove indicator after duration
        setTimeout(() => {
            this.commandIndicators.delete(`${x},${y}`);
        }, indicator.duration);
        
        console.log(`Showing ${commandType} indicator at (${x}, ${y})`);
    }
    
    getSelectedUnits() {
        return Array.from(this.selectedUnits);
    }
    
    hasSelection() {
        return this.selectedUnits.size > 0;
    }

    testMoveCommand() {
        console.log('=== TESTING MOVE COMMAND ===');
        
        if (this.selectedUnits.size === 0) {
            console.log('No units selected. Press U to select a unit first.');
            return;
        }
        
        // Test movement to a nearby position
        const firstUnit = this.selectedUnits.values().next().value;
        const testX = firstUnit.position.x + 1;
        const testY = firstUnit.position.y + 1;
        
        console.log(`Testing move command to (${testX}, ${testY})`);
        this.issueMoveCommand(testX, testY);
    }
} 