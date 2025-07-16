// JavaScript Latency Monitor - Pings server every 2 seconds and tracks connection metrics
class LatencyMonitor {
    constructor(wsClient) {
        this.wsClient = wsClient;
        this.isRunning = false;
        this.pingInterval = null;
        this.pingHistory = [];
        this.maxHistorySize = 100;
        this.pingIntervalMs = 2000; // 2 seconds
        this.pingTimeout = 5000; // 5 second timeout
        this.currentPingId = 0;
        this.pendingPings = new Map();
        this.startTime = Date.now();
        this.reconnectCount = 0;
        this.listeners = new Map();
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        if (!this.wsClient) return;

        // Listen for pong responses
        this.wsClient.on('pong', (data) => {
            this.handlePongResponse(data);
        });

        // Listen for ping responses (timestamp echo)
        this.wsClient.on('ping', (data) => {
            this.handlePingResponse(data);
        });

        // Listen for connection events
        this.wsClient.on('connected', () => {
            this.handleConnected();
        });

        this.wsClient.on('disconnected', () => {
            this.handleDisconnected();
        });

        this.wsClient.on('reconnected', () => {
            this.handleReconnected();
        });
    }

    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.startTime = Date.now();
        this.pingHistory = [];
        this.currentPingId = 0;
        this.reconnectCount = 0;

        this.pingInterval = setInterval(() => {
            this.sendPing();
        }, this.pingIntervalMs);

