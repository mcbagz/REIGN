// WebSocket Client Wrapper
// Handles connection lifecycle, reconnection, and message routing

import { 
    WSMessage, 
    MessageType, 
    ConnectionState, 
    WSClientEvent, 
    WSClientConfig, 
    ReconnectConfig,
    CommandMessage,
    StateMessage,
    ActionMessage,
    ErrorMessage,
    PingMessage,
    PongMessage,
    ResyncMessage,
    CmdAckMessage
} from './messageTypes';

// Event callback type
type EventCallback = (data?: any) => void;

export class WSClient {
    private socket: WebSocket | null = null;
    private config: WSClientConfig;
    private state: ConnectionState = ConnectionState.DISCONNECTED;
    private eventListeners: Map<string, EventCallback[]> = new Map();
    private messageQueue: WSMessage[] = [];
    private reconnectConfig: ReconnectConfig;
    private reconnectTimer: number | null = null;
    private pingTimer: number | null = null;
    private connectionTimer: number | null = null;
    private isDestroyed: boolean = false;

    constructor(config: WSClientConfig) {
        this.config = config;
        this.reconnectConfig = {
            attempt: 0,
            maxAttempts: config.maxReconnectAttempts,
            delay: config.initialReconnectDelay,
            backoffFactor: 2,
            maxDelay: config.maxReconnectDelay
        };
    }

