/**
 * Toast Manager for displaying player action notifications
 * Handles queuing, animations, and lifecycle management
 */

export interface ToastMessage {
    id: string;
    type: 'action' | 'info' | 'warning' | 'error' | 'success';
    message: string;
    player?: string;
    duration?: number;
    timestamp: number;
}

export interface ToastConfig {
    maxVisible: number;
    defaultDuration: number;
    animationDuration: number;
    stackDirection: 'up' | 'down';
    position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

export class ToastManager {
    private container: HTMLElement;
    private activeToasts: Map<string, HTMLElement> = new Map();
    private toastQueue: ToastMessage[] = [];
    private isProcessing: boolean = false;
    
    private config: ToastConfig = {
        maxVisible: 3,
        defaultDuration: 3000, // 3 seconds
        animationDuration: 300, // 300ms
        stackDirection: 'down',
        position: 'top-right'
    };

    constructor(config?: Partial<ToastConfig>) {
        this.config = { ...this.config, ...config };
        this.init();
    }

    /**
     * Initialize the toast manager
     */
    private init(): void {
        this.createContainer();
        this.injectStyles();
        console.log('ToastManager initialized');
    }

    /**
     * Create the toast container
     */
    private createContainer(): void {
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.className = `toast-container ${this.config.position}`;
        document.body.appendChild(this.container);
    }

    /**
     * Inject CSS styles for toasts
     */
    private injectStyles(): void {
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
            
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
            
            .toast-entering {
                animation: slideInRight 0.3s ease;
            }
            
            .toast-leaving {
                animation: slideOutRight 0.3s ease;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Show a toast message
     */
    public showToast(message: string, type: ToastMessage['type'] = 'info', player?: string, duration?: number): string {
        const toast: ToastMessage = {
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

    /**
     * Show an action toast (player action notification)
     */
    public showActionToast(player: string, action: string, duration?: number): string {
        return this.showToast(`${action}`, 'action', player, duration);
    }

    /**
     * Show info toast
     */
    public showInfo(message: string, duration?: number): string {
        return this.showToast(message, 'info', undefined, duration);
    }

    /**
     * Show warning toast
     */
    public showWarning(message: string, duration?: number): string {
        return this.showToast(message, 'warning', undefined, duration);
    }

    /**
     * Show error toast
     */
    public showError(message: string, duration?: number): string {
        return this.showToast(message, 'error', undefined, duration);
    }

    /**
     * Show success toast
     */
    public showSuccess(message: string, duration?: number): string {
        return this.showToast(message, 'success', undefined, duration);
    }

    /**
     * Process the toast queue
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessing) return;
        this.isProcessing = true;

        while (this.toastQueue.length > 0 && this.activeToasts.size < this.config.maxVisible) {
            const toast = this.toastQueue.shift()!;
            await this.displayToast(toast);
        }

        this.isProcessing = false;
    }

    /**
     * Display a toast message
     */
    private async displayToast(toast: ToastMessage): Promise<void> {
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

    /**
     * Create a toast DOM element
     */
    private createToastElement(toast: ToastMessage): HTMLElement {
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
        const closeBtn = element.querySelector('.toast-close') as HTMLElement;
        closeBtn.addEventListener('click', () => this.removeToast(toast.id));
        
        element.addEventListener('click', (e) => {
            if (e.target !== closeBtn) {
                this.removeToast(toast.id);
            }
        });

        // Set up progress bar animation
        const progressBar = element.querySelector('.toast-progress-bar') as HTMLElement;
        if (progressBar) {
            progressBar.style.transitionDuration = `${toast.duration}ms`;
            requestAnimationFrame(() => {
                progressBar.style.width = '0%';
            });
        }

        return element;
    }

    /**
     * Get icon for toast type
     */
    private getToastIcon(type: ToastMessage['type']): string {
        const icons = {
            action: '⚡',
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌',
            success: '✅'
        };
        return icons[type] || icons.info;
    }

    /**
     * Schedule toast removal
     */
    private scheduleRemoval(toastId: string, duration: number): void {
        setTimeout(() => {
            this.removeToast(toastId);
        }, duration);
    }

    /**
     * Remove a toast by ID
     */
    public removeToast(toastId: string): void {
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

    /**
     * Clear all toasts
     */
    public clearAll(): void {
        const toastIds = Array.from(this.activeToasts.keys());
        toastIds.forEach(id => this.removeToast(id));
        this.toastQueue = [];
    }

    /**
     * Update configuration
     */
    public updateConfig(config: Partial<ToastConfig>): void {
        this.config = { ...this.config, ...config };
        
        // Update container position
        this.container.className = `toast-container ${this.config.position}`;
    }

    /**
     * Get current toast count
     */
    public getActiveCount(): number {
        return this.activeToasts.size;
    }

    /**
     * Get queue length
     */
    public getQueueLength(): number {
        return this.toastQueue.length;
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Destroy the toast manager
     */
    public destroy(): void {
        this.clearAll();
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        console.log('ToastManager destroyed');
    }
} 