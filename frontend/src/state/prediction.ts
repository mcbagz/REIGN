// Client-Side Prediction & Reconciliation System
// Maintains local predictions and reconciles with authoritative server state

import { JsonPatchOperation, generateGameStateDiff, applyPatch, GameStateDiffUtils } from './diffPatch';

// Prediction snapshot with rollback information
interface PredictionSnapshot {
    id: string;
    timestamp: number;
    serverTick: number;
    localState: any;
    command?: ClientCommand;
    applied: boolean;
}

// Client command interface
interface ClientCommand {
    id: string;
    type: string;
    data: any;
    timestamp: number;
    playerId: string;
}

// Reconciliation configuration
interface ReconciliationConfig {
    maxSnapshots: number;
    divergenceThreshold: number;
    rollbackEnabled: boolean;
    predictionEnabled: boolean;
    maxRollbackTicks: number;
    debugMode: boolean;
}

// Reconciliation statistics
interface ReconciliationStats {
    totalPredictions: number;
    successfulPredictions: number;
    rollbacks: number;
    divergences: number;
    lastReconciliationTime: number;
    averageLatency: number;
}

// Default configuration
const DEFAULT_CONFIG: ReconciliationConfig = {
    maxSnapshots: 30,
    divergenceThreshold: 5,
    rollbackEnabled: true,
    predictionEnabled: true,
    maxRollbackTicks: 10,
    debugMode: false
};

/**
 * Client-side prediction and reconciliation manager
 */
export class PredictionManager {
    private config: ReconciliationConfig;
    private snapshots: PredictionSnapshot[] = [];
    private lastServerState: any = null;
    private _lastServerTick: number = 0;
    private currentPredictionId: number = 0;
    private stats: ReconciliationStats;
    private pendingCommands: Map<string, ClientCommand> = new Map();
    private eventCallbacks: Map<string, Function[]> = new Map();

    constructor(config: Partial<ReconciliationConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.stats = {
            totalPredictions: 0,
            successfulPredictions: 0,
            rollbacks: 0,
            divergences: 0,
            lastReconciliationTime: 0,
            averageLatency: 0
        };
    }

    /**
     * Initialize with server state
     */
    initialize(serverState: any, serverTick: number): void {
        this.lastServerState = this.deepClone(serverState);
        this._lastServerTick = serverTick;
        this.snapshots = [];
        this.pendingCommands.clear();
        
        this.log('Prediction manager initialized', { serverTick });
    }

    /**
     * Apply local prediction for a command
     */
    predict(command: ClientCommand, currentState: any): any {
        if (!this.config.predictionEnabled) {
            return currentState;
        }

        // Create snapshot before prediction
        const snapshot: PredictionSnapshot = {
            id: `pred_${this.currentPredictionId++}`,
            timestamp: Date.now(),
            serverTick: this._lastServerTick,
            localState: this.deepClone(currentState),
            command,
            applied: false
        };

        // Apply prediction to current state
        const predictedState = this.applyPrediction(currentState, command);
        
        // Store snapshot and command
        this.snapshots.push(snapshot);
        this.pendingCommands.set(command.id, command);
        
        // Cleanup old snapshots
        this.cleanupSnapshots();
        
        this.stats.totalPredictions++;
        this.log('Applied prediction', { commandId: command.id, snapshotId: snapshot.id });
        
        return predictedState;
    }

    /**
     * Reconcile with authoritative server state
     */
    reconcile(serverState: any, serverTick: number): any {
        const startTime = Date.now();
        
        // If no predictions exist, just update server state
        if (this.snapshots.length === 0) {
            this.lastServerState = this.deepClone(serverState);
            this._lastServerTick = serverTick;
            return serverState;
        }

        // Generate diff between last known server state and new server state
        const patches = generateGameStateDiff(this.lastServerState, serverState);
        const divergenceScore = GameStateDiffUtils.calculateDivergenceScore(patches);
        
        this.log('Reconciliation started', {
            serverTick,
            patches: patches.length,
            divergenceScore,
            snapshots: this.snapshots.length
        });

        // Check if we need to rollback
        let result = serverState;
        if (divergenceScore > this.config.divergenceThreshold) {
            this.stats.divergences++;
            
            if (this.config.rollbackEnabled) {
                result = this.performRollback(serverState, serverTick);
                this.stats.rollbacks++;
            } else {
                // Just replace with server state
                result = serverState;
                this.clearPredictions();
            }
        } else {
            // Minor differences - apply patches to current predicted state
            result = this.applyServerPatches(serverState, patches);
        }

        // Remove acknowledged commands
        this.removeAcknowledgedCommands(serverState, serverTick);
        
        // Update tracking
        this.lastServerState = this.deepClone(serverState);
        this._lastServerTick = serverTick;
        
        const reconciliationTime = Date.now() - startTime;
        this.stats.lastReconciliationTime = reconciliationTime;
        this.updateAverageLatency(reconciliationTime);
        
        this.emit('reconciled', {
            serverTick,
            divergenceScore,
            rollback: divergenceScore > this.config.divergenceThreshold,
            reconciliationTime
        });
        
        return result;
    }

