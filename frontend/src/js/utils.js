// Utility Functions
const Utils = {
    // Math utilities
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },
    
    lerp(start, end, t) {
        return start + (end - start) * t;
    },
    
    distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },
    
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    
    randomFloat(min, max) {
        return Math.random() * (max - min) + min;
    },
    
    // Grid utilities
    gridToPixel(gridX, gridY, tileSize = GameConfig.TILE_SIZE) {
        return {
            x: gridX * tileSize,
            y: gridY * tileSize
        };
    },
    
    pixelToGrid(pixelX, pixelY, tileSize = GameConfig.TILE_SIZE) {
        return {
            x: Math.floor(pixelX / tileSize),
            y: Math.floor(pixelY / tileSize)
        };
    },
    
    isValidGridPosition(x, y) {
        return x >= 0 && x < GameConfig.GRID_WIDTH && 
               y >= 0 && y < GameConfig.GRID_HEIGHT;
    },
    
    getGridKey(x, y) {
        return `${x},${y}`;
    },
    
    parseGridKey(key) {
        const [x, y] = key.split(',').map(Number);
        return { x, y };
    },
    
    // Array utilities
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    },
    
    getRandomElement(array) {
        return array[Math.floor(Math.random() * array.length)];
    },
    
    // Resource utilities
    canAffordCost(resources, cost) {
        return Object.entries(cost).every(([resource, amount]) => {
            return resources[resource] >= amount;
        });
    },
    
    subtractCost(resources, cost) {
        const newResources = { ...resources };
        Object.entries(cost).forEach(([resource, amount]) => {
            newResources[resource] -= amount;
        });
        return newResources;
    },
    
    addResources(resources, addition) {
        const newResources = { ...resources };
        Object.entries(addition).forEach(([resource, amount]) => {
            newResources[resource] = Math.min(
                newResources[resource] + amount,
                GameConfig.RESOURCE_CAP
            );
        });
        return newResources;
    },
    
    // Tile utilities
    getAdjacentPositions(x, y) {
        const adjacent = [];
        const directions = [
            { dx: -1, dy: 0 },  // Left
            { dx: 1, dy: 0 },   // Right
            { dx: 0, dy: -1 },  // Up
            { dx: 0, dy: 1 }    // Down
        ];
        
        directions.forEach(({ dx, dy }) => {
            const newX = x + dx;
            const newY = y + dy;
            if (this.isValidGridPosition(newX, newY)) {
                adjacent.push({ x: newX, y: newY });
            }
        });
        
        return adjacent;
    },
    
    getNeighborsInRadius(x, y, radius) {
        const neighbors = [];
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                if (dx === 0 && dy === 0) continue;
                if (Math.abs(dx) + Math.abs(dy) <= radius) {
                    const newX = x + dx;
                    const newY = y + dy;
                    if (this.isValidGridPosition(newX, newY)) {
                        neighbors.push({ x: newX, y: newY });
                    }
                }
            }
        }
        return neighbors;
    },
    
    // Pathfinding utilities (A* implementation)
    findPath(startX, startY, endX, endY, grid, isBlocked) {
        const openSet = [{ x: startX, y: startY, f: 0, g: 0, h: 0, parent: null }];
        const closedSet = new Set();
        const openMap = new Map();
        
        const heuristic = (x, y) => Math.abs(x - endX) + Math.abs(y - endY);
        
        openMap.set(this.getGridKey(startX, startY), openSet[0]);
        
        while (openSet.length > 0) {
            // Find node with lowest f score
            let current = openSet[0];
            let currentIndex = 0;
            
            for (let i = 1; i < openSet.length; i++) {
                if (openSet[i].f < current.f) {
                    current = openSet[i];
                    currentIndex = i;
                }
            }
            
            // Move current from open to closed
            openSet.splice(currentIndex, 1);
            openMap.delete(this.getGridKey(current.x, current.y));
            closedSet.add(this.getGridKey(current.x, current.y));
            
            // Check if we reached the goal
            if (current.x === endX && current.y === endY) {
                const path = [];
                let node = current;
                while (node) {
                    path.unshift({ x: node.x, y: node.y });
                    node = node.parent;
                }
                return path;
            }
            
            // Check neighbors
            const neighbors = this.getAdjacentPositions(current.x, current.y);
            
            for (const neighbor of neighbors) {
                const neighborKey = this.getGridKey(neighbor.x, neighbor.y);
                
                if (closedSet.has(neighborKey)) continue;
                if (isBlocked && isBlocked(neighbor.x, neighbor.y)) continue;
                
                const g = current.g + 1;
                const h = heuristic(neighbor.x, neighbor.y);
                const f = g + h;
                
                const existingNode = openMap.get(neighborKey);
                if (!existingNode || g < existingNode.g) {
                    const node = {
                        x: neighbor.x,
                        y: neighbor.y,
                        f, g, h,
                        parent: current
                    };
                    
                    if (existingNode) {
                        const index = openSet.indexOf(existingNode);
                        openSet[index] = node;
                    } else {
                        openSet.push(node);
                    }
                    
                    openMap.set(neighborKey, node);
                }
            }
        }
        
        return null; // No path found
    },
    
    // Color utilities
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },
    
    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    },
    
    // Time utilities
    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    },
    
    // Local storage utilities
    saveToLocalStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
            return false;
        }
    },
    
    loadFromLocalStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
            return defaultValue;
        }
    },
    
    removeFromLocalStorage(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Failed to remove from localStorage:', error);
            return false;
        }
    },
    
    // Debounce utility
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // Throttle utility
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    // Deep clone utility
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const cloned = {};
            Object.keys(obj).forEach(key => {
                cloned[key] = this.deepClone(obj[key]);
            });
            return cloned;
        }
    }
}; 