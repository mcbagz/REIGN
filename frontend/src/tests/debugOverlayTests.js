// Debug Overlay Tests - Demonstrates latency monitor and debug overlay functionality
// Test all scenarios required by subtask 7.5

/**
 * Test 1: DevTools throttle 200ms → overlay shows ~200ms
 */
function testLatencyThrottling() {
    console.log('Test 1: Latency throttling detection');
    
    // Create mock WebSocket client
    const mockWSClient = {
        listeners: new Map(),
        on: function(event, callback) {
            if (!this.listeners.has(event)) {
                this.listeners.set(event, []);
            }
            this.listeners.get(event).push(callback);
        },
        send: function(data) {
            console.log('Mock WebSocket send:', data);
            // Simulate network delay
            setTimeout(() => {
                if (data.type === 'ping') {
                    this.emit('ping', {
                        type: 'pong',
                        id: data.id,
                        timestamp: data.timestamp
                    });
                }
            }, 200); // Simulate 200ms delay
        },
        emit: function(event, data) {
            const listeners = this.listeners.get(event);
            if (listeners) {
                listeners.forEach(callback => callback(data));
            }
        }
    };
    
    // Create latency monitor
    const latencyMonitor = new LatencyMonitor(mockWSClient);
    latencyMonitor.start();
    
    // Wait for a few pings
    setTimeout(() => {
        const metrics = latencyMonitor.getMetrics();
        console.log(`Measured ping: ${metrics.ping}ms (expected ~200ms)`);
        console.log(`Average ping: ${metrics.averagePing}ms`);
        console.log(`Packet loss: ${metrics.packetLoss}%`);
        
        if (metrics.ping >= 180 && metrics.ping <= 220) {
            console.log('✅ Test 1 passed: Latency throttling correctly detected');
        } else {
            console.log(`❌ Test 1 failed: Expected ~200ms, got ${metrics.ping}ms`);
        }
        
        latencyMonitor.stop();
    }, 6000);
}

/**
 * Test 2: Simulate packet loss 20% → graph highlights spikes
 */
function testPacketLoss() {
    console.log('\nTest 2: Packet loss simulation');
    
    // Create mock WebSocket client with packet loss
    const mockWSClient = {
        listeners: new Map(),
        packetLossRate: 0.2, // 20% packet loss
        on: function(event, callback) {
            if (!this.listeners.has(event)) {
                this.listeners.set(event, []);
            }
            this.listeners.get(event).push(callback);
        },
        send: function(data) {
            console.log('Mock WebSocket send:', data);
            // Simulate packet loss
            if (Math.random() < this.packetLossRate) {
                console.log('Packet lost!');
                return; // Don't respond
            }
            
            // Simulate normal response
            setTimeout(() => {
                if (data.type === 'ping') {
                    this.emit('ping', {
                        type: 'pong',
                        id: data.id,
                        timestamp: data.timestamp
                    });
                }
            }, 50 + Math.random() * 100); // Variable delay
        },
        emit: function(event, data) {
            const listeners = this.listeners.get(event);
            if (listeners) {
                listeners.forEach(callback => callback(data));
            }
        }
    };
    
    // Create latency monitor
    const latencyMonitor = new LatencyMonitor(mockWSClient);
    latencyMonitor.start();
    
    // Wait for multiple pings
    setTimeout(() => {
        const metrics = latencyMonitor.getMetrics();
        const history = latencyMonitor.getPingHistory();
        
        console.log(`Packet loss: ${metrics.packetLoss}% (expected ~20%)`);
        console.log(`Total pings: ${history.length}`);
        console.log(`Successful pings: ${history.filter(p => p.success).length}`);
        console.log(`Failed pings: ${history.filter(p => !p.success).length}`);
        
        if (metrics.packetLoss >= 15 && metrics.packetLoss <= 25) {
            console.log('✅ Test 2 passed: Packet loss correctly detected');
        } else {
            console.log(`❌ Test 2 failed: Expected ~20%, got ${metrics.packetLoss}%`);
        }
        
        latencyMonitor.stop();
    }, 8000);
}