    /**
     * Handle command acknowledgment from server
     */
    acknowledgeCommand(commandId: string, success: boolean): void {
        const command = this.pendingCommands.get(commandId);
        if (command) {
            if (success) {
                this.stats.successfulPredictions++;
                this.log('Command acknowledged', { commandId, success });
            } else {
                this.log('Command rejected', { commandId, success });
                // Remove failed command from predictions
                this.removeCommandFromPredictions(commandId);
            }
            
            this.pendingCommands.delete(commandId);
        }
    }

    /**
     * Perform rollback and replay predictions
     */
    private performRollback(serverState: any, serverTick: number): any {
        this.log('Performing rollback', { serverTick, snapshots: this.snapshots.length });
        
        // Start with server state
        let replayState = this.deepClone(serverState);
        
        // Find snapshots to replay (those after server tick)
        const replaySnapshots = this.snapshots.filter(snapshot => 
            snapshot.serverTick >= serverTick - this.config.maxRollbackTicks
        );
        
        // Replay predictions
        for (const snapshot of replaySnapshots) {
            if (snapshot.command && this.pendingCommands.has(snapshot.command.id)) {
                replayState = this.applyPrediction(replayState, snapshot.command);
                this.log('Replayed prediction', { commandId: snapshot.command.id });
            }
        }
        
        return replayState;
    }

    /**
     * Apply server patches to current state
     */
    private applyServerPatches(serverState: any, patches: JsonPatchOperation[]): any {
        // For minor differences, we can just use the server state
        // and reapply pending predictions
        let result = this.deepClone(serverState);
        
        // Reapply pending predictions
        for (const [commandId, command] of this.pendingCommands) {
            result = this.applyPrediction(result, command);
        }
        
        return result;
    }

    /**
     * Apply prediction logic for a command
     */
    private applyPrediction(state: any, command: ClientCommand): any {
        // This is where game-specific prediction logic would go
        const predictedState = this.deepClone(state);
        
        try {
            switch (command.type) {
                case 'placeTile':
                    return this.predictTilePlacement(predictedState, command);
                case 'moveUnit':
                    return this.predictUnitMovement(predictedState, command);
                case 'trainUnit':
                    return this.predictUnitTraining(predictedState, command);
                case 'placeWorker':
                    return this.predictWorkerPlacement(predictedState, command);
                default:
                    this.log('Unknown command type for prediction', { type: command.type });
                    return predictedState;
            }
        } catch (error) {
            this.log('Prediction error', { error: error.message, command });
            return predictedState;
        }
    }

    /**
     * Predict tile placement
     */
    private predictTilePlacement(state: any, command: ClientCommand): any {
        const { x, y, tile } = command.data;
        
        // Basic validation
        if (!state.grid) state.grid = {};
        const tileKey = `${x},${y}`;
        
        if (state.grid[tileKey]) {
            this.log('Tile placement prediction failed - position occupied', { x, y });
            return state;
        }
        
        // Apply tile placement
        state.grid[tileKey] = {
            ...tile,
            x,
            y,
            owner: command.playerId,
            timestamp: command.timestamp,
            predicted: true
        };
        
        return state;
    }

    /**
     * Predict unit movement
     */
    private predictUnitMovement(state: any, command: ClientCommand): any {
        const { unitId, targetX, targetY } = command.data;
        
        if (!state.units) state.units = {};
        
        const unit = state.units[unitId];
        if (!unit || unit.owner !== command.playerId) {
            return state;
        }
        
        // Update unit position immediately (optimistic)
        unit.x = targetX;
        unit.y = targetY;
        unit.lastMoveTime = command.timestamp;
        unit.predicted = true;
        
        return state;
    }

