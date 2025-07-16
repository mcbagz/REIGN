// JavaScript Toast Manager for displaying player action notifications
class ToastManager {
    constructor(config = {}) {
        this.config = {
            maxVisible: 3,
            defaultDuration: 3000, // 3 seconds
            animationDuration: 300, // 300ms
            stackDirection: 'down',
            position: 'top-right',
            ...config
        };
        
        this.container = null;
        this.activeToasts = new Map();
        this.toastQueue = [];
        this.isProcessing = false;
        
        this.init();
    }

    init() {
        this.createContainer();
        this.injectStyles();
        console.log('ToastManager initialized');
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.className = `toast-container ${this.config.position}`;
        document.body.appendChild(this.container);
    }

    injectStyles() {
        const styleId = 'toast-manager-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .toast-container {
                position: fixed;
                z-index: 10000;
                pointer-events: none;
                max-width: 400px;
                min-width: 300px;
            }
            
            .toast-container.top-right {
                top: 20px;
                right: 20px;
            }
            
            .toast-container.top-left {
                top: 20px;
                left: 20px;
            }
            
            .toast-container.bottom-right {
                bottom: 20px;
                right: 20px;
            }
            
            .toast-container.bottom-left {
                bottom: 20px;
                left: 20px;
            }
            
            .toast-container.top-center {
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
            }
            
            .toast-container.bottom-center {
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
            }
            
            .toast {
                background: rgba(0, 0, 0, 0.85);
                color: white;
                border-radius: 8px;
                padding: 12px 16px;
                margin-bottom: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                pointer-events: auto;
                cursor: pointer;
                font-family: Arial, sans-serif;
                font-size: 14px;
                line-height: 1.4;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: all 0.3s ease;
                transform: translateX(100%);
                opacity: 0;
                max-width: 100%;
                overflow: hidden;
                word-wrap: break-word;
            }
            
            .toast.show {
                transform: translateX(0);
                opacity: 1;
            }
            
            .toast.hide {
                transform: translateX(100%);
                opacity: 0;
            }
            
            .toast-icon {
                font-size: 16px;
                flex-shrink: 0;
            }
            
            .toast-content {
                flex: 1;
                min-width: 0;
            }
            
            .toast-player {
                font-weight: bold;
                color: #ffd700;
            }
            
            .toast-message {
                margin-top: 2px;
            }
            
            .toast-close {
                background: none;
                border: none;
                color: rgba(255, 255, 255, 0.7);
                font-size: 16px;
                cursor: pointer;
                padding: 0;
                margin-left: 8px;
                flex-shrink: 0;
            }
            
            .toast-close:hover {
                color: white;
            }
            
            .toast.action {
                border-left: 4px solid #4CAF50;
            }
            
            .toast.info {
                border-left: 4px solid #2196F3;
            }
            
            .toast.warning {
                border-left: 4px solid #FF9800;
            }
            
            .toast.error {
                border-left: 4px solid #F44336;
            }
            
            .toast.success {
                border-left: 4px solid #4CAF50;
            }
            
            .toast-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 2px;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 0 0 8px 8px;
                overflow: hidden;
            }
            
            .toast-progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #4CAF50, #45a049);
                transition: width linear;
                width: 100%;
            }
        `;
        document.head.appendChild(style);
    }

    showToast(message, type = 'info', player = null, duration = null) {
        const toast = {
            id: this.generateId(),
            type,
            message,
            player,
            duration: duration || this.config.defaultDuration,
            timestamp: Date.now()
        };

        this.toastQueue.push(toast);
        this.processQueue();
        
        return toast.id;
    }

    showActionToast(player, action, duration = null) {
        return this.showToast(`${action}`, 'action', player, duration);
    }

    showInfo(message, duration = null) {
        return this.showToast(message, 'info', null, duration);
    }

    showWarning(message, duration = null) {
        return this.showToast(message, 'warning', null, duration);
    }

    showError(message, duration = null) {
        return this.showToast(message, 'error', null, duration);
    }

    showSuccess(message, duration = null) {
        return this.showToast(message, 'success', null, duration);
    }

    async processQueue() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        while (this.toastQueue.length > 0 && this.activeToasts.size < this.config.maxVisible) {
            const toast = this.toastQueue.shift();
            await this.displayToast(toast);
        }

        this.isProcessing = false;
    }

    async displayToast(toast) {
        const element = this.createToastElement(toast);
        
        // Add to active toasts
        this.activeToasts.set(toast.id, element);
        
        // Add to DOM
        if (this.config.stackDirection === 'up') {
            this.container.insertBefore(element, this.container.firstChild);
        } else {
            this.container.appendChild(element);
        }

        // Animate in
        requestAnimationFrame(() => {
            element.classList.add('show');
        });

        // Set up auto-remove timer
        this.scheduleRemoval(toast.id, toast.duration);
    }

    createToastElement(toast) {
        const element = document.createElement('div');
        element.className = `toast ${toast.type}`;
        element.setAttribute('data-toast-id', toast.id);

        const icon = this.getToastIcon(toast.type);
        
        const playerSection = toast.player ? 
            `<div class="toast-player">${toast.player}</div>` : '';
        
        element.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">
                ${playerSection}
                <div class="toast-message">${toast.message}</div>
            </div>
            <button class="toast-close" aria-label="Close">&times;</button>
            <div class="toast-progress">
                <div class="toast-progress-bar"></div>
            </div>
        `;

        // Add click handlers
        const closeBtn = element.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.removeToast(toast.id));
        
        element.addEventListener('click', (e) => {
            if (e.target !== closeBtn) {
                this.removeToast(toast.id);
            }
        });

        // Set up progress bar animation
        const progressBar = element.querySelector('.toast-progress-bar');
        if (progressBar) {
            progressBar.style.transitionDuration = `${toast.duration}ms`;
            requestAnimationFrame(() => {
                progressBar.style.width = '0%';
            });
        }

        return element;
    }

    getToastIcon(type) {
        const icons = {
            action: '⚡',
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌',
            success: '✅'
        };
        return icons[type] || icons.info;
    }

    scheduleRemoval(toastId, duration) {
        setTimeout(() => {
            this.removeToast(toastId);
        }, duration);
    }

    removeToast(toastId) {
        const element = this.activeToasts.get(toastId);
        if (!element) return;

        // Animate out
        element.classList.add('hide');
        element.classList.remove('show');

        // Remove from DOM after animation
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
            this.activeToasts.delete(toastId);
            
            // Process queue if there are pending toasts
            if (this.toastQueue.length > 0) {
                this.processQueue();
            }
        }, this.config.animationDuration);
    }

    clearAll() {
        const toastIds = Array.from(this.activeToasts.keys());
        toastIds.forEach(id => this.removeToast(id));
        this.toastQueue = [];
    }

    updateConfig(config) {
        this.config = { ...this.config, ...config };
        
        // Update container position
        this.container.className = `toast-container ${this.config.position}`;
    }

    getActiveCount() {
        return this.activeToasts.size;
    }

    getQueueLength() {
        return this.toastQueue.length;
    }

    generateId() {
        return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    destroy() {
        this.clearAll();
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        console.log('ToastManager destroyed');
    }
} 