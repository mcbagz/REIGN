/**
 * Validation tests for generated TypeScript types
 * These tests verify that the generated types can be used correctly in JavaScript
 */

// Sample test data that matches our schemas
const sampleTile = {
    id: "10,15",
    type: "city",
    x: 10,
    y: 15,
    edges: ["city", "field", "city", "field"],
    hp: 100,
    maxHp: 100,
    owner: 1,
    worker: {
        id: 1,
        type: "magistrate",
        owner: 1
    },
    resources: {
        gold: 2,
        food: 0,
        faith: 0
    },
    placedAt: 1640995200.0,
    metadata: {
        canTrain: true,
        workerCapacity: 1,
        defenseBonus: 0.2,
        speedMultiplier: 1.0
    }
};

const sampleUnit = {
    id: "unit_1",
    type: "infantry",
    owner: 1,
    position: {
        x: 10,
        y: 15
    },
    hp: 100,
    maxHp: 100,
    attack: 20,
    defense: 15,
    speed: 1.0,
    range: 1,
    status: "idle",
    target: null,
    createdAt: 1640995200.0,
    lastAction: null,
    metadata: {
        trainingTime: 5.0,
        cost: {
            gold: 50,
            food: 20,
            faith: 0
        },
        effectiveness: {
            infantry: 1.0,
            archer: 1.2,
            knight: 0.8,
            siege: 1.5
        }
    }
};

const sampleGameState = {
    gameId: "game_123",
    status: "playing",
    currentPlayer: 1,
    turnNumber: 5,
    turnTimeRemaining: 12.5,
    gameStartTime: 1640995200.0,
    lastUpdate: 1640995800.0,
    players: [
        {
            id: 1,
            name: "Alice",
            color: "#FF0000",
            isConnected: true,
            isEliminated: false,
            resources: {
                gold: 100,
                food: 50,
                faith: 25
            },
            techLevel: "manor",
            capitalCity: {
                x: 20,
                y: 20
            },
            stats: {
                tilesPlaced: 5,
                unitsCreated: 3,
                unitsKilled: 1,
                tilesDestroyed: 0
            }
        }
    ],
    tiles: [sampleTile],
    units: [sampleUnit],
    availableTiles: [
        {
            type: "city",
            count: 15
        },
        {
            type: "field",
            count: 20
        }
    ],
    currentTileOptions: ["city", "field", "monastery"],
    winner: null,
    gameSettings: {
        turnDuration: 15.0,
        maxGameDuration: 1800.0,
        mapSize: 40,
        resourceUpdateInterval: 1.0
    },
    events: []
};

const sampleWebSocketMessage = {
    type: "command",
    payload: {
        action: "place_tile",
        parameters: {
            tileType: "city",
            position: { x: 10, y: 15 },
            rotation: 0
        }
    },
    timestamp: 1640995200.0,
    messageId: "msg_123",
    playerId: 1,
    gameId: "game_456",
    sequenceNumber: 42,
    replyTo: null,
    priority: "normal",
    requiresAck: true,
    metadata: {
        source: "client",
        version: "1.0",
        retryCount: 0,
        maxRetries: 3,
        ttl: 30.0
    }
};

// Basic validation functions
function validateTileStructure(tile) {
    const requiredFields = ['id', 'type', 'x', 'y', 'edges', 'hp', 'maxHp', 'owner', 'resources', 'placedAt'];
    return requiredFields.every(field => tile.hasOwnProperty(field));
}

function validateUnitStructure(unit) {
    const requiredFields = ['id', 'type', 'owner', 'position', 'hp', 'maxHp', 'attack', 'defense', 'speed', 'range', 'status', 'createdAt'];
    return requiredFields.every(field => unit.hasOwnProperty(field));
}

function validateGameStateStructure(gameState) {
    const requiredFields = ['gameId', 'status', 'currentPlayer', 'turnNumber', 'turnTimeRemaining', 'gameStartTime', 'lastUpdate', 'players', 'tiles', 'units', 'availableTiles'];
    return requiredFields.every(field => gameState.hasOwnProperty(field));
}

function validateWebSocketMessageStructure(message) {
    const requiredFields = ['type', 'payload', 'timestamp', 'messageId'];
    return requiredFields.every(field => message.hasOwnProperty(field));
}

// Test round-trip serialization
function testSerialization(obj, validator, name) {
    try {
        // Serialize to JSON
        const jsonString = JSON.stringify(obj);
        
        // Deserialize from JSON
        const deserialized = JSON.parse(jsonString);
        
        // Validate structure
        const isValid = validator(deserialized);
        
        console.log(`✅ ${name} serialization test passed: ${isValid}`);
        return isValid;
    } catch (error) {
        console.error(`❌ ${name} serialization test failed:`, error.message);
        return false;
    }
}

// Run all tests
function runValidationTests() {
    console.log('🔄 Running TypeScript types validation tests...\n');
    
    const tests = [
        () => testSerialization(sampleTile, validateTileStructure, 'Tile'),
        () => testSerialization(sampleUnit, validateUnitStructure, 'Unit'),
        () => testSerialization(sampleGameState, validateGameStateStructure, 'GameState'),
        () => testSerialization(sampleWebSocketMessage, validateWebSocketMessageStructure, 'WebSocketMessage')
    ];
    
    const results = tests.map(test => test());
    const passed = results.filter(r => r).length;
    const total = results.length;
    
    console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);
    
    if (passed === total) {
        console.log('🎉 All validation tests passed!');
    } else {
        console.log('⚠️  Some tests failed. Please check the output above.');
    }
    
    return passed === total;
}

// Export for use in browser or node
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runValidationTests,
        sampleTile,
        sampleUnit,
        sampleGameState,
        sampleWebSocketMessage
    };
}

// Run tests if this file is executed directly
if (typeof window !== 'undefined') {
    // Browser environment
    document.addEventListener('DOMContentLoaded', runValidationTests);
} else if (typeof require !== 'undefined' && require.main === module) {
    // Node.js environment
    runValidationTests();
} 