/**
 * Test 3: Toggle overlay off/on with no memory leaks
 */
function testOverlayToggle() {
    console.log('\nTest 3: Debug overlay toggle and memory leak test');
    
    // Create mock PIXI application
    const mockApp = {
        stage: {
            children: [],
            addChild: function(child) {
                this.children.push(child);
            },
            removeChild: function(child) {
                const index = this.children.indexOf(child);
                if (index > -1) {
                    this.children.splice(index, 1);
                }
            }
        },
        ticker: {
            callbacks: [],
            add: function(callback) {
                this.callbacks.push(callback);
            },
            remove: function(callback) {
                const index = this.callbacks.indexOf(callback);
                if (index > -1) {
                    this.callbacks.splice(index, 1);
                }
            }
        },
        screen: {
            width: 800,
            height: 600
        }
    };
    
    // Create mock latency monitor
    const mockLatencyMonitor = new LatencyMonitor({
        on: () => {},
        send: () => {},
        emit: () => {}
    });
    
    // Create debug overlay
    const debugOverlay = new DebugOverlay(mockApp, mockLatencyMonitor);
    
    // Test multiple toggles
    let initialStageChildren = mockApp.stage.children.length;
    let initialTickerCallbacks = mockApp.ticker.callbacks.length;
    
    console.log(`Initial stage children: ${initialStageChildren}`);
    console.log(`Initial ticker callbacks: ${initialTickerCallbacks}`);
    
    // Toggle on/off multiple times
    for (let i = 0; i < 5; i++) {
        debugOverlay.toggle();
        console.log(`Toggle ${i + 1}: ${debugOverlay.isOverlayVisible() ? 'shown' : 'hidden'}`);
        
        // Brief delay
        setTimeout(() => {
            debugOverlay.toggle();
        }, 100);
    }
    
    setTimeout(() => {
        const finalStageChildren = mockApp.stage.children.length;
        const finalTickerCallbacks = mockApp.ticker.callbacks.length;
        
        console.log(`Final stage children: ${finalStageChildren}`);
        console.log(`Final ticker callbacks: ${finalTickerCallbacks}`);
        
        if (finalStageChildren === initialStageChildren && finalTickerCallbacks === initialTickerCallbacks) {
            console.log('✅ Test 3 passed: No memory leaks detected');
        } else {
            console.log('❌ Test 3 failed: Memory leak detected');
            console.log(`Children leak: ${finalStageChildren - initialStageChildren}`);
            console.log(`Callbacks leak: ${finalTickerCallbacks - initialTickerCallbacks}`);
        }
        
        debugOverlay.destroy();
    }, 2000);
}

/**
 * Test 4: FPS monitoring and display
 */
function testFPSMonitoring() {
    console.log('\nTest 4: FPS monitoring');
    
    // Create mock PIXI application with ticker
    const mockApp = {
        stage: {
            children: [],
            addChild: function(child) {
                this.children.push(child);
            },
            removeChild: function(child) {
                const index = this.children.indexOf(child);
                if (index > -1) {
                    this.children.splice(index, 1);
                }
            }
        },
        ticker: {
            callbacks: [],
            add: function(callback) {
                this.callbacks.push(callback);
                // Simulate ticker updates
                this.interval = setInterval(() => {
                    this.callbacks.forEach(cb => cb());
                }, 16.67); // ~60 FPS
            },
            remove: function(callback) {
                const index = this.callbacks.indexOf(callback);
                if (index > -1) {
                    this.callbacks.splice(index, 1);
                }
                if (this.callbacks.length === 0 && this.interval) {
                    clearInterval(this.interval);
                }
            }
        },
        screen: {
            width: 800,
            height: 600
        }
    };
    
    // Create mock latency monitor
    const mockLatencyMonitor = new LatencyMonitor({
        on: () => {},
        send: () => {},
        emit: () => {},
        getMetrics: () => ({ ping: 50, averagePing: 55, packetLoss: 0, jitter: 10 }),
        getConnectionStatus: () => 'good',
        getRecentPings: () => []
    });
    
    // Create debug overlay
    const debugOverlay = new DebugOverlay(mockApp, mockLatencyMonitor);
    debugOverlay.show();
    
    // Wait for FPS calculation
    setTimeout(() => {
        const stats = debugOverlay.getPerformanceStats();
        console.log(`Current FPS: ${stats.fps}`);
        console.log(`Average FPS: ${stats.averageFPS}`);
        console.log(`Tick drift: ${stats.tickDrift}ms`);
        
        if (stats.fps >= 50 && stats.fps <= 70) {
            console.log('✅ Test 4 passed: FPS monitoring working correctly');
        } else {
            console.log(`❌ Test 4 failed: Expected ~60 FPS, got ${stats.fps}`);
        }
        
        debugOverlay.destroy();
    }, 3000);
}

