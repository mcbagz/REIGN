// JavaScript wrapper for the TweenSystem
class TweenSystem {
    constructor(pixiApp) {
        this.app = pixiApp;
        this.activeTweens = new Map();
        this.tweenQueue = [];
        this.isEnabled = true;
        
        // Configuration
        this.defaultConfig = {
            duration: 0.12, // 120ms default for smooth server sync
            ease: 'power2.out',
            delay: 0,
            onComplete: () => {},
            onUpdate: () => {},
            maxCatchUpSpeed: 800, // pixels per second max catch-up
            priority: 0
        };
        
        // Debug settings
        this.debugMode = false;
        this.debugStats = {
            totalTweens: 0,
            activeTweens: 0,
            averageDuration: 0,
            lastUpdateTime: 0
        };

        this.initializeTicker();
        console.log('TweenSystem initialized');
    }

    /**
     * Initialize the PIXI ticker integration
     */
    initializeTicker() {
        this.app.ticker.add(this.update.bind(this));
    }

    /**
     * Update method called by PIXI ticker
     */
    update(deltaTime) {
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
    processQueue() {
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
    executeTween(tween) {
        if (!tween.target || tween.target.destroyed) {
            return;
        }

        // Kill existing tween for this target
        this.killTween(tween.id);

        // Calculate dynamic duration based on distance
        const distance = this.calculateDistance(tween.from, tween.to);
        const dynamicDuration = Math.min(
            tween.config.duration || this.defaultConfig.duration,
            distance / tween.config.maxCatchUpSpeed
        );

        // Create GSAP timeline
        const timeline = gsap.timeline({
            onComplete: () => {
                tween.config.onComplete();
                this.activeTweens.delete(tween.id);
            },
            onUpdate: () => {
                const progress = timeline.progress();
                tween.config.onUpdate(progress);
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
            console.log(`Started tween ${tween.id} with duration ${dynamicDuration * 1000}ms`);
        }
    }

    /**
     * Tween a display object to new position/properties
     */
    tweenTo(target, to, config = {}, id = null) {
        if (!target || target.destroyed) {
            console.warn('Cannot tween destroyed or null target');
            return '';
        }

        const tweenId = id || `tween_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Capture current state
        const from = {};
        for (const key in to) {
            from[key] = target[key] || 0;
        }

        // Create tween animation
        const tween = {
            id: tweenId,
            target,
            from,
            to,
            config: { ...this.defaultConfig, ...config },
            timeline: null,
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
    tweenUnitPosition(unitSprite, newX, newY, unitId, config = {}) {
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
    tweenTilePlacement(tileSprite, config = {}) {
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
    tweenResourceUpdate(resourceElement, newValue, config = {}) {
        return this.tweenTo(
            resourceElement,
            { alpha: 1 },
            {
                duration: 0.15,
                ease: 'power2.out',
                priority: 0,
                onUpdate: (progress) => {
                    // Custom resource counter animation logic can go here
                    if (config.onUpdate) {
                        config.onUpdate(progress);
                    }
                },
                ...config
            },
            `resource_${Date.now()}_update`
        );
    }

    /**
     * Tween health bar updates
     */
    tweenHealthBar(healthBar, newHealth, maxHealth, config = {}) {
        const healthPercent = Math.max(0, Math.min(1, newHealth / maxHealth));
        
        return this.tweenTo(
            healthBar,
            { 
                width: healthPercent * 100, // Assuming 100px max width
                alpha: healthPercent > 0 ? 1 : 0
            },
            {
                duration: 0.2,
                ease: 'power2.out',
                priority: 1,
                ...config
            },
            `health_${Date.now()}_update`
        );
    }

    /**
     * Tween UI panel animations
     */
    tweenPanelIn(panel, config = {}) {
        // Start from off-screen
        panel.alpha = 0;
        panel.scale.set(0.8);
        
        return this.tweenTo(
            panel,
            { 
                alpha: 1,
                'scale.x': 1,
                'scale.y': 1
            },
            {
                duration: 0.3,
                ease: 'back.out(1.7)',
                priority: 2,
                ...config
            },
            `panel_${Date.now()}_in`
        );
    }

    /**
     * Tween UI panel out
     */
    tweenPanelOut(panel, config = {}) {
        return this.tweenTo(
            panel,
            { 
                alpha: 0,
                'scale.x': 0.8,
                'scale.y': 0.8
            },
            {
                duration: 0.2,
                ease: 'power2.in',
                priority: 2,
                ...config
            },
            `panel_${Date.now()}_out`
        );
    }

    /**
     * Kill a specific tween
     */
    killTween(tweenId) {
        const tween = this.activeTweens.get(tweenId);
        if (tween && tween.timeline) {
            tween.timeline.kill();
            this.activeTweens.delete(tweenId);
        }

        // Remove from queue if present
        this.tweenQueue = this.tweenQueue.filter(t => t.id !== tweenId);
    }

    /**
     * Kill all tweens for a specific target
     */
    killTweensForTarget(target) {
        const toKill = [];
        
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
    killAllTweens() {
        for (const [id, tween] of this.activeTweens) {
            if (tween.timeline) {
                tween.timeline.kill();
            }
        }
        this.activeTweens.clear();
        this.tweenQueue = [];
    }

    /**
     * Enable or disable the tween system
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        if (!enabled) {
            this.killAllTweens();
        }
    }

    /**
     * Toggle debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        if (enabled) {
            console.log('TweenSystem debug mode enabled');
        }
    }

    /**
     * Get current debug stats
     */
    getDebugStats() {
        return { ...this.debugStats };
    }

    /**
     * Configure default tween settings
     */
    configure(config) {
        this.defaultConfig = { ...this.defaultConfig, ...config };
    }

    /**
     * Check if a tween is active
     */
    isTweenActive(tweenId) {
        return this.activeTweens.has(tweenId);
    }

    /**
     * Get the progress of a specific tween (0-1)
     */
    getTweenProgress(tweenId) {
        const tween = this.activeTweens.get(tweenId);
        return tween && tween.timeline ? tween.timeline.progress() : 0;
    }

    /**
     * Calculate distance between two points
     */
    calculateDistance(from, to) {
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
    cleanupCompleted() {
        const toRemove = [];
        
        for (const [id, tween] of this.activeTweens) {
            if (!tween.isActive || (tween.timeline && tween.timeline.progress() >= 1)) {
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
    updateAverageDuration(duration) {
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
    destroy() {
        this.killAllTweens();
        this.app.ticker.remove(this.update.bind(this));
        console.log('TweenSystem destroyed');
    }
} 