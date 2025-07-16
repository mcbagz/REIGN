// JavaScript Debug Overlay - PixiJS container showing latency, FPS, tick drift, and connection metrics
class DebugOverlay {
    constructor(pixiApp, latencyMonitor, config = {}) {
        this.app = pixiApp;
        this.latencyMonitor = latencyMonitor;
        
        this.config = {
            position: 'top-left',
            graphWidth: 200,
            graphHeight: 60,
            maxPingDisplay: 500,
            updateInterval: 100,
            backgroundColor: 0x000000,
            textColor: 0xFFFFFF,
            graphLineColor: 0x00FF00,
            graphGridColor: 0x333333,
            ...config
        };
        
        this.container = null;
        this.background = null;
        this.textContainer = null;
        this.graphContainer = null;
        
        // Text elements
        this.pingText = null;
        this.fpsText = null;
        this.tickText = null;
        this.metricsText = null;
        this.statusText = null;
        
        // Graph elements
        this.graphBackground = null;
        this.graphGrid = null;
        this.graphLine = null;
        this.graphPoints = null;
        
        // State
        this.isVisible = false;
        this.updateInterval = null;
        this.fpsHistory = [];
        this.tickHistory = [];
        this.lastTickTime = 0;
        this.currentTick = 0;
        this.frameCount = 0;
        this.fpsTimer = Date.now();
        this.currentFPS = 0;
        
        this.init();
    }

    init() {
        this.createContainer();
        this.createBackground();
        this.createTextElements();
        this.createGraphElements();
        this.setupEventListeners();
        this.updateLayout();
        
        console.log('DebugOverlay initialized');
    }

    createContainer() {
        this.container = new PIXI.Container();
        this.container.visible = false;
        this.app.stage.addChild(this.container);
    }

    createBackground() {
        this.background = new PIXI.Graphics();
        this.background.beginFill(this.config.backgroundColor, 0.8);
        this.background.drawRoundedRect(0, 0, 220, 200, 5);
        this.background.endFill();
        this.container.addChild(this.background);
    }

    createTextElements() {
        this.textContainer = new PIXI.Container();
        this.textContainer.x = 10;
        this.textContainer.y = 10;
        this.container.addChild(this.textContainer);

        const textStyle = new PIXI.TextStyle({
            fontFamily: 'Courier, monospace',
            fontSize: 12,
            fill: this.config.textColor,
            align: 'left'
        });

        this.pingText = new PIXI.Text('Ping: 0ms', textStyle);
        this.pingText.y = 0;
        this.textContainer.addChild(this.pingText);

        this.fpsText = new PIXI.Text('FPS: 0', textStyle);
        this.fpsText.y = 15;
        this.textContainer.addChild(this.fpsText);

        this.tickText = new PIXI.Text('Tick: 0 (0ms)', textStyle);
        this.tickText.y = 30;
        this.textContainer.addChild(this.tickText);

        this.metricsText = new PIXI.Text('Loss: 0% Jitter: 0ms', textStyle);
        this.metricsText.y = 45;
        this.textContainer.addChild(this.metricsText);

        this.statusText = new PIXI.Text('Status: Disconnected', textStyle);
        this.statusText.y = 60;
        this.textContainer.addChild(this.statusText);
    }

    createGraphElements() {
        this.graphContainer = new PIXI.Container();
        this.graphContainer.x = 10;
        this.graphContainer.y = 85;
        this.container.addChild(this.graphContainer);

        // Graph background
        this.graphBackground = new PIXI.Graphics();
        this.graphBackground.beginFill(0x111111, 0.8);
        this.graphBackground.drawRect(0, 0, this.config.graphWidth, this.config.graphHeight);
        this.graphBackground.endFill();
        this.graphContainer.addChild(this.graphBackground);

        // Graph grid
        this.graphGrid = new PIXI.Graphics();
        this.drawGrid();
        this.graphContainer.addChild(this.graphGrid);

        // Graph line
        this.graphLine = new PIXI.Graphics();
        this.graphContainer.addChild(this.graphLine);

        // Graph points
        this.graphPoints = new PIXI.Graphics();
        this.graphContainer.addChild(this.graphPoints);
    }

    drawGrid() {
        this.graphGrid.clear();
        this.graphGrid.lineStyle(1, this.config.graphGridColor, 0.5);
        
        // Vertical lines
        for (let i = 0; i <= this.config.graphWidth; i += 40) {
            this.graphGrid.moveTo(i, 0);
            this.graphGrid.lineTo(i, this.config.graphHeight);
        }
        
        // Horizontal lines
        for (let i = 0; i <= this.config.graphHeight; i += 20) {
            this.graphGrid.moveTo(0, i);
            this.graphGrid.lineTo(this.config.graphWidth, i);
        }
    }

    setupEventListeners() {
        // Listen for latency updates
        this.latencyMonitor.on('ping', (result) => {
            this.updateGraph();
        });

        // Listen for application updates for FPS calculation
        this.app.ticker.add(this.updateFPS.bind(this));

        // Listen for window resize
        window.addEventListener('resize', () => {
            this.updateLayout();
        });
    }

    updateFPS() {
        this.frameCount++;
        
        const now = Date.now();
        if (now - this.fpsTimer >= 1000) {
            this.currentFPS = this.frameCount;
            this.frameCount = 0;
            this.fpsTimer = now;
            
            // Update FPS history
            this.fpsHistory.push(this.currentFPS);
            if (this.fpsHistory.length > 60) {
                this.fpsHistory.shift();
            }
        }
    }