    // Event management
    on(event: WSClientEvent, callback: EventCallback): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(callback);
    }

    off(event: WSClientEvent, callback?: EventCallback): void {
        if (!this.eventListeners.has(event)) return;
        
        const callbacks = this.eventListeners.get(event)!;
        if (callback) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        } else {
            callbacks.length = 0;
        }
    }

    private emit(event: WSClientEvent, data?: any): void {
        const callbacks = this.eventListeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event callback for ${event}:`, error);
                }
            });
        }
    }

    // Connection management
    async connect(): Promise<void> {
        if (this.isDestroyed) {
            throw new Error('WSClient has been destroyed');
        }

        if (this.state === ConnectionState.CONNECTED || this.state === ConnectionState.CONNECTING) {
            return;
        }

        this.setState(ConnectionState.CONNECTING);
        
        try {
            const wsUrl = `${this.config.url}/ws/${this.config.roomId}/${this.config.playerId}`;
            console.log(`Connecting to WebSocket: ${wsUrl}`);

            this.socket = new WebSocket(wsUrl);
            
            // Set connection timeout
            this.connectionTimer = window.setTimeout(() => {
                if (this.state === ConnectionState.CONNECTING) {
                    this.socket?.close();
                    this.handleError(new Error('Connection timeout'));
                }
            }, this.config.connectionTimeout);

            this.socket.onopen = () => {
                this.handleOpen();
            };

            this.socket.onmessage = (event) => {
                this.handleMessage(event.data);
            };

            this.socket.onclose = (event) => {
                this.handleClose(event);
            };

            this.socket.onerror = (error) => {
                this.handleError(error);
            };

        } catch (error) {
            this.handleError(error);
        }
    }

    disconnect(): void {
        this.isDestroyed = true;
        this.clearTimers();
        
        if (this.socket) {
            this.socket.close(1000, 'Client disconnect');
            this.socket = null;
        }
        
        this.setState(ConnectionState.DISCONNECTED);
        this.messageQueue = [];
    }

    // Message sending
    send(message: WSMessage): boolean {
        if (this.state === ConnectionState.CONNECTED && this.socket) {
            try {
                this.socket.send(JSON.stringify(message));
                return true;
            } catch (error) {
                console.error('Failed to send message:', error);
                this.messageQueue.push(message);
                return false;
            }
        } else {
            // Queue message for later sending
            this.messageQueue.push(message);
            console.log('Message queued (not connected):', message.type);
            return false;
        }
    }

    // Convenience methods for common message types
    sendCommand(action: string, data: any): boolean {
        const message: CommandMessage = {
            type: MessageType.COMMAND,
            timestamp: Date.now(),
            messageId: this.generateMessageId(),
            action,
            data,
            playerId: this.config.playerId
        };
        return this.send(message);
    }

    sendResync(): boolean {
        const message: ResyncMessage = {
            type: MessageType.RESYNC,
            timestamp: Date.now(),
            messageId: this.generateMessageId(),
            playerId: this.config.playerId
        };
        return this.send(message);
    }

    ping(): boolean {
        const message: PingMessage = {
            type: MessageType.PING,
            timestamp: Date.now(),
            messageId: this.generateMessageId()
        };
        return this.send(message);
    }

    // Event handlers
    private handleOpen(): void {
        console.log('WebSocket connected');
        this.clearTimers();
        this.setState(ConnectionState.CONNECTED);
        this.resetReconnectConfig();
        
        // Send queued messages
        this.flushMessageQueue();
        
        // Start ping timer
        this.startPingTimer();
        
        // Send resync request if this is a reconnection
        if (this.reconnectConfig.attempt > 0) {
            this.sendResync();
            this.emit(WSClientEvent.RECONNECTED);
        } else {
            this.emit(WSClientEvent.CONNECTED);
        }
    }

    private handleMessage(data: string): void {
        try {
            const message = JSON.parse(data) as WSMessage;
            
            // Emit general message event
            this.emit(WSClientEvent.MESSAGE, message);
            
            // Route to specific handlers based on message type
            switch (message.type) {
                case MessageType.STATE:
                    this.handleStateMessage(message as StateMessage);
                    break;
                case MessageType.ACTION:
                    this.handleActionMessage(message as ActionMessage);
                    break;
                case MessageType.ERROR:
                    this.handleErrorMessage(message as ErrorMessage);
                    break;
                case MessageType.PONG:
                    this.handlePongMessage(message as PongMessage);
                    break;
                case MessageType.CMD_ACK:
                    this.handleCmdAckMessage(message as CmdAckMessage);
                    break;
                default:
                    console.warn('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Failed to parse message:', error);
        }
    }

    private handleClose(event: CloseEvent): void {
        console.log(`WebSocket closed: ${event.code} - ${event.reason}`);
        this.clearTimers();
        this.socket = null;
        
        if (this.isDestroyed) {
            this.setState(ConnectionState.DISCONNECTED);
            return;
        }
        
        this.setState(ConnectionState.DISCONNECTED);
        this.emit(WSClientEvent.DISCONNECTED, { code: event.code, reason: event.reason });
        
        // Attempt reconnection if not a clean close
        if (event.code !== 1000) {
            this.attemptReconnect();
        }
    }

    private handleError(error: any): void {
        console.error('WebSocket error:', error);
        this.emit(WSClientEvent.ERROR, error);
    }

    // Message type handlers
    private handleStateMessage(message: StateMessage): void {
        this.emit(WSClientEvent.STATE_UPDATE, message);
    }

    private handleActionMessage(message: ActionMessage): void {
        this.emit(WSClientEvent.ACTION_NOTIFICATION, message);
    }

    private handleErrorMessage(message: ErrorMessage): void {
        console.error('Server error:', message.message);
        this.emit(WSClientEvent.ERROR, message);
    }

    private handlePongMessage(message: PongMessage): void {
        this.emit(WSClientEvent.PONG, message);
    }

    private handleCmdAckMessage(message: CmdAckMessage): void {
        this.emit(WSClientEvent.COMMAND_ACK, message);
    }

    // Reconnection logic
    private attemptReconnect(): void {
        if (this.isDestroyed || this.reconnectConfig.attempt >= this.reconnectConfig.maxAttempts) {
            this.setState(ConnectionState.FAILED);
            console.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectConfig.attempt++;
        this.setState(ConnectionState.RECONNECTING);
        
        console.log(`Attempting to reconnect... (${this.reconnectConfig.attempt}/${this.reconnectConfig.maxAttempts})`);
        this.emit(WSClientEvent.RECONNECTING, { attempt: this.reconnectConfig.attempt });

        this.reconnectTimer = window.setTimeout(() => {
            this.connect();
            
            // Exponential backoff
            this.reconnectConfig.delay = Math.min(
                this.reconnectConfig.delay * this.reconnectConfig.backoffFactor,
                this.reconnectConfig.maxDelay
            );
        }, this.reconnectConfig.delay);
    }

    private resetReconnectConfig(): void {
        this.reconnectConfig.attempt = 0;
        this.reconnectConfig.delay = this.config.initialReconnectDelay;
    }

    // Timer management
    private startPingTimer(): void {
        if (this.config.pingInterval > 0) {
            this.pingTimer = window.setInterval(() => {
                this.ping();
            }, this.config.pingInterval);
        }
    }

    private clearTimers(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
        if (this.connectionTimer) {
            clearTimeout(this.connectionTimer);
            this.connectionTimer = null;
        }
    }

    // Utility methods
    private setState(newState: ConnectionState): void {
        if (this.state !== newState) {
            const oldState = this.state;
            this.state = newState;
            console.log(`WebSocket state changed: ${oldState} -> ${newState}`);
        }
    }

    private flushMessageQueue(): void {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift()!;
            this.send(message);
        }
    }

    private generateMessageId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Getters
    get connectionState(): ConnectionState {
        return this.state;
    }

    get isConnected(): boolean {
        return this.state === ConnectionState.CONNECTED;
    }

    get queuedMessageCount(): number {
        return this.messageQueue.length;
    }

    get reconnectAttempts(): number {
        return this.reconnectConfig.attempt;
    }
} 