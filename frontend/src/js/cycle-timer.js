// Cycle Timer Component - Shows remaining placement time, adapts to playersAlive
class CycleTimer {
    constructor(config = {}) {
        this.config = {
            baseTimePerPlayer: 15, // 15 seconds per player
            maxPlayers: 4,
            minTime: 30, // minimum 30 seconds
            maxTime: 60, // maximum 60 seconds
            position: 'top-center',
            ...config
        };
        
        this.container = null;
        this.timerElement = null;
        this.progressBar = null;
        this.playersAlive = 4;
        this.currentTime = 0;
        this.maxTime = 60;
        this.isRunning = false;
        this.interval = null;
        this.callbacks = {
            onTick: null,
            onComplete: null,
            onTimeChange: null
        };
        
        this.init();
    }

    init() {
        this.createContainer();
        this.injectStyles();
        this.updateTimer();
        console.log('CycleTimer initialized');
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'cycle-timer-container';
        this.container.className = `cycle-timer-container ${this.config.position}`;
        // Hide the distracting timer element
        this.container.style.display = 'none';
        
        this.container.innerHTML = `
            <div class="cycle-timer">
                <div class="cycle-timer-header">
                    <span class="cycle-timer-label">Placement Time</span>
                    <span class="cycle-timer-players">Players: <span id="players-alive">4</span></span>
                </div>
                <div class="cycle-timer-display">
                    <span class="cycle-timer-time" id="cycle-timer-time">60</span>
                    <span class="cycle-timer-unit">s</span>
                </div>
                <div class="cycle-timer-progress">
                    <div class="cycle-timer-progress-bar" id="cycle-timer-progress"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.container);
        
        // Get references
        this.timerElement = document.getElementById('cycle-timer-time');
        this.progressBar = document.getElementById('cycle-timer-progress');
        this.playersAliveElement = document.getElementById('players-alive');
    }

    injectStyles() {
        const styleId = 'cycle-timer-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .cycle-timer-container {
                position: fixed;
                z-index: 9999;
                pointer-events: none;
            }
            
            .cycle-timer-container.top-center {
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
            }
            
            .cycle-timer-container.top-left {
                top: 20px;
                left: 20px;
            }
            
            .cycle-timer-container.top-right {
                top: 20px;
                right: 20px;
            }
            
            .cycle-timer-container.bottom-center {
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
            }
            
            .cycle-timer {
                background: rgba(0, 0, 0, 0.85);
                color: white;
                border-radius: 12px;
                padding: 16px 20px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                font-family: Arial, sans-serif;
                text-align: center;
                min-width: 200px;
                pointer-events: auto;
                transition: all 0.3s ease;
            }
            
            .cycle-timer-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
                font-size: 12px;
                color: rgba(255, 255, 255, 0.8);
            }
            
            .cycle-timer-label {
                font-weight: bold;
            }
            
            .cycle-timer-players {
                font-size: 11px;
            }
            
            .cycle-timer-display {
                display: flex;
                justify-content: center;
                align-items: baseline;
                margin-bottom: 12px;
            }
            
            .cycle-timer-time {
                font-size: 32px;
                font-weight: bold;
                color: #4CAF50;
                transition: color 0.3s ease;
            }
            
            .cycle-timer-time.warning {
                color: #FF9800;
            }
            
            .cycle-timer-time.danger {
                color: #F44336;
                animation: pulse 1s ease-in-out infinite alternate;
            }
            
            .cycle-timer-unit {
                font-size: 18px;
                color: rgba(255, 255, 255, 0.8);
                margin-left: 4px;
            }
            
            .cycle-timer-progress {
                height: 6px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 3px;
                overflow: hidden;
                position: relative;
            }
            
            .cycle-timer-progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #4CAF50, #45a049);
                border-radius: 3px;
                transition: width 0.1s ease, background 0.3s ease;
                width: 100%;
            }
            
            .cycle-timer-progress-bar.warning {
                background: linear-gradient(90deg, #FF9800, #f57c00);
            }
            
            .cycle-timer-progress-bar.danger {
                background: linear-gradient(90deg, #F44336, #d32f2f);
            }
            
            .cycle-timer.hidden {
                opacity: 0;
                transform: translateY(-20px);
                pointer-events: none;
            }
            
            @keyframes pulse {
                from {
                    transform: scale(1);
                }
                to {
                    transform: scale(1.05);
                }
            }
            
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-2px); }
                75% { transform: translateX(2px); }
            }
            
            .cycle-timer.shake {
                animation: shake 0.5s ease-in-out;
            }
        `;
        document.head.appendChild(style);
    }