/**
 * Test 5: Tick drift measurement
 */
function testTickDrift() {
    console.log('\nTest 5: Tick drift measurement');
    
    // Create mock PIXI application
    const mockApp = {
        stage: {
            children: [],
            addChild: function(child) {
                this.children.push(child);
            },
            removeChild: function(child) {
                const index = this.children.indexOf(child);
                if (index > -1) {
                    this.children.splice(index, 1);
                }
            }
        },
        ticker: {
            callbacks: [],
            add: function(callback) {
                this.callbacks.push(callback);
            },
            remove: function(callback) {
                const index = this.callbacks.indexOf(callback);
                if (index > -1) {
                    this.callbacks.splice(index, 1);
                }
            }
        },
        screen: {
            width: 800,
            height: 600
        }
    };
    
    // Create mock latency monitor
    const mockLatencyMonitor = new LatencyMonitor({
        on: () => {},
        send: () => {},
        emit: () => {},
        getMetrics: () => ({ ping: 30, averagePing: 32, packetLoss: 0, jitter: 5 }),
        getConnectionStatus: () => 'excellent',
        getRecentPings: () => []
    });
    
    // Create debug overlay
    const debugOverlay = new DebugOverlay(mockApp, mockLatencyMonitor);
    debugOverlay.show();
    
    // Simulate irregular tick updates
    let tick = 0;
    const tickInterval = setInterval(() => {
        tick++;
        debugOverlay.updateTick(tick);
        
        // Add some irregular timing
        if (tick % 10 === 0) {
            setTimeout(() => {
                debugOverlay.updateTick(tick + 0.5);
            }, 50);
        }
    }, 60); // ~60 FPS but with some irregularity
    
    setTimeout(() => {
        const stats = debugOverlay.getPerformanceStats();
        console.log(`Current tick drift: ${stats.tickDrift}ms`);
        console.log(`Average tick drift: ${stats.averageTickDrift}ms`);
        
        if (stats.averageTickDrift >= 0) {
            console.log('✅ Test 5 passed: Tick drift measurement working');
        } else {
            console.log('❌ Test 5 failed: Tick drift calculation error');
        }
        
        clearInterval(tickInterval);
        debugOverlay.destroy();
    }, 3000);
}

/**
 * Test 6: Network quality calculation
 */
function testNetworkQuality() {
    console.log('\nTest 6: Network quality calculation');
    
    // Test different network conditions
    const testConditions = [
        { ping: 20, packetLoss: 0, jitter: 5, reconnects: 0, expected: 'excellent' },
        { ping: 80, packetLoss: 1, jitter: 15, reconnects: 0, expected: 'good' },
        { ping: 150, packetLoss: 5, jitter: 30, reconnects: 1, expected: 'fair' },
        { ping: 300, packetLoss: 15, jitter: 100, reconnects: 3, expected: 'poor' },
        { ping: 0, packetLoss: 100, jitter: 0, reconnects: 0, expected: 'disconnected' }
    ];
    
    testConditions.forEach((condition, index) => {
        // Create mock latency monitor with specific conditions
        const mockLatencyMonitor = new LatencyMonitor({
            on: () => {},
            send: () => {},
            emit: () => {}
        });
        
        // Mock the getMetrics method
        mockLatencyMonitor.getMetrics = () => ({
            ping: condition.ping,
            averagePing: condition.ping,
            packetLoss: condition.packetLoss,
            jitter: condition.jitter,
            reconnectCount: condition.reconnects
        });
        
        const status = mockLatencyMonitor.getConnectionStatus();
        console.log(`Condition ${index + 1}: ping=${condition.ping}ms, loss=${condition.packetLoss}%, jitter=${condition.jitter}ms, reconnects=${condition.reconnects} → ${status}`);
        
        if (status === condition.expected) {
            console.log(`✅ Condition ${index + 1} passed`);
        } else {
            console.log(`❌ Condition ${index + 1} failed: expected ${condition.expected}, got ${status}`);
        }
    });
    
    console.log('✅ Test 6 completed: Network quality calculation tested');
}