    /**
     * Predict unit training
     */
    private predictUnitTraining(state: any, command: ClientCommand): any {
        const { tileId, unitType } = command.data;
        
        if (!state.trainingQueues) state.trainingQueues = {};
        if (!state.trainingQueues[tileId]) state.trainingQueues[tileId] = [];
        
        // Add to training queue
        state.trainingQueues[tileId].push({
            unitType,
            playerId: command.playerId,
            startTime: command.timestamp,
            predicted: true
        });
        
        return state;
    }

    /**
     * Predict worker placement
     */
    private predictWorkerPlacement(state: any, command: ClientCommand): any {
        const { workerId, tileId } = command.data;
        
        if (!state.workers) state.workers = {};
        if (!state.tiles) state.tiles = {};
        
        const worker = state.workers[workerId];
        const tile = state.tiles[tileId];
        
        if (!worker || !tile || worker.owner !== command.playerId) {
            return state;
        }
        
        // Update worker assignment
        worker.assignedTile = tileId;
        worker.status = 'deployed';
        worker.predicted = true;
        
        // Update tile worker
        if (!tile.workers) tile.workers = [];
        tile.workers.push(workerId);
        
        return state;
    }

    /**
     * Remove acknowledged commands from predictions
     */
    private removeAcknowledgedCommands(serverState: any, serverTick: number): void {
        // Remove snapshots that are now confirmed by server
        const beforeCount = this.snapshots.length;
        this.snapshots = this.snapshots.filter(snapshot => {
            // Keep recent snapshots that might still be pending
            return snapshot.serverTick >= serverTick - 2;
        });
        
        if (beforeCount !== this.snapshots.length) {
            this.log('Cleaned up acknowledged predictions', {
                removed: beforeCount - this.snapshots.length,
                remaining: this.snapshots.length
            });
        }
    }

    /**
     * Remove a specific command from predictions
     */
    private removeCommandFromPredictions(commandId: string): void {
        this.snapshots = this.snapshots.filter(snapshot => 
            !snapshot.command || snapshot.command.id !== commandId
        );
        this.pendingCommands.delete(commandId);
    }

    /**
     * Clean up old snapshots
     */
    private cleanupSnapshots(): void {
        if (this.snapshots.length > this.config.maxSnapshots) {
            const excess = this.snapshots.length - this.config.maxSnapshots;
            this.snapshots.splice(0, excess);
        }
    }

    /**
     * Clear all predictions
     */
    private clearPredictions(): void {
        this.snapshots = [];
        this.pendingCommands.clear();
    }

    /**
     * Update average latency
     */
    private updateAverageLatency(latency: number): void {
        if (this.stats.averageLatency === 0) {
            this.stats.averageLatency = latency;
        } else {
            this.stats.averageLatency = (this.stats.averageLatency * 0.9) + (latency * 0.1);
        }
    }

    /**
     * Deep clone utility
     */
    private deepClone(obj: any): any {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        
        const cloned: any = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = this.deepClone(obj[key]);
            }
        }
        return cloned;
    }

    /**
     * Event system
     */
    on(event: string, callback: Function): void {
        if (!this.eventCallbacks.has(event)) {
            this.eventCallbacks.set(event, []);
        }
        this.eventCallbacks.get(event)!.push(callback);
    }

    private emit(event: string, data: any): void {
        const callbacks = this.eventCallbacks.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Error in prediction manager callback:', error);
                }
            });
        }
    }

    /**
     * Logging utility
     */
    private log(message: string, data?: any): void {
        if (this.config.debugMode) {
            console.log(`[PredictionManager] ${message}`, data || '');
        }
    }

    // Getters for monitoring
    get statistics(): ReconciliationStats {
        return { ...this.stats };
    }

    get pendingCommandCount(): number {
        return this.pendingCommands.size;
    }

    get snapshotCount(): number {
        return this.snapshots.length;
    }

    get lastServerTick(): number {
        return this._lastServerTick;
    }

    get configuration(): ReconciliationConfig {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<ReconciliationConfig>): void {
        this.config = { ...this.config, ...newConfig };
        this.log('Configuration updated', this.config);
    }
} 