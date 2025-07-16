import { gsap } from 'gsap';
import type { Application, Container, DisplayObject } from 'pixi.js';

/**
 * Configuration for tween animations
 */
interface TweenConfig {
    duration?: number;
    ease?: string;
    delay?: number;
    onComplete?: () => void;
    onUpdate?: (progress: number) => void;
    maxCatchUpSpeed?: number;
    priority?: number;
}

/**
 * Represents a single tween animation
 */
interface TweenAnimation {
    id: string;
    target: DisplayObject;
    from: Record<string, number>;
    to: Record<string, number>;
    config: TweenConfig;
    timeline: gsap.core.Timeline;
    priority: number;
    startTime: number;
    isActive: boolean;
}

/**
 * Tween system that smooths discrete server state updates
 */
export class TweenSystem {
    private app: Application;
    private activeTweens: Map<string, TweenAnimation> = new Map();
    private tweenQueue: TweenAnimation[] = [];
    private isEnabled: boolean = true;
    
    // Configuration
    private defaultConfig: Required<TweenConfig> = {
        duration: 0.12, // 120ms default for smooth server sync
        ease: 'power2.out',
        delay: 0,
        onComplete: () => {},
        onUpdate: () => {},
        maxCatchUpSpeed: 800, // pixels per second max catch-up
        priority: 0
    };
    
    // Debug settings
    private debugMode: boolean = false;
    private debugStats = {
        totalTweens: 0,
        activeTweens: 0,
        averageDuration: 0,
        lastUpdateTime: 0
    };

    constructor(app: Application) {
        this.app = app;
        this.initializeTicker();
        console.log('TweenSystem initialized');
    }

    /**
     * Initialize the PIXI ticker integration
     */
    private initializeTicker(): void {
        this.app.ticker.add(this.update, this);
    }

    /**
     * Update method called by PIXI ticker
     */
    private update(deltaTime: number): void {
        if (!this.isEnabled) return;

        this.debugStats.lastUpdateTime = Date.now();
        this.debugStats.activeTweens = this.activeTweens.size;

        // Process queued tweens
        this.processQueue();

        // Clean up completed tweens
        this.cleanupCompleted();
    }

    /**
     * Process the tween queue (priority-based)
     */
    private processQueue(): void {
        if (this.tweenQueue.length === 0) return;

        // Sort by priority (higher priority first)
        this.tweenQueue.sort((a, b) => b.priority - a.priority);

        const toProcess = this.tweenQueue.splice(0, 10); // Process max 10 per frame
        
        for (const tween of toProcess) {
            this.executeTween(tween);
        }
    }

    /**
     * Execute a tween animation
     */
    private executeTween(tween: TweenAnimation): void {
        if (!tween.target || tween.target.destroyed) {
            return;
        }

        // Kill existing tween for this target
        this.killTween(tween.id);

        // Calculate dynamic duration based on distance
        const distance = this.calculateDistance(tween.from, tween.to);
        const dynamicDuration = Math.min(
            tween.config.duration || this.defaultConfig.duration,
            distance / tween.config.maxCatchUpSpeed!
        );

        // Create GSAP timeline
        const timeline = gsap.timeline({
            onComplete: () => {
                tween.config.onComplete?.();
                this.activeTweens.delete(tween.id);
            },
            onUpdate: () => {
                const progress = timeline.progress();
                tween.config.onUpdate?.(progress);
            }
        });

        // Add tween to timeline
        timeline.to(tween.target, {
            ...tween.to,
            duration: dynamicDuration,
            ease: tween.config.ease || this.defaultConfig.ease,
            delay: tween.config.delay || this.defaultConfig.delay
        });

        // Store the active tween
        tween.timeline = timeline;
        tween.isActive = true;
        tween.startTime = Date.now();
        this.activeTweens.set(tween.id, tween);

        // Update stats
        this.debugStats.totalTweens++;
        this.updateAverageDuration(dynamicDuration);

        if (this.debugMode) {
            console.log(`Started tween ${tween.id} with duration ${dynamicDuration}ms`);
        }
    }

