/**
 * CapitalHpBar - PixiJS component for displaying capital HP bars
 */
class CapitalHpBar {
    constructor(position, maxHp = 1000, currentHp = 1000) {
        this.position = position;
        this.maxHp = maxHp;
        this.currentHp = currentHp;
        this.container = new PIXI.Container();
        
        // Bar dimensions
        this.barWidth = 60;
        this.barHeight = 8;
        this.barOffsetY = -30; // Position above the tile
        
        this.createElements();
        this.updatePosition();
    }
    
    createElements() {
        // Background bar (dark gray)
        this.background = new PIXI.Graphics();
        this.background.beginFill(0x333333);
        this.background.drawRect(0, 0, this.barWidth, this.barHeight);
        this.background.endFill();
        
        // HP bar (red to green based on HP)
        this.hpBar = new PIXI.Graphics();
        
        // HP text
        this.hpText = new PIXI.Text('', {
            fontSize: 10,
            fill: 0xFFFFFF,
            fontFamily: 'Arial',
            align: 'center'
        });
        this.hpText.anchor.set(0.5, 0.5);
        this.hpText.position.set(this.barWidth / 2, this.barHeight / 2);
        
        // Add all elements to container
        this.container.addChild(this.background);
        this.container.addChild(this.hpBar);
        this.container.addChild(this.hpText);
        
        this.updateBar();
    }
    
    updatePosition() {
        // Position the HP bar above the tile
        this.container.position.set(
            this.position.x * 32 - this.barWidth / 2 + 16, // Center on tile
            this.position.y * 32 + this.barOffsetY
        );
    }
    
    updateBar() {
        // Calculate HP percentage
        const hpPercentage = Math.max(0, this.currentHp / this.maxHp);
        
        // Clear and redraw HP bar
        this.hpBar.clear();
        
        // Color based on HP percentage
        let barColor;
        if (hpPercentage > 0.6) {
            barColor = 0x00FF00; // Green
        } else if (hpPercentage > 0.3) {
            barColor = 0xFFFF00; // Yellow
        } else {
            barColor = 0xFF0000; // Red
        }
        
        this.hpBar.beginFill(barColor);
        this.hpBar.drawRect(0, 0, this.barWidth * hpPercentage, this.barHeight);
        this.hpBar.endFill();
        
        // Update text
        this.hpText.text = `${this.currentHp}/${this.maxHp}`;
    }
    
    setHp(currentHp) {
        this.currentHp = Math.max(0, currentHp);
        this.updateBar();
    }
    
    setMaxHp(maxHp) {
        this.maxHp = maxHp;
        this.updateBar();
    }
    
    setPosition(position) {
        this.position = position;
        this.updatePosition();
    }
    
    // Animate damage taken
    animateDamage(damage) {
        // Flash red and shake
        const originalTint = this.container.tint;
        this.container.tint = 0xFF0000;
        
        // Shake animation
        const originalX = this.container.x;
        const shakeIntensity = 3;
        
        let shakeCount = 0;
        const maxShakes = 6;
        
        const shakeInterval = setInterval(() => {
            this.container.x = originalX + (Math.random() - 0.5) * shakeIntensity;
            shakeCount++;
            
            if (shakeCount >= maxShakes) {
                clearInterval(shakeInterval);
                this.container.x = originalX;
                this.container.tint = originalTint;
            }
        }, 50);
    }
    
    // Show/hide the HP bar
    setVisible(visible) {
        this.container.visible = visible;
    }
    
    // Get the PIXI container for adding to scene
    getContainer() {
        return this.container;
    }
    
    // Cleanup
    destroy() {
        this.container.destroy();
    }
}

// Make it available globally
window.CapitalHpBar = CapitalHpBar; 