/**
 * AuraOverlay - PixiJS component for displaying watchtower auras
 */
class AuraOverlay {
    constructor(position, radius = 2, color = 0x0088FF, intensity = 0.3) {
        this.position = position;
        this.radius = radius;
        this.color = color;
        this.intensity = intensity;
        this.container = new PIXI.Container();
        
        // Animation properties
        this.animationTime = 0;
        this.pulseSpeed = 0.02;
        this.fadeSpeed = 0.05;
        this.currentAlpha = 0;
        this.targetAlpha = intensity;
        
        this.createAura();
        this.updatePosition();
    }
    
    createAura() {
        // Create circular aura graphic
        this.aura = new PIXI.Graphics();
        
        // Set blend mode to add for glowing effect
        this.aura.blendMode = PIXI.BLEND_MODES.ADD;
        
        this.drawAura();
        this.container.addChild(this.aura);
    }
    
    drawAura() {
        this.aura.clear();
        
        // Create gradient-like effect with multiple circles
        const tileSize = 32;
        const pixelRadius = this.radius * tileSize;
        
        // Outer glow (larger, more transparent)
        this.aura.beginFill(this.color, 0.1);
        this.aura.drawCircle(0, 0, pixelRadius + 10);
        this.aura.endFill();
        
        // Middle glow
        this.aura.beginFill(this.color, 0.2);
        this.aura.drawCircle(0, 0, pixelRadius);
        this.aura.endFill();
        
        // Inner glow (smaller, more opaque)
        this.aura.beginFill(this.color, 0.3);
        this.aura.drawCircle(0, 0, pixelRadius - 5);
        this.aura.endFill();
        
        // Center highlight
        this.aura.beginFill(this.color, 0.4);
        this.aura.drawCircle(0, 0, pixelRadius - 15);
        this.aura.endFill();
    }
    
    updatePosition() {
        // Center the aura on the tile
        this.container.position.set(
            this.position.x * 32 + 16, // Center on tile
            this.position.y * 32 + 16
        );
    }
    
    // Animate the aura with pulsing effect
    animate() {
        this.animationTime += this.pulseSpeed;
        
        // Pulse effect
        const pulse = Math.sin(this.animationTime) * 0.1 + 1;
        this.container.scale.set(pulse);
        
        // Fade in/out animation
        if (this.currentAlpha < this.targetAlpha) {
            this.currentAlpha = Math.min(this.targetAlpha, this.currentAlpha + this.fadeSpeed);
        } else if (this.currentAlpha > this.targetAlpha) {
            this.currentAlpha = Math.max(this.targetAlpha, this.currentAlpha - this.fadeSpeed);
        }
        
        this.container.alpha = this.currentAlpha;
    }
    
    // Show the aura with fade-in animation
    show() {
        this.targetAlpha = this.intensity;
        this.container.visible = true;
    }
    
    // Hide the aura with fade-out animation
    hide() {
        this.targetAlpha = 0;
        
        // Hide completely after fade out
        setTimeout(() => {
            if (this.targetAlpha === 0) {
                this.container.visible = false;
            }
        }, 1000);
    }
    
    // Set new position
    setPosition(position) {
        this.position = position;
        this.updatePosition();
    }
    
    // Set radius
    setRadius(radius) {
        this.radius = radius;
        this.drawAura();
    }
    
    // Set color
    setColor(color) {
        this.color = color;
        this.drawAura();
    }
    
    // Set intensity (alpha)
    setIntensity(intensity) {
        this.intensity = intensity;
        this.targetAlpha = intensity;
    }
    
    // Check if position is within aura range
    isInRange(position) {
        const dx = position.x - this.position.x;
        const dy = position.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= this.radius;
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
window.AuraOverlay = AuraOverlay; 