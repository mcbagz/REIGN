// Main application entry point
class GameApp {
    constructor() {
        this.currentScreen = 'loading';
        this.game = null;
        this.uiManager = null;
        this.initialized = false;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.showScreen = this.showScreen.bind(this);
        this.onSinglePlayerClick = this.onSinglePlayerClick.bind(this);
        this.onMultiplayerClick = this.onMultiplayerClick.bind(this);
        this.onSettingsClick = this.onSettingsClick.bind(this);
    }
    
    async init() {
        console.log('Initializing Carcassonne: War of Ages...');
        
        try {
            // Initialize UI Manager
            this.uiManager = new UIManager();
            this.uiManager.init();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Simulate loading time
            await this.simulateLoading();
            
            // Show main menu
            this.showScreen('main-menu');
            
            this.initialized = true;
            console.log('Game initialized successfully!');
            
        } catch (error) {
            console.error('Failed to initialize game:', error);
            this.showError('Failed to initialize game. Please refresh the page.');
        }
    }
    
    setupEventListeners() {
        // Menu buttons
        const singlePlayerBtn = document.getElementById('single-player-btn');
        const multiplayerBtn = document.getElementById('multiplayer-btn');
        const settingsBtn = document.getElementById('settings-btn');
        
        if (singlePlayerBtn) {
            singlePlayerBtn.addEventListener('click', this.onSinglePlayerClick);
        }
        if (multiplayerBtn) {
            multiplayerBtn.addEventListener('click', this.onMultiplayerClick);
        }
        if (settingsBtn) {
            settingsBtn.addEventListener('click', this.onSettingsClick);
        }
        
        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.handleEscape();
            }
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.game) {
                this.game.handleResize();
            }
        });
        
        // Handle beforeunload
        window.addEventListener('beforeunload', () => {
            if (this.game) {
                this.game.cleanup();
            }
        });
    }
    
    async simulateLoading() {
        const loadingText = document.querySelector('#loading-screen p');
        const messages = [
            'Loading game assets...',
            'Initializing game engine...',
            'Preparing medieval world...',
            'Summoning followers...',
            'Ready to conquer!'
        ];
        
        for (let i = 0; i < messages.length; i++) {
            if (loadingText) {
                loadingText.textContent = messages[i];
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    showScreen(screenName) {
        // Hide all screens
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => {
            screen.classList.add('hidden');
        });
        
        // Show target screen
        const targetScreen = document.getElementById(screenName);
        if (targetScreen) {
            targetScreen.classList.remove('hidden');
            this.currentScreen = screenName;
        }
    }
    
    async onSinglePlayerClick() {
        try {
            this.uiManager.showNotification('Starting single player game...', 'info');
            
            // Initialize game in single player mode
            this.game = new Game({
                mode: 'single-player',
                playerCount: 1,
                aiOpponents: 3
            });
            
            await this.game.init();
            this.showScreen('game-screen');
            
        } catch (error) {
            console.error('Failed to start single player game:', error);
            this.uiManager.showNotification('Failed to start game', 'error');
        }
    }
    
    async onMultiplayerClick() {
        try {
            this.uiManager.showNotification('Connecting to multiplayer...', 'info');
            
            // Initialize game in multiplayer mode
            this.game = new Game({
                mode: 'multiplayer',
                playerCount: 4,
                aiOpponents: 0
            });
            
            await this.game.init();
            this.showScreen('game-screen');
            
        } catch (error) {
            console.error('Failed to start multiplayer game:', error);
            this.uiManager.showNotification('Failed to connect to multiplayer', 'error');
        }
    }
    
    onSettingsClick() {
        this.uiManager.showNotification('Settings coming soon!', 'info');
    }
    
    handleEscape() {
        if (this.currentScreen === 'game-screen') {
            if (this.game) {
                this.game.pause();
            }
            this.showScreen('main-menu');
        }
    }
    
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #e74c3c;
            color: white;
            padding: 2rem;
            border-radius: 8px;
            z-index: 9999;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;
        errorDiv.innerHTML = `
            <h3>Error</h3>
            <p>${message}</p>
            <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: white; color: #e74c3c; border: none; border-radius: 4px; cursor: pointer;">
                Reload Page
            </button>
        `;
        document.body.appendChild(errorDiv);
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new GameApp();
    app.init();
});

// Make app available globally for debugging
window.GameApp = GameApp; 