        console.log('LatencyMonitor started');
        this.emit('started');
    }

    stop() {
        if (!this.isRunning) return;

        this.isRunning = false;

        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        // Clear pending pings
        this.pendingPings.forEach((ping, id) => {
            clearTimeout(ping.timeout);
        });
        this.pendingPings.clear();

        console.log('LatencyMonitor stopped');
        this.emit('stopped');
    }

    sendPing() {
        if (!this.wsClient || !this.isRunning) return;

        const pingId = `ping_${this.currentPingId++}`;
        const timestamp = Date.now();

        // Try WebSocket native ping first
        if (this.wsClient.ping && typeof this.wsClient.ping === 'function') {
            try {
                this.wsClient.ping(JSON.stringify({ id: pingId, timestamp }));
                this.trackPendingPing(pingId, timestamp);
                return;
            } catch (error) {
                console.warn('Native WebSocket ping failed, falling back to message ping');
            }
        }

        // Fallback to message-based ping
        try {
            this.wsClient.send({
                type: 'ping',
                id: pingId,
                timestamp: timestamp
            });
            this.trackPendingPing(pingId, timestamp);
        } catch (error) {
            console.error('Failed to send ping:', error);
            this.recordPingResult(timestamp, false, 'Send failed');
        }
    }

    trackPendingPing(pingId, timestamp) {
        const timeout = setTimeout(() => {
            this.pendingPings.delete(pingId);
            this.recordPingResult(timestamp, false, 'Timeout');
        }, this.pingTimeout);

        this.pendingPings.set(pingId, { timestamp, timeout });
    }

    handlePongResponse(data) {
        try {
            const pongData = typeof data === 'string' ? JSON.parse(data) : data;
            const pingId = pongData.id;
            const originalTimestamp = pongData.timestamp;
            
            this.completePing(pingId, originalTimestamp);
        } catch (error) {
            console.warn('Failed to parse pong data:', error);
        }
    }

    handlePingResponse(data) {
        if (data.type === 'pong' && data.id && data.timestamp) {
            this.completePing(data.id, data.timestamp);
        }
    }

    completePing(pingId, originalTimestamp) {
        const pending = this.pendingPings.get(pingId);
        if (!pending) return;

        const now = Date.now();
        const ping = now - originalTimestamp;
        
        clearTimeout(pending.timeout);
        this.pendingPings.delete(pingId);
        
        this.recordPingResult(originalTimestamp, true, undefined, ping);
    }

    recordPingResult(timestamp, success, error, ping) {
        const result = {
            timestamp,
            ping: ping || 0,
            success,
            error
        };

        this.pingHistory.push(result);
        
        // Limit history size
        if (this.pingHistory.length > this.maxHistorySize) {
            this.pingHistory.shift();
        }

        this.emit('ping', result);
    }

    handleConnected() {
        console.log('LatencyMonitor: Connected');
    }

    handleDisconnected() {
        console.log('LatencyMonitor: Disconnected');
        
        // Clear pending pings
        this.pendingPings.forEach((ping, id) => {
            clearTimeout(ping.timeout);
        });
        this.pendingPings.clear();
    }

    handleReconnected() {
        console.log('LatencyMonitor: Reconnected');
        this.reconnectCount++;
    }

    getMetrics() {
        const successfulPings = this.pingHistory.filter(p => p.success);
        const pings = successfulPings.map(p => p.ping);
        
        if (pings.length === 0) {
            return {
                ping: 0,
                averagePing: 0,
                minPing: 0,
                maxPing: 0,
                packetLoss: 0,
                jitter: 0,
                lastPingTime: 0,
                reconnectCount: this.reconnectCount,
                uptime: Date.now() - this.startTime
            };
        }

        const averagePing = pings.reduce((sum, ping) => sum + ping, 0) / pings.length;
        const minPing = Math.min(...pings);
        const maxPing = Math.max(...pings);
        const lastPing = successfulPings[successfulPings.length - 1];
        
        // Calculate jitter (average deviation from mean)
        const jitter = pings.reduce((sum, ping) => sum + Math.abs(ping - averagePing), 0) / pings.length;
        
        // Calculate packet loss
        const totalPings = this.pingHistory.length;
        const successfulCount = successfulPings.length;
        const packetLoss = totalPings > 0 ? ((totalPings - successfulCount) / totalPings) * 100 : 0;

        return {
            ping: lastPing?.ping || 0,
            averagePing: Math.round(averagePing),
            minPing,
            maxPing,
            packetLoss: Math.round(packetLoss * 100) / 100,
            jitter: Math.round(jitter),
            lastPingTime: lastPing?.timestamp || 0,
            reconnectCount: this.reconnectCount,
            uptime: Date.now() - this.startTime
        };
    }

    getPingHistory() {
        return [...this.pingHistory];
    }

    getRecentPings(count = 20) {
        return this.pingHistory.slice(-count);
    }

    getNetworkQuality() {
        const metrics = this.getMetrics();
        
        if (metrics.ping === 0) return 0;
        
        let score = 100;
        
        // Deduct for high ping
        if (metrics.ping > 100) score -= (metrics.ping - 100) * 0.5;
        if (metrics.ping > 300) score -= (metrics.ping - 300) * 0.5;
        
        // Deduct for packet loss
        score -= metrics.packetLoss * 2;
        
        // Deduct for jitter
        if (metrics.jitter > 50) score -= (metrics.jitter - 50) * 0.2;
        
        // Deduct for reconnects
        score -= metrics.reconnectCount * 5;
        
        return Math.max(0, Math.round(score));
    }

    getConnectionStatus() {
        const quality = this.getNetworkQuality();
        const metrics = this.getMetrics();
        
        if (metrics.ping === 0) return 'disconnected';
        if (quality >= 90) return 'excellent';
        if (quality >= 70) return 'good';
        if (quality >= 50) return 'fair';
        return 'poor';
    }

    setPingInterval(intervalMs) {
        this.pingIntervalMs = intervalMs;
        
        if (this.isRunning) {
            this.stop();
            this.start();
        }
    }

    setMaxHistorySize(size) {
        this.maxHistorySize = size;
        
        while (this.pingHistory.length > this.maxHistorySize) {
            this.pingHistory.shift();
        }
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            const index = eventListeners.indexOf(callback);
            if (index > -1) {
                eventListeners.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach(callback => callback(data));
        }
    }

    isMonitoring() {
        return this.isRunning;
    }

    reset() {
        this.pingHistory = [];
        this.currentPingId = 0;
        this.reconnectCount = 0;
        this.startTime = Date.now();
        
        // Clear pending pings
        this.pendingPings.forEach((ping, id) => {
            clearTimeout(ping.timeout);
        });
        this.pendingPings.clear();
        
        this.emit('reset');
    }

    destroy() {
        this.stop();
        this.listeners.clear();
        console.log('LatencyMonitor destroyed');
    }
} 