    /**
     * Tween a display object to new position/properties
     */
    public tweenTo(
        target: DisplayObject,
        to: Record<string, number>,
        config: TweenConfig = {},
        id?: string
    ): string {
        if (!target || target.destroyed) {
            console.warn('Cannot tween destroyed or null target');
            return '';
        }

        const tweenId = id || `tween_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Capture current state
        const from: Record<string, number> = {};
        for (const key in to) {
            from[key] = (target as any)[key] || 0;
        }

        // Create tween animation
        const tween: TweenAnimation = {
            id: tweenId,
            target,
            from,
            to,
            config: { ...this.defaultConfig, ...config },
            timeline: gsap.timeline(),
            priority: config.priority || this.defaultConfig.priority,
            startTime: Date.now(),
            isActive: false
        };

        // Add to queue
        this.tweenQueue.push(tween);

        return tweenId;
    }

    /**
     * Tween unit position smoothly
     */
    public tweenUnitPosition(
        unitSprite: DisplayObject,
        newX: number,
        newY: number,
        unitId: string,
        config: TweenConfig = {}
    ): string {
        const distance = Math.sqrt(
            Math.pow(newX - unitSprite.x, 2) + 
            Math.pow(newY - unitSprite.y, 2)
        );

        // Adjust duration based on distance
        const adjustedDuration = Math.max(
            0.08, // minimum 80ms
            Math.min(0.3, distance / 400) // scale with distance
        );

        return this.tweenTo(
            unitSprite,
            { x: newX, y: newY },
            {
                duration: adjustedDuration,
                ease: 'power2.out',
                priority: 1,
                ...config
            },
            `unit_${unitId}_position`
        );
    }

    /**
     * Tween tile placement animation
     */
    public tweenTilePlacement(
        tileSprite: DisplayObject,
        config: TweenConfig = {}
    ): string {
        // Scale in animation
        tileSprite.scale.set(0);
        
        return this.tweenTo(
            tileSprite,
            { 
                'scale.x': 1,
                'scale.y': 1,
                alpha: 1
            },
            {
                duration: 0.25,
                ease: 'back.out(1.7)',
                priority: 2,
                ...config
            },
            `tile_${Date.now()}_placement`
        );
    }

    /**
     * Tween resource UI updates
     */
    public tweenResourceUpdate(
        resourceElement: DisplayObject,
        newValue: number,
        config: TweenConfig = {}
    ): string {
        return this.tweenTo(
            resourceElement,
            { alpha: 1 },
            {
                duration: 0.15,
                ease: 'power2.out',
                priority: 0,
                onUpdate: (progress) => {
                    // Custom resource counter animation logic can go here
                    config.onUpdate?.(progress);
                },
                ...config
            },
            `resource_${Date.now()}_update`
        );
    }

    /**
     * Kill a specific tween
     */
    public killTween(tweenId: string): void {
        const tween = this.activeTweens.get(tweenId);
        if (tween) {
            tween.timeline.kill();
            this.activeTweens.delete(tweenId);
        }

        // Remove from queue if present
        this.tweenQueue = this.tweenQueue.filter(t => t.id !== tweenId);
    }

    /**
     * Kill all tweens for a specific target
     */
    public killTweensForTarget(target: DisplayObject): void {
        const toKill: string[] = [];
        
        for (const [id, tween] of this.activeTweens) {
            if (tween.target === target) {
                toKill.push(id);
            }
        }

        for (const id of toKill) {
            this.killTween(id);
        }
    }

    /**
     * Kill all tweens
     */
    public killAllTweens(): void {
        for (const [id, tween] of this.activeTweens) {
            tween.timeline.kill();
        }
        this.activeTweens.clear();
        this.tweenQueue = [];
    }

    /**
     * Enable or disable the tween system
     */
    public setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
        if (!enabled) {
            this.killAllTweens();
        }
    }

    /**
     * Toggle debug mode
     */
    public setDebugMode(enabled: boolean): void {
        this.debugMode = enabled;
        if (enabled) {
            console.log('TweenSystem debug mode enabled');
        }
    }

    /**
     * Get current debug stats
     */
    public getDebugStats(): typeof this.debugStats {
        return { ...this.debugStats };
    }

    /**
     * Configure default tween settings
     */
    public configure(config: Partial<TweenConfig>): void {
        this.defaultConfig = { ...this.defaultConfig, ...config };
    }

    /**
     * Check if a tween is active
     */
    public isTweenActive(tweenId: string): boolean {
        return this.activeTweens.has(tweenId);
    }

    /**
     * Get the progress of a specific tween (0-1)
     */
    public getTweenProgress(tweenId: string): number {
        const tween = this.activeTweens.get(tweenId);
        return tween ? tween.timeline.progress() : 0;
    }

    /**
     * Calculate distance between two points
     */
    private calculateDistance(from: Record<string, number>, to: Record<string, number>): number {
        let totalDistance = 0;
        
        for (const key in to) {
            if (from[key] !== undefined) {
                totalDistance += Math.abs(to[key] - from[key]);
            }
        }
        
        return totalDistance;
    }

    /**
     * Clean up completed tweens
     */
    private cleanupCompleted(): void {
        const toRemove: string[] = [];
        
        for (const [id, tween] of this.activeTweens) {
            if (!tween.isActive || tween.timeline.progress() >= 1) {
                toRemove.push(id);
            }
        }

        for (const id of toRemove) {
            this.activeTweens.delete(id);
        }
    }

    /**
     * Update average duration for stats
     */
    private updateAverageDuration(duration: number): void {
        if (this.debugStats.totalTweens === 0) {
            this.debugStats.averageDuration = duration;
        } else {
            this.debugStats.averageDuration = 
                (this.debugStats.averageDuration + duration) / 2;
        }
    }

    /**
     * Destroy the tween system
     */
    public destroy(): void {
        this.killAllTweens();
        this.app.ticker.remove(this.update, this);
        console.log('TweenSystem destroyed');
    }
} 