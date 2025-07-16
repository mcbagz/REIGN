// WebSocket Client Class - Updated Implementation
class WebSocketClient {
    constructor(roomId = null, playerId = null) {
        this.socket = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.messageQueue = [];
        this.roomId = roomId;
        this.playerId = playerId;
        this.messageHandlers = new Map();
        
        console.log('WebSocketClient created', { roomId, playerId });
    }
    
    // Update connection parameters
    setConnectionParams(roomId, playerId) {
        this.roomId = roomId;
        this.playerId = playerId;
        console.log('Connection parameters updated', { roomId, playerId });
    }
    
    async connect() {
        console.log('Connecting to WebSocket...');
        
        if (!this.roomId || !this.playerId) {
            throw new Error('Room ID and Player ID are required for connection');
        }
        
        try {
            const url = `${EnvConfig.WS_URL}/ws/${this.roomId}/${this.playerId}`;
            console.log('Connecting to:', url);
            this.socket = new WebSocket(url);
            
            this.socket.onopen = () => {
                console.log('WebSocket connected');
                this.connected = true;
                this.reconnectAttempts = 0;
                
                // Send queued messages
                while (this.messageQueue.length > 0) {
                    const message = this.messageQueue.shift();
                    this.send(message);
                }
            };
            
            this.socket.onmessage = (event) => {
                this.handleMessage(event.data);
            };
            
            this.socket.onclose = () => {
                console.log('WebSocket disconnected');
                this.connected = false;
                this.attemptReconnect();
            };
            
            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
            
        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
            throw error;
        }
    }
    
    // Event handler system
    on(event, handler) {
        if (!this.messageHandlers.has(event)) {
            this.messageHandlers.set(event, []);
        }
        this.messageHandlers.get(event).push(handler);
    }
    
    off(event, handler) {
        if (this.messageHandlers.has(event)) {
            const handlers = this.messageHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
    
    emit(event, data) {
        if (this.messageHandlers.has(event)) {
            this.messageHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error('Error in event handler:', error);
                }
            });
        }
    }
    
    // Matchmaking - get room and player ID from backend
    async matchPlayer(playerName = null) {
        try {
            const response = await fetch(`${EnvConfig.API_URL}/match`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    player_id: playerName || `player_${Date.now()}`
                })
            });
            
            if (!response.ok) {
                throw new Error(`Matchmaking failed: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Matchmaking response:', data);
            
            // Update connection parameters
            this.setConnectionParams(data.room_id, playerName || `player_${Date.now()}`);
            
            return data;
        } catch (error) {
            console.error('Matchmaking error:', error);
            throw error;
        }
    }
    
    // Connect with matchmaking
    async connectWithMatchmaking(playerName = null) {
        try {
            // First, get room and player ID through matchmaking
            const matchResult = await this.matchPlayer(playerName);
            
            // Then connect to WebSocket
            await this.connect();
            
            return matchResult;
        } catch (error) {
            console.error('Failed to connect with matchmaking:', error);
            throw error;
        }
    }
    
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            console.log('WebSocket message received:', message);
            
            // Emit event based on message type
            this.emit(message.type, message.payload);
            
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }
    
    send(message) {
        if (this.connected && this.socket) {
            try {
                this.socket.send(JSON.stringify(message));
            } catch (error) {
                console.error('Failed to send message:', error);
            }
        } else {
            console.log('WebSocket not connected, queuing message');
            this.messageQueue.push(message);
        }
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts < 5) {
            this.reconnectAttempts++;
            console.log(`Attempting reconnect ${this.reconnectAttempts}/5`);
            
            setTimeout(() => {
                this.connect().catch(error => {
                    console.error('Reconnect failed:', error);
                });
            }, 2000 * this.reconnectAttempts);
        } else {
            console.error('Max reconnection attempts reached');
            this.emit('disconnected', { reason: 'max_attempts' });
        }
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
            this.connected = false;
        }
    }
    
    // Reconnect method for manual reconnection
    async reconnect() {
        this.disconnect();
        this.reconnectAttempts = 0;
        
        try {
            await this.connect();
        } catch (error) {
            console.error('Manual reconnect failed:', error);
            throw error;
        }
    }
} 