    // Calculate timer duration based on players alive
    calculateTimerDuration(playersAlive) {
        const baseDuration = this.config.baseTimePerPlayer * playersAlive;
        const duration = Math.max(
            this.config.minTime,
            Math.min(this.config.maxTime, baseDuration)
        );
        return duration;
    }

    // Update players alive count and recalculate timer
    updatePlayersAlive(playersAlive) {
        if (this.playersAlive === playersAlive) return;
        
        this.playersAlive = playersAlive;
        const newMaxTime = this.calculateTimerDuration(playersAlive);
        
        // Update players display
        this.playersAliveElement.textContent = playersAlive;
        
        // If timer is running, adjust current time proportionally
        if (this.isRunning) {
            const timeRatio = this.currentTime / this.maxTime;
            this.currentTime = Math.max(1, Math.floor(newMaxTime * timeRatio));
        } else {
            this.currentTime = newMaxTime;
        }
        
        this.maxTime = newMaxTime;
        this.updateTimer();
        
        // Trigger callback
        if (this.callbacks.onTimeChange) {
            this.callbacks.onTimeChange(this.currentTime, this.maxTime, playersAlive);
        }
        
        console.log(`Timer updated: ${playersAlive} players, ${newMaxTime}s duration`);
    }

    // Start the timer
    start(initialTime = null) {
        if (this.isRunning) return;
        
        if (initialTime !== null) {
            this.currentTime = initialTime;
        } else if (this.currentTime <= 0) {
            this.currentTime = this.maxTime;
        }
        
        this.isRunning = true;
        this.container.classList.remove('hidden');
        
        this.interval = setInterval(() => {
            this.currentTime--;
            this.updateTimer();
            
            if (this.callbacks.onTick) {
                this.callbacks.onTick(this.currentTime, this.maxTime);
            }
            
            if (this.currentTime <= 0) {
                this.stop();
                if (this.callbacks.onComplete) {
                    this.callbacks.onComplete();
                }
            }
        }, 1000);
        
        this.updateTimer();
        console.log('Timer started');
    }

    // Stop the timer
    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        
        console.log('Timer stopped');
    }

    // Pause the timer
    pause() {
        if (!this.isRunning) return;
        
        this.stop();
        console.log('Timer paused');
    }

    // Reset the timer
    reset() {
        this.stop();
        this.currentTime = this.maxTime;
        this.updateTimer();
        console.log('Timer reset');
    }

    // Update the timer display
    updateTimer() {
        if (!this.timerElement || !this.progressBar) return;
        
        // Update time display
        this.timerElement.textContent = this.currentTime;
        
        // Update progress bar
        const percentage = (this.currentTime / this.maxTime) * 100;
        this.progressBar.style.width = `${percentage}%`;
        
        // Update colors based on remaining time
        const timeRatio = this.currentTime / this.maxTime;
        
        // Remove existing classes
        this.timerElement.classList.remove('warning', 'danger');
        this.progressBar.classList.remove('warning', 'danger');
        
        if (timeRatio <= 0.2) { // 20% remaining
            this.timerElement.classList.add('danger');
            this.progressBar.classList.add('danger');
        } else if (timeRatio <= 0.5) { // 50% remaining
            this.timerElement.classList.add('warning');
            this.progressBar.classList.add('warning');
        }
        
        // Add shake effect when time is very low
        if (this.currentTime <= 5 && this.currentTime > 0) {
            this.container.classList.add('shake');
            setTimeout(() => {
                this.container.classList.remove('shake');
            }, 500);
        }
    }

    // Set callback functions
    onTick(callback) {
        this.callbacks.onTick = callback;
    }

    onComplete(callback) {
        this.callbacks.onComplete = callback;
    }

    onTimeChange(callback) {
        this.callbacks.onTimeChange = callback;
    }

    // Get current time
    getCurrentTime() {
        return this.currentTime;
    }

    // Get max time
    getMaxTime() {
        return this.maxTime;
    }

    // Check if timer is running
    isTimerRunning() {
        return this.isRunning;
    }

    // Show/hide timer
    show() {
        this.container.classList.remove('hidden');
    }

    hide() {
        this.container.classList.add('hidden');
    }

    // Update configuration
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        this.container.className = `cycle-timer-container ${this.config.position}`;
    }

    // Destroy the timer
    destroy() {
        this.stop();
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        console.log('CycleTimer destroyed');
    }
} 