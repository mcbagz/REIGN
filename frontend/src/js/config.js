// Game Configuration
const GameConfig = {
    // Canvas and rendering
    CANVAS_WIDTH: 1200,
    CANVAS_HEIGHT: 800,
    TILE_SIZE: 128,
    GRID_WIDTH: 20,
    GRID_HEIGHT: 20,
    
    // Game timing
    TILE_PLACEMENT_INTERVAL: 15000, // 15 seconds
    RESOURCE_TICK_INTERVAL: 1000,   // 1 second
    WORKER_RECALL_TIME: 10000,      // 10 seconds
    
    // Resources
    RESOURCE_CAP: 500,
    STARTING_RESOURCES: {
        gold: 100,
        food: 100,
        faith: 0
    },
    RESOURCE_CAPS: {
        gold: 500,
        food: 500,
        faith: 500
    },
    GAME_SETTINGS: {
        MAX_PLAYERS: 4,
        MAP_SIZE: 20,
        TURN_DURATION: 15.0,
        TILE_BANK_SIZE: 3,
        RESOURCE_TICK_INTERVAL: 1000
    },
    
    // Workers
    STARTING_WORKERS: 8,  // Changed from 5 to 8 as per GDD (8 followers per player)
    WORKER_TYPES: {
        MAGISTRATE: 'magistrate',
        FARMER: 'farmer',
        MONK: 'monk',
        SCOUT: 'scout'
    },
    
    // Tile types and distribution
    TILE_TYPES: {
        CAPITAL_CITY: 'capital_city',
        CITY: 'city',
        FIELD: 'field',
        MONASTERY: 'monastery',
        MARSH: 'marsh',
        MINE: 'mine',
        ORCHARD: 'orchard',
        BARRACKS: 'barracks',
        WATCHTOWER: 'watchtower'
    },
    
    TILE_DISTRIBUTION: {
        CORE: 0.8,     // 80% core tiles
        RESOURCE: 0.1, // 10% resource tiles
        SPECIAL: 0.1   // 10% special tiles
    },
    
    // Unit types and stats
    UNIT_TYPES: {
        INFANTRY: 'infantry',
        ARCHER: 'archer',
        KNIGHT: 'knight',
        SIEGE: 'siege'
    },
    
    UNIT_STATS: {
        infantry: {
            cost: { gold: 50, food: 20 },
            trainingTime: 10000,
            hp: 100,
            attack: 20,
            speed: 1.0,
            range: 1
        },
        archer: {
            cost: { gold: 60, food: 30 },
            trainingTime: 12000,
            hp: 75,
            attack: 25,
            speed: 1.5,
            range: 2
        },
        knight: {
            cost: { gold: 100, food: 50 },
            trainingTime: 15000,
            hp: 150,
            attack: 30,
            speed: 0.8,
            range: 1
        },
        siege: {
            cost: { gold: 200, food: 0 },
            trainingTime: 20000,
            hp: 120,
            attack: 50,
            speed: 0.5,
            range: 2
        }
    },
    
    // Combat effectiveness (rock-paper-scissors)
    COMBAT_EFFECTIVENESS: {
        infantry: { archer: 1.5, knight: 0.5, infantry: 1.0, siege: 1.5 },
        archer: { knight: 1.5, infantry: 0.5, archer: 1.0, siege: 1.2 },
        knight: { infantry: 1.5, archer: 0.5, knight: 1.0, siege: 1.0 },
        siege: { building: 2.0, infantry: 0.5, archer: 0.8, knight: 1.0, siege: 1.0 }
    },
    
    // Tile stats
    TILE_STATS: {
        capital_city: {
            hp: 1000,
            resourceGeneration: { gold: 2 },
            canTrain: true,
            workerCapacity: 2
        },
        city: {
            hp: 200,
            resourceGeneration: { gold: 1 },
            canTrain: true,
            workerCapacity: 1
        },
        field: {
            hp: 30,
            resourceGeneration: { gold: 0, food: 10, faith: 0 },
            canTrain: false,
            workerCapacity: 1
        },
        monastery: {
            hp: 80,
            resourceGeneration: { gold: 0, food: 0, faith: 50 },
            canTrain: false,
            workerCapacity: 1
        },
        marsh: {
            hp: 20,
            speedMultiplier: 0.3,
            canTrain: false,
            workerCapacity: 0
        },
        mine: {
            hp: 60,
            resourceGeneration: { gold: 40, food: 0, faith: 0 },
            canTrain: false,
            workerCapacity: 0
        },
        orchard: {
            hp: 60,
            resourceGeneration: { gold: 0, food: 40, faith: 0 },
            canTrain: false,
            workerCapacity: 0
        },
        barracks: {
            hp: 120,
            trainingSpeedMultiplier: 0.5,
            canTrain: true,
            workerCapacity: 0
        },
        watchtower: {
            hp: 150,
            defenseBonus: 0.25,
            defenseRadius: 2,
            canTrain: false,
            workerCapacity: 0
        }
    },
    
    // Tech tree
    TECH_LEVELS: {
        MANOR: 'manor',
        DUCHY: 'duchy',
        KINGDOM: 'kingdom'
    },
    
    TECH_COSTS: {
        duchy: { gold: 200, food: 100, faith: 100 },
        kingdom: { gold: 400, food: 200, faith: 200 }
    },
    
    // WebSocket configuration
    WS_CONFIG: {
        RECONNECT_INTERVAL: 5000,
        MAX_RECONNECT_ATTEMPTS: 10,
        PING_INTERVAL: 30000
    },
    
    // UI configuration
    UI_CONFIG: {
        NOTIFICATION_DURATION: 3000,
        ANIMATION_SPEED: 0.3,
        ZOOM_LEVELS: [0.5, 0.75, 1.0, 1.25, 1.5, 2.0],
        DEFAULT_ZOOM: 1.0
    },
    
    // Colors
    COLORS: {
        PLAYERS: [
            0x3498db, // Blue
            0xe74c3c, // Red
            0x27ae60, // Green
            0xf39c12  // Orange
        ],
        UI: {
            GOLD: 0xf39c12,
            FOOD: 0x27ae60,
            FAITH: 0x9b59b6,
            HIGHLIGHT: 0xf39c12,
            VALID: 0x27ae60,
            INVALID: 0xe74c3c
        }
    }
};

// Environment configuration
const EnvConfig = {
    API_URL: window.location.hostname === 'localhost' ? 
        'http://localhost:8000' : 
        'https://your-api-domain.com',
    WS_URL: window.location.hostname === 'localhost' ? 
        'ws://localhost:8000' : 
        'wss://your-api-domain.com'
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameConfig, EnvConfig };
} 