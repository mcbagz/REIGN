// Offline Banner Component - Shows when WebSocket client disconnects
class OfflineBanner {
    constructor(config = {}) {
        this.config = {
            position: 'top',
            hideDelay: 5000, // Hide after 5 seconds of reconnection
            showReconnectButton: true,
            autoHide: true,
            ...config
        };
        
        this.container = null;
        this.isVisible = false;
        this.reconnectAttempts = 0;
        this.hideTimeout = null;
        this.callbacks = {
            onReconnectClick: null,
            onShow: null,
            onHide: null
        };
        
        this.init();
    }

    init() {
        this.createContainer();
        this.injectStyles();
        console.log('OfflineBanner initialized');
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'offline-banner-container';
        this.container.className = `offline-banner-container ${this.config.position}`;
        
        this.container.innerHTML = `
            <div class="offline-banner">
                <div class="offline-banner-content">
                    <div class="offline-banner-icon">
                        <span class="offline-icon">📡</span>
                    </div>
                    <div class="offline-banner-info">
                        <div class="offline-banner-title">Connection Lost</div>
                        <div class="offline-banner-message" id="offline-banner-message">
                            You're offline. Check your internet connection.
                        </div>
                        <div class="offline-banner-status" id="offline-banner-status">
                            Reconnecting...
                        </div>
                    </div>
                    <div class="offline-banner-actions">
                        <button class="offline-banner-button" id="offline-reconnect-btn">
                            Reconnect
                        </button>
                        <button class="offline-banner-close" id="offline-banner-close">
                            &times;
                        </button>
                    </div>
                </div>
                <div class="offline-banner-progress">
                    <div class="offline-banner-progress-bar" id="offline-progress-bar"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.container);
        
        // Get references
        this.messageElement = document.getElementById('offline-banner-message');
        this.statusElement = document.getElementById('offline-banner-status');
        this.progressBar = document.getElementById('offline-progress-bar');
        this.reconnectButton = document.getElementById('offline-reconnect-btn');
        this.closeButton = document.getElementById('offline-banner-close');
        
        // Add event listeners
        this.reconnectButton.addEventListener('click', () => this.handleReconnectClick());
        this.closeButton.addEventListener('click', () => this.hide());
        
        // Hide initially
        this.container.classList.add('hidden');
    }

    injectStyles() {
        const styleId = 'offline-banner-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .offline-banner-container {
                position: fixed;
                left: 0;
                right: 0;
                z-index: 10001;
                pointer-events: none;
            }
            
            .offline-banner-container.top {
                top: 0;
            }
            
            .offline-banner-container.bottom {
                bottom: 0;
            }
            
            .offline-banner {
                background: linear-gradient(135deg, #FF6B6B, #FF8E8E);
                color: white;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                font-family: Arial, sans-serif;
                font-size: 14px;
                pointer-events: auto;
                transform: translateY(-100%);
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
            }
            
            .offline-banner-container.bottom .offline-banner {
                transform: translateY(100%);
                border-bottom: none;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .offline-banner-container.show .offline-banner {
                transform: translateY(0);
            }
            
            .offline-banner-content {
                display: flex;
                align-items: center;
                padding: 12px 20px;
                gap: 12px;
            }
            
            .offline-banner-icon {
                flex-shrink: 0;
            }
            
            .offline-icon {
                font-size: 24px;
                animation: pulse 2s infinite;
            }
            
            .offline-banner-info {
                flex: 1;
                min-width: 0;
            }
            
            .offline-banner-title {
                font-weight: bold;
                font-size: 16px;
                margin-bottom: 4px;
            }
            
            .offline-banner-message {
                opacity: 0.9;
                margin-bottom: 4px;
            }
            
            .offline-banner-status {
                font-size: 12px;
                opacity: 0.8;
                font-style: italic;
            }
            
            .offline-banner-actions {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-shrink: 0;
            }
            
            .offline-banner-button {
                background: rgba(255, 255, 255, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: white;
                padding: 6px 12px;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .offline-banner-button:hover {
                background: rgba(255, 255, 255, 0.3);
                border-color: rgba(255, 255, 255, 0.5);
            }
            
            .offline-banner-button:active {
                transform: scale(0.95);
            }
            
            .offline-banner-button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .offline-banner-close {
                background: none;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                padding: 4px;
                line-height: 1;
                opacity: 0.7;
            }
            
            .offline-banner-close:hover {
                opacity: 1;
            }
            
            .offline-banner-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 3px;
                background: rgba(255, 255, 255, 0.2);
                overflow: hidden;
            }
            
            .offline-banner-progress-bar {
                height: 100%;
                background: rgba(255, 255, 255, 0.8);
                width: 0%;
                transition: width 0.3s ease;
            }
            
            .offline-banner-container.hidden {
                display: none;
            }
            
            .offline-banner.reconnecting {
                background: linear-gradient(135deg, #FF9800, #FFB74D);
            }
            
            .offline-banner.connected {
                background: linear-gradient(135deg, #4CAF50, #66BB6A);
            }
            
            @keyframes pulse {
                0%, 100% {
                    opacity: 1;
                }
                50% {
                    opacity: 0.5;
                }
            }
            
            @keyframes spin {
                0% {
                    transform: rotate(0deg);
                }
                100% {
                    transform: rotate(360deg);
                }
            }
            
            .offline-banner.reconnecting .offline-icon {
                animation: spin 1s linear infinite;
            }
            
            .offline-banner-container.slide-up {
                animation: slideUp 0.3s ease;
            }
            
            .offline-banner-container.slide-down {
                animation: slideDown 0.3s ease;
            }
            
            @keyframes slideUp {
                from {
                    transform: translateY(100%);
                }
                to {
                    transform: translateY(0);
                }
            }
            
            @keyframes slideDown {
                from {
                    transform: translateY(-100%);
                }
                to {
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
    }

    show(message = 'Connection lost. Trying to reconnect...', status = 'Reconnecting...') {
        if (this.isVisible) return;
        
        this.isVisible = true;
        this.messageElement.textContent = message;
        this.statusElement.textContent = status;
        
        // Clear any existing hide timeout
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
        
        // Show banner
        this.container.classList.remove('hidden');
        this.container.classList.add('show');
        
        // Set reconnecting state
        this.setReconnectingState();
        
        // Trigger callback
        if (this.callbacks.onShow) {
            this.callbacks.onShow();
        }
        
        console.log('OfflineBanner shown');
    }

    hide() {
        if (!this.isVisible) return;
        
        this.isVisible = false;
        this.container.classList.remove('show');
        
        // Hide after animation
        setTimeout(() => {
            this.container.classList.add('hidden');
        }, 300);
        
        // Clear hide timeout
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
        
        // Trigger callback
        if (this.callbacks.onHide) {
            this.callbacks.onHide();
        }
        
        console.log('OfflineBanner hidden');
    }

    setReconnectingState() {
        const banner = this.container.querySelector('.offline-banner');
        banner.classList.remove('connected');
        banner.classList.add('reconnecting');
        
        this.reconnectButton.disabled = true;
        this.reconnectButton.textContent = 'Reconnecting...';
        this.statusElement.textContent = 'Reconnecting...';
        
        // Animate progress bar
        this.animateProgress();
    }

    setConnectedState() {
        const banner = this.container.querySelector('.offline-banner');
        banner.classList.remove('reconnecting');
        banner.classList.add('connected');
        
        this.reconnectButton.disabled = false;
        this.reconnectButton.textContent = 'Reconnect';
        this.statusElement.textContent = 'Connected!';
        this.messageElement.textContent = 'Connection restored';
        
        // Stop progress animation
        this.stopProgress();
        
        // Auto-hide after delay
        if (this.config.autoHide) {
            this.hideTimeout = setTimeout(() => {
                this.hide();
            }, this.config.hideDelay);
        }
    }

    setDisconnectedState() {
        const banner = this.container.querySelector('.offline-banner');
        banner.classList.remove('connected', 'reconnecting');
        
        this.reconnectButton.disabled = false;
        this.reconnectButton.textContent = 'Reconnect';
        this.statusElement.textContent = 'Disconnected';
        this.messageElement.textContent = 'Unable to connect to server';
        
        // Stop progress animation
        this.stopProgress();
    }

    updateReconnectAttempts(attempts, maxAttempts = null) {
        this.reconnectAttempts = attempts;
        
        if (maxAttempts) {
            this.statusElement.textContent = `Reconnecting... (${attempts}/${maxAttempts})`;
        } else {
            this.statusElement.textContent = `Reconnecting... (attempt ${attempts})`;
        }
        
        // Update progress based on attempts
        if (maxAttempts) {
            const progress = (attempts / maxAttempts) * 100;
            this.progressBar.style.width = `${progress}%`;
        }
    }

    animateProgress() {
        let progress = 0;
        const interval = setInterval(() => {
            progress += 2;
            if (progress >= 100) {
                progress = 0;
            }
            this.progressBar.style.width = `${progress}%`;
        }, 100);
        
        this.progressInterval = interval;
    }

    stopProgress() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
        this.progressBar.style.width = '100%';
    }

    handleReconnectClick() {
        if (this.callbacks.onReconnectClick) {
            this.callbacks.onReconnectClick();
        }
        this.setReconnectingState();
    }

    // Set callback functions
    onReconnectClick(callback) {
        this.callbacks.onReconnectClick = callback;
    }

    onShow(callback) {
        this.callbacks.onShow = callback;
    }

    onHide(callback) {
        this.callbacks.onHide = callback;
    }

    // Check if banner is visible
    isVisible() {
        return this.isVisible;
    }

    // Update configuration
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        this.container.className = `offline-banner-container ${this.config.position}`;
    }

    // Destroy the banner
    destroy() {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }
        
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        console.log('OfflineBanner destroyed');
    }
} 