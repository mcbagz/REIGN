// WebSocket Message Types for Client-Server Communication
// Based on backend FastAPI WebSocket message formats

import { WebSocketMessage } from '../types/websocket-message';

// Main message types sent between client and server
export enum MessageType {
    // Client to server
    COMMAND = 'cmd',
    PING = 'ping',
    RESYNC = 'resync',
    
    // Server to client
    STATE = 'state',
    ACTION = 'action',
    ERROR = 'error',
    PONG = 'pong',
    CMD_ACK = 'cmdAck'
}

// Base message structure
export interface BaseMessage {
    type: MessageType;
    timestamp: number;
    messageId?: string;
    replyTo?: string;
}

// Client command message
export interface CommandMessage extends BaseMessage {
    type: MessageType.COMMAND;
    action: string;
    data: any;
    playerId: string;
}

// Server state update message
export interface StateMessage extends BaseMessage {
    type: MessageType.STATE;
    payload: any; // GameState from backend
    tick: number;
}

// Server action notification message
export interface ActionMessage extends BaseMessage {
    type: MessageType.ACTION;
    msg: string;
    playerId: string;
    action: string;
}

// Error message
export interface ErrorMessage extends BaseMessage {
    type: MessageType.ERROR;
    code: string;
    message: string;
    details?: any;
}

// Ping/Pong for latency measurement
export interface PingMessage extends BaseMessage {
    type: MessageType.PING;
    timestamp: number;
}

export interface PongMessage extends BaseMessage {
    type: MessageType.PONG;
    timestamp: number;
    originalTimestamp: number;
}

// Resync request message
export interface ResyncMessage extends BaseMessage {
    type: MessageType.RESYNC;
    playerId: string;
}

// Command acknowledgment
export interface CmdAckMessage extends BaseMessage {
    type: MessageType.CMD_ACK;
    commandId: string;
    success: boolean;
    error?: string;
}

// Union type for all possible messages
export type WSMessage = 
    | CommandMessage
    | StateMessage
    | ActionMessage
    | ErrorMessage
    | PingMessage
    | PongMessage
    | ResyncMessage
    | CmdAckMessage;

// Connection states
export enum ConnectionState {
    DISCONNECTED = 'disconnected',
    CONNECTING = 'connecting',
    CONNECTED = 'connected',
    RECONNECTING = 'reconnecting',
    FAILED = 'failed'
}

// Event types for the WebSocket client
export enum WSClientEvent {
    CONNECTED = 'connected',
    DISCONNECTED = 'disconnected',
    RECONNECTING = 'reconnecting',
    RECONNECTED = 'reconnected',
    ERROR = 'error',
    MESSAGE = 'message',
    STATE_UPDATE = 'stateUpdate',
    ACTION_NOTIFICATION = 'actionNotification',
    COMMAND_ACK = 'commandAck',
    PONG = 'pong'
}

// WebSocket client configuration
export interface WSClientConfig {
    url: string;
    roomId: string;
    playerId: string;
    maxReconnectAttempts: number;
    initialReconnectDelay: number;
    maxReconnectDelay: number;
    pingInterval: number;
    connectionTimeout: number;
}

// Reconnection configuration
export interface ReconnectConfig {
    attempt: number;
    maxAttempts: number;
    delay: number;
    backoffFactor: number;
    maxDelay: number;
} 