    updateLayout() {
        const padding = 10;
        
        switch (this.config.position) {
            case 'top-left':
                this.container.x = padding;
                this.container.y = padding;
                break;
            case 'top-right':
                this.container.x = this.app.screen.width - this.container.width - padding;
                this.container.y = padding;
                break;
            case 'bottom-left':
                this.container.x = padding;
                this.container.y = this.app.screen.height - this.container.height - padding;
                break;
            case 'bottom-right':
                this.container.x = this.app.screen.width - this.container.width - padding;
                this.container.y = this.app.screen.height - this.container.height - padding;
                break;
        }
    }

    updateGraph() {
        const pings = this.latencyMonitor.getRecentPings(20);
        if (pings.length === 0) return;

        this.graphLine.clear();
        this.graphPoints.clear();

        // Draw line
        this.graphLine.lineStyle(2, this.config.graphLineColor, 1);
        
        let firstPoint = true;
        for (let i = 0; i < pings.length; i++) {
            const ping = pings[i];
            if (!ping.success) continue;

            const x = (i / (pings.length - 1)) * this.config.graphWidth;
            const y = this.config.graphHeight - (ping.ping / this.config.maxPingDisplay) * this.config.graphHeight;
            
            if (firstPoint) {
                this.graphLine.moveTo(x, y);
                firstPoint = false;
            } else {
                this.graphLine.lineTo(x, y);
            }
        }

        // Draw points
        for (let i = 0; i < pings.length; i++) {
            const ping = pings[i];
            const x = (i / (pings.length - 1)) * this.config.graphWidth;
            const y = this.config.graphHeight - (ping.ping / this.config.maxPingDisplay) * this.config.graphHeight;
            
            // Color based on ping quality
            let color = 0x00FF00; // Green for good
            if (ping.ping > 100) color = 0xFFFF00; // Yellow for OK
            if (ping.ping > 200) color = 0xFF0000; // Red for bad
            if (!ping.success) color = 0x666666; // Gray for failed
            
            this.graphPoints.beginFill(color);
            this.graphPoints.drawCircle(x, y, 2);
            this.graphPoints.endFill();
        }
    }

    updateTexts() {
        const metrics = this.latencyMonitor.getMetrics();
        const status = this.latencyMonitor.getConnectionStatus();
        
        // Update ping text
        this.pingText.text = `Ping: ${metrics.ping}ms (${metrics.averagePing}ms avg)`;
        
        // Update FPS text
        this.fpsText.text = `FPS: ${this.currentFPS}`;
        
        // Update tick text
        const tickDrift = this.calculateTickDrift();
        this.tickText.text = `Tick: ${this.currentTick} (${tickDrift}ms drift)`;
        
        // Update metrics text
        this.metricsText.text = `Loss: ${metrics.packetLoss}% Jitter: ${metrics.jitter}ms`;
        
        // Update status text with color
        let statusColor = 0x00FF00;
        switch (status) {
            case 'excellent': statusColor = 0x00FF00; break;
            case 'good': statusColor = 0x88FF00; break;
            case 'fair': statusColor = 0xFFFF00; break;
            case 'poor': statusColor = 0xFF8800; break;
            case 'disconnected': statusColor = 0xFF0000; break;
        }
        
        this.statusText.text = `Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`;
        this.statusText.style.fill = statusColor;
    }

    calculateTickDrift() {
        const now = Date.now();
        const expectedTickInterval = 1000 / 60; // 60 FPS
        const actualDrift = this.lastTickTime > 0 ? now - this.lastTickTime - expectedTickInterval : 0;
        return Math.round(actualDrift);
    }

    updateTick(tick) {
        this.currentTick = tick;
        this.lastTickTime = Date.now();
        
        // Update tick history
        const drift = this.calculateTickDrift();
        this.tickHistory.push(Math.abs(drift));
        if (this.tickHistory.length > 60) {
            this.tickHistory.shift();
        }
    }

    start() {
        if (this.updateInterval) return;
        
        this.updateInterval = setInterval(() => {
            if (this.isVisible) {
                this.updateTexts();
                this.updateGraph();
            }
        }, this.config.updateInterval);
        
        console.log('DebugOverlay started');
    }

    stop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        console.log('DebugOverlay stopped');
    }

    show() {
        this.isVisible = true;
        this.container.visible = true;
        this.updateLayout();
        this.start();
        console.log('DebugOverlay shown');
    }

    hide() {
        this.isVisible = false;
        this.container.visible = false;
        this.stop();
        console.log('DebugOverlay hidden');
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    isOverlayVisible() {
        return this.isVisible;
    }

    updateConfig(config) {
        this.config = { ...this.config, ...config };
        this.updateLayout();
        this.drawGrid();
    }

    setPosition(position) {
        this.config.position = position;
        this.updateLayout();
    }

    getPerformanceStats() {
        const averageFPS = this.fpsHistory.length > 0 
            ? this.fpsHistory.reduce((sum, fps) => sum + fps, 0) / this.fpsHistory.length 
            : 0;
        
        const averageTickDrift = this.tickHistory.length > 0
            ? this.tickHistory.reduce((sum, drift) => sum + drift, 0) / this.tickHistory.length
            : 0;
        
        return {
            fps: this.currentFPS,
            averageFPS: Math.round(averageFPS),
            tickDrift: this.calculateTickDrift(),
            averageTickDrift: Math.round(averageTickDrift)
        };
    }

    resetStats() {
        this.fpsHistory = [];
        this.tickHistory = [];
        this.frameCount = 0;
        this.fpsTimer = Date.now();
        this.currentFPS = 0;
        this.lastTickTime = 0;
        this.currentTick = 0;
    }

    destroy() {
        this.stop();
        
        if (this.container) {
            this.app.stage.removeChild(this.container);
            this.container.destroy();
        }
        
        this.app.ticker.remove(this.updateFPS.bind(this));
        window.removeEventListener('resize', () => this.updateLayout());
        
        console.log('DebugOverlay destroyed');
    }
} 