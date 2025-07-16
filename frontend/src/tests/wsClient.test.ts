// WebSocket Client Tests
// Basic functionality verification without Jest framework

import { WSClient } from '../net/wsClient';
import { WSClientConfig, WSClientEvent, MessageType } from '../net/messageTypes';

// Simple test runner
class SimpleTestRunner {
    private tests: Array<{ name: string; fn: () => Promise<void> | void }> = [];
    private passed = 0;
    private failed = 0;

    test(name: string, fn: () => Promise<void> | void) {
        this.tests.push({ name, fn });
    }

    async run() {
        console.log('Running WebSocket Client Tests...\n');
        
        for (const test of this.tests) {
            try {
                await test.fn();
                console.log(`✅ ${test.name}`);
                this.passed++;
            } catch (error) {
                console.error(`❌ ${test.name}:`, error);
                this.failed++;
            }
        }
        
        console.log(`\nResults: ${this.passed} passed, ${this.failed} failed`);
    }
}

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(message);
    }
}

function assertEquals(actual: any, expected: any, message?: string) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

// Create test runner
const testRunner = new SimpleTestRunner();

// Test configuration
const config: WSClientConfig = {
    url: 'ws://localhost:8000',
    roomId: 'test-room',
    playerId: 'test-player',
    maxReconnectAttempts: 3,
    initialReconnectDelay: 1000,
    maxReconnectDelay: 10000,
    pingInterval: 30000,
    connectionTimeout: 5000
};

// Basic instantiation test
testRunner.test('should create WSClient instance', () => {
    const client = new WSClient(config);
    assert(client !== null, 'Client should be created');
    assertEquals(client.isConnected, false, 'Client should not be connected initially');
    assertEquals(client.queuedMessageCount, 0, 'Message queue should be empty initially');
    client.disconnect();
});

// Event listener test
testRunner.test('should handle event listeners', () => {
    const client = new WSClient(config);
    let eventTriggered = false;
    
    client.on(WSClientEvent.CONNECTED, () => {
        eventTriggered = true;
    });
    
    // Trigger event manually to test event system
    (client as any).emit(WSClientEvent.CONNECTED);
    
    assert(eventTriggered, 'Event should be triggered');
    client.disconnect();
});

// Message queueing test
testRunner.test('should queue messages when not connected', () => {
    const client = new WSClient(config);
    
    const sent = client.sendCommand('placeTile', { x: 10, y: 10, tile: 'city' });
    assertEquals(sent, false, 'Message should not be sent when not connected');
    assertEquals(client.queuedMessageCount, 1, 'Message should be queued');
    
    client.disconnect();
});

// Configuration test
testRunner.test('should store configuration correctly', () => {
    const client = new WSClient(config);
    
    assertEquals((client as any).config.url, config.url, 'URL should match');
    assertEquals((client as any).config.roomId, config.roomId, 'Room ID should match');
    assertEquals((client as any).config.playerId, config.playerId, 'Player ID should match');
    
    client.disconnect();
});

// Reconnection configuration test
testRunner.test('should initialize reconnection config', () => {
    const client = new WSClient(config);
    
    const reconnectConfig = (client as any).reconnectConfig;
    assertEquals(reconnectConfig.attempt, 0, 'Initial attempt should be 0');
    assertEquals(reconnectConfig.maxAttempts, config.maxReconnectAttempts, 'Max attempts should match config');
    assertEquals(reconnectConfig.delay, config.initialReconnectDelay, 'Initial delay should match config');
    
    client.disconnect();
});

// Message ID generation test
testRunner.test('should generate unique message IDs', () => {
    const client = new WSClient(config);
    
    const id1 = (client as any).generateMessageId();
    const id2 = (client as any).generateMessageId();
    
    assert(id1 !== id2, 'Message IDs should be unique');
    assert(typeof id1 === 'string', 'Message ID should be a string');
    assert(id1.length > 0, 'Message ID should not be empty');
    
    client.disconnect();
});

// Export test runner for manual execution
if (typeof window !== 'undefined') {
    (window as any).runWSClientTests = () => testRunner.run();
}

// Auto-run tests if in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    testRunner.run();
}

export { testRunner }; 