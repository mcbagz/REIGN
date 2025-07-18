/**
 * BannerLayer - PixiJS component for displaying elimination and victory banners
 */
class BannerLayer {
    constructor(screenWidth, screenHeight) {
        this.screenWidth = screenWidth;
        this.screenHeight = screenHeight;
        this.container = new PIXI.Container();
        this.banners = [];
        this.activeBanner = null;
        
        // Banner settings
        this.bannerHeight = 80;
        this.animationSpeed = 0.05;
        this.displayDuration = 4000; // 4 seconds
        
        this.setupLayer();
    }
    
    setupLayer() {
        // Make sure banner layer is always on top
        this.container.zIndex = 1000;
        
        // Create background overlay for banners
        this.overlay = new PIXI.Graphics();
        this.overlay.beginFill(0x000000, 0.5);
        this.overlay.drawRect(0, 0, this.screenWidth, this.screenHeight);
        this.overlay.endFill();
        this.overlay.visible = false;
        this.container.addChild(this.overlay);
    }
    
    // Show player elimination banner
    showPlayerEliminatedBanner(playerName, eliminatedBy) {
        const text = `${playerName} has been eliminated by ${eliminatedBy}!`;
        const backgroundColor = 0xFF4444; // Red background
        const textColor = 0xFFFFFF; // White text
        
        this.showBanner(text, backgroundColor, textColor);
    }
    
    // Show game victory banner
    showGameVictoryBanner(winnerName) {
        const text = `${winnerName} is victorious!`;
        const backgroundColor = 0x44FF44; // Green background
        const textColor = 0xFFFFFF; // White text
        
        this.showBanner(text, backgroundColor, textColor, true); // Victory banner stays longer
    }
    
    // Show generic banner
    showBanner(text, backgroundColor = 0x4444FF, textColor = 0xFFFFFF, isVictory = false) {
        // Clear any existing banner
        this.clearBanner();
        
        // Create banner container
        const bannerContainer = new PIXI.Container();
        
        // Create banner background
        const background = new PIXI.Graphics();
        background.beginFill(backgroundColor);
        background.drawRect(0, 0, this.screenWidth, this.bannerHeight);
        background.endFill();
        
        // Add border
        background.lineStyle(2, 0xFFFFFF, 1);
        background.drawRect(0, 0, this.screenWidth, this.bannerHeight);
        
        // Create banner text
        const bannerText = new PIXI.Text(text, {
            fontSize: 24,
            fill: textColor,
            fontFamily: 'Arial',
            fontWeight: 'bold',
            align: 'center'
        });
        bannerText.anchor.set(0.5, 0.5);
        bannerText.position.set(this.screenWidth / 2, this.bannerHeight / 2);
        
        // Add elements to banner
        bannerContainer.addChild(background);
        bannerContainer.addChild(bannerText);
        
        // Position banner (start off-screen at top)
        bannerContainer.position.set(0, -this.bannerHeight);
        
        // Add to container
        this.container.addChild(bannerContainer);
        this.activeBanner = bannerContainer;
        
        // Show overlay
        this.overlay.visible = true;
        
        // Animate banner sliding in
        this.animateBannerIn(bannerContainer, isVictory);
    }
    
    // Animate banner sliding in from top
    animateBannerIn(banner, isVictory = false) {
        const targetY = this.screenHeight / 2 - this.bannerHeight / 2;
        
        const slideIn = () => {
            const currentY = banner.position.y;
            const newY = currentY + (targetY - currentY) * this.animationSpeed;
            
            banner.position.y = newY;
            
            if (Math.abs(targetY - newY) > 1) {
                requestAnimationFrame(slideIn);
            } else {
                banner.position.y = targetY;
                
                // Start timer to slide out (victory banners stay longer)
                const duration = isVictory ? this.displayDuration * 2 : this.displayDuration;
                setTimeout(() => {
                    this.animateBannerOut(banner);
                }, duration);
            }
        };
        
        requestAnimationFrame(slideIn);
    }
    
    // Animate banner sliding out to top
    animateBannerOut(banner) {
        const targetY = -this.bannerHeight;
        
        const slideOut = () => {
            const currentY = banner.position.y;
            const newY = currentY + (targetY - currentY) * this.animationSpeed;
            
            banner.position.y = newY;
            
            if (Math.abs(targetY - newY) > 1) {
                requestAnimationFrame(slideOut);
            } else {
                banner.position.y = targetY;
                
                // Clean up
                this.container.removeChild(banner);
                banner.destroy();
                this.activeBanner = null;
                this.overlay.visible = false;
            }
        };
        
        requestAnimationFrame(slideOut);
    }
    
    // Clear any active banner
    clearBanner() {
        if (this.activeBanner) {
            this.container.removeChild(this.activeBanner);
            this.activeBanner.destroy();
            this.activeBanner = null;
            this.overlay.visible = false;
        }
    }
    
    // Update screen dimensions
    updateScreenSize(width, height) {
        this.screenWidth = width;
        this.screenHeight = height;
        
        // Update overlay
        this.overlay.clear();
        this.overlay.beginFill(0x000000, 0.5);
        this.overlay.drawRect(0, 0, width, height);
        this.overlay.endFill();
    }
    
    // Get the PIXI container for adding to scene
    getContainer() {
        return this.container;
    }
    
    // Cleanup
    destroy() {
        this.clearBanner();
        this.container.destroy();
    }
}

// Make it available globally
window.BannerLayer = BannerLayer; 