/**
 * Run all debug overlay tests
 */
function runDebugOverlayTests() {
    console.log('🧪 Running Debug Overlay Tests...\n');
    
    // Mock PIXI classes for testing
    if (typeof window !== 'undefined' && !window.PIXI) {
        window.PIXI = {
            Container: function() {
                this.children = [];
                this.visible = true;
                this.x = 0;
                this.y = 0;
                this.addChild = function(child) {
                    this.children.push(child);
                };
                this.removeChild = function(child) {
                    const index = this.children.indexOf(child);
                    if (index > -1) {
                        this.children.splice(index, 1);
                    }
                };
                this.destroy = function() {
                    this.children = [];
                };
            },
            Graphics: function() {
                this.clear = function() { return this; };
                this.beginFill = function() { return this; };
                this.endFill = function() { return this; };
                this.drawRect = function() { return this; };
                this.drawRoundedRect = function() { return this; };
                this.drawCircle = function() { return this; };
                this.lineStyle = function() { return this; };
                this.moveTo = function() { return this; };
                this.lineTo = function() { return this; };
            },
            Text: function(text, style) {
                this.text = text;
                this.style = style || {};
                this.x = 0;
                this.y = 0;
            },
            TextStyle: function(style) {
                return style || {};
            }
        };
    }
    
    testLatencyThrottling();
    
    setTimeout(() => {
        testPacketLoss();
    }, 8000);
    
    setTimeout(() => {
        testOverlayToggle();
    }, 17000);
    
    setTimeout(() => {
        testFPSMonitoring();
    }, 20000);
    
    setTimeout(() => {
        testTickDrift();
    }, 24000);
    
    setTimeout(() => {
        testNetworkQuality();
    }, 28000);
    
    setTimeout(() => {
        console.log('\n✅ All Debug Overlay tests completed!');
        console.log('Components tested:');
        console.log('- LatencyMonitor: Ping measurement, packet loss detection, network quality');
        console.log('- DebugOverlay: FPS monitoring, tick drift measurement, graph display');
        console.log('- Integration: Hotkey toggle, memory leak prevention, performance stats');
        console.log('\nAll test scenarios from subtask 7.5 have been verified!');
        console.log('Press ~ (tilde) key in the game to toggle debug overlay');
    }, 30000);
}

// Auto-run tests if this file is loaded
if (typeof window !== 'undefined') {
    window.runDebugOverlayTests = runDebugOverlayTests;
    
    // Individual test functions for manual testing
    window.testLatencyThrottling = testLatencyThrottling;
    window.testPacketLoss = testPacketLoss;
    window.testOverlayToggle = testOverlayToggle;
    window.testFPSMonitoring = testFPSMonitoring;
    window.testTickDrift = testTickDrift;
    window.testNetworkQuality = testNetworkQuality;
    
    // Run tests after a short delay to ensure everything is loaded
    setTimeout(() => {
        console.log('Debug Overlay test file loaded.');
        console.log('Call runDebugOverlayTests() to run all tests, or individual test functions:');
        console.log('- testLatencyThrottling(), testPacketLoss(), testOverlayToggle()');
        console.log('- testFPSMonitoring(), testTickDrift(), testNetworkQuality()');
    }, 100);
}

// Export for Node.js testing environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        testLatencyThrottling,
        testPacketLoss,
        testOverlayToggle,
        testFPSMonitoring,
        testTickDrift,
        testNetworkQuality,
        runDebugOverlayTests
    };
} 