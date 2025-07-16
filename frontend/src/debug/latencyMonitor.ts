/**
 * Latency Monitor - Provides real-time ping measurements and connection metrics
 * Pings server every 2 seconds using WebSocket ping/pong or timestamp echo
 */

export interface LatencyMetrics {
    ping: number;
    averagePing: number;
    minPing: number;
    maxPing: number;
    packetLoss: number;
    jitter: number;
    lastPingTime: number;
    reconnectCount: number;
    uptime: number;
}

export interface PingResult {
    timestamp: number;
    ping: number;
    success: boolean;
    error?: string;
}

export class LatencyMonitor {
    private wsClient: any;
    private isRunning: boolean = false;
    private pingInterval: NodeJS.Timeout | null = null;
    private pingHistory: PingResult[] = [];
    private maxHistorySize: number = 100; // Keep last 100 pings
    private pingIntervalMs: number = 2000; // 2 seconds
    private pingTimeout: number = 5000; // 5 second timeout
    private currentPingId: number = 0;
    private pendingPings: Map<string, { timestamp: number; timeout: NodeJS.Timeout }> = new Map();
    private startTime: number = 0;
    private reconnectCount: number = 0;
    
    // Events
    private listeners: Map<string, Function[]> = new Map();
    
    constructor(wsClient: any) {
        this.wsClient = wsClient;
        this.startTime = Date.now();
        this.setupEventListeners();
    }

    /**
     * Set up WebSocket event listeners
     */
    private setupEventListeners(): void {
        if (!this.wsClient) return;

        // Listen for pong responses
        this.wsClient.on('pong', (data: any) => {
            this.handlePongResponse(data);
        });

        // Listen for ping responses (timestamp echo)
        this.wsClient.on('ping', (data: any) => {
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

    /**
     * Start the latency monitoring
     */
    public start(): void {
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

    /**
     * Stop the latency monitoring
     */
    public stop(): void {
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

    /**
     * Send a ping to the server
     */
    private sendPing(): void {
        if (!this.wsClient || !this.isRunning) return;

        const pingId = `ping_${this.currentPingId++}`;
        const timestamp = Date.now();

        // Try WebSocket native ping first
        if (this.wsClient.ping) {
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

    /**
     * Track a pending ping
     */
    private trackPendingPing(pingId: string, timestamp: number): void {
        const timeout = setTimeout(() => {
            this.pendingPings.delete(pingId);
            this.recordPingResult(timestamp, false, 'Timeout');
        }, this.pingTimeout);

        this.pendingPings.set(pingId, { timestamp, timeout });
    }

    /**
     * Handle pong response (native WebSocket)
     */
    private handlePongResponse(data: any): void {
        try {
            const pongData = JSON.parse(data);
            const pingId = pongData.id;
            const originalTimestamp = pongData.timestamp;
            
            this.completePing(pingId, originalTimestamp);
        } catch (error) {
            console.warn('Failed to parse pong data:', error);
        }
    }

    /**
     * Handle ping response (message-based)
     */
    private handlePingResponse(data: any): void {
        if (data.type === 'pong' && data.id && data.timestamp) {
            this.completePing(data.id, data.timestamp);
        }
    }

    /**
     * Complete a ping measurement
     */
    private completePing(pingId: string, originalTimestamp: number): void {
        const pending = this.pendingPings.get(pingId);
        if (!pending) return;

        const now = Date.now();
        const ping = now - originalTimestamp;
        
        clearTimeout(pending.timeout);
        this.pendingPings.delete(pingId);
        
        this.recordPingResult(originalTimestamp, true, undefined, ping);
    }

    /**
     * Record a ping result
     */
    private recordPingResult(timestamp: number, success: boolean, error?: string, ping?: number): void {
        const result: PingResult = {
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

    /**
     * Handle connection events
     */
    private handleConnected(): void {
        console.log('LatencyMonitor: Connected');
    }

    private handleDisconnected(): void {
        console.log('LatencyMonitor: Disconnected');
        
        // Clear pending pings
        this.pendingPings.forEach((ping, id) => {
            clearTimeout(ping.timeout);
        });
        this.pendingPings.clear();
    }

    private handleReconnected(): void {
        console.log('LatencyMonitor: Reconnected');
        this.reconnectCount++;
    }

    /**
     * Get current latency metrics
     */
    public getMetrics(): LatencyMetrics {
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

    /**
     * Get ping history
     */
    public getPingHistory(): PingResult[] {
        return [...this.pingHistory];
    }

    /**
     * Get recent ping history for graphing
     */
    public getRecentPings(count: number = 20): PingResult[] {
        return this.pingHistory.slice(-count);
    }

    /**
     * Calculate network quality score (0-100)
     */
    public getNetworkQuality(): number {
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

    /**
     * Get connection status
     */
    public getConnectionStatus(): 'excellent' | 'good' | 'fair' | 'poor' | 'disconnected' {
        const quality = this.getNetworkQuality();
        const metrics = this.getMetrics();
        
        if (metrics.ping === 0) return 'disconnected';
        if (quality >= 90) return 'excellent';
        if (quality >= 70) return 'good';
        if (quality >= 50) return 'fair';
        return 'poor';
    }

    /**
     * Set ping interval
     */
    public setPingInterval(intervalMs: number): void {
        this.pingIntervalMs = intervalMs;
        
        if (this.isRunning) {
            this.stop();
            this.start();
        }
    }

    /**
     * Set max history size
     */
    public setMaxHistorySize(size: number): void {
        this.maxHistorySize = size;
        
        while (this.pingHistory.length > this.maxHistorySize) {
            this.pingHistory.shift();
        }
    }

    /**
     * Event system
     */
    public on(event: string, callback: Function): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback);
    }

    public off(event: string, callback: Function): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            const index = eventListeners.indexOf(callback);
            if (index > -1) {
                eventListeners.splice(index, 1);
            }
        }
    }

    private emit(event: string, data?: any): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach(callback => callback(data));
        }
    }

    /**
     * Check if monitoring is running
     */
    public isMonitoring(): boolean {
        return this.isRunning;
    }

    /**
     * Reset all metrics
     */
    public reset(): void {
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

    /**
     * Destroy the monitor
     */
    public destroy(): void {
        this.stop();
        this.listeners.clear();
        console.log('LatencyMonitor destroyed');
    }
} 