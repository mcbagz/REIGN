// State Diff/Patch Utility
// Creates JSON Patch operations to reconcile game state differences

// JSON Patch operation interface (RFC 6902)
export interface JsonPatchOperation {
    op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
    path: string;
    value?: any;
    from?: string; // For move/copy operations
}

// Configuration for diff generation
export interface DiffConfig {
    ignorePaths?: string[];
    precision?: number; // For floating point comparison
    maxDepth?: number;
    arrayStrategy?: 'replace' | 'merge';
}

// Default configuration
const DEFAULT_CONFIG: DiffConfig = {
    ignorePaths: [],
    precision: 6,
    maxDepth: 10,
    arrayStrategy: 'replace'
};

/**
 * Generate JSON Patch operations between two objects
 */
export function generateDiff(
    original: any,
    modified: any,
    config: DiffConfig = DEFAULT_CONFIG
): JsonPatchOperation[] {
    const patches: JsonPatchOperation[] = [];
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    
    generateDiffRecursive(original, modified, '', patches, mergedConfig, 0);
    
    return patches;
}

/**
 * Apply JSON Patch operations to an object
 */
export function applyPatch(target: any, patches: JsonPatchOperation[]): any {
    // Clone target to avoid mutation
    let result = deepClone(target);
    
    for (const patch of patches) {
        try {
            result = applyPatchOperation(result, patch);
        } catch (error) {
            console.error('Failed to apply patch operation:', patch, error);
            throw error;
        }
    }
    
    return result;
}

/**
 * Generate minimal patches for game state reconciliation
 */
export function generateGameStateDiff(
    localState: any,
    serverState: any
): JsonPatchOperation[] {
    const config: DiffConfig = {
        ignorePaths: [
            '/timestamp',
            '/clientData',
            '/localPredictions'
        ],
        precision: 3, // Less precision for position data
        arrayStrategy: 'replace' // Replace arrays entirely for units/tiles
    };
    
    return generateDiff(localState, serverState, config);
}

/**
 * Check if two values are equal considering precision
 */
function isEqual(a: any, b: any, precision: number = 6): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    
    const typeA = typeof a;
    const typeB = typeof b;
    
    if (typeA !== typeB) return false;
    
    if (typeA === 'number') {
        if (isNaN(a) && isNaN(b)) return true;
        if (isNaN(a) || isNaN(b)) return false;
        return Math.abs(a - b) < Math.pow(10, -precision);
    }
    
    if (typeA === 'object') {
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return false;
            for (let i = 0; i < a.length; i++) {
                if (!isEqual(a[i], b[i], precision)) return false;
            }
            return true;
        }
        
        if (Array.isArray(a) || Array.isArray(b)) return false;
        
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        
        if (keysA.length !== keysB.length) return false;
        
        for (const key of keysA) {
            if (!keysB.includes(key)) return false;
            if (!isEqual(a[key], b[key], precision)) return false;
        }
        
        return true;
    }
    
    return false;
}

/**
 * Recursive diff generation
 */
function generateDiffRecursive(
    original: any,
    modified: any,
    path: string,
    patches: JsonPatchOperation[],
    config: DiffConfig,
    depth: number
): void {
    // Check depth limit
    if (depth > (config.maxDepth || 10)) {
        return;
    }
    
    // Check if path should be ignored
    if (config.ignorePaths?.includes(path)) {
        return;
    }
    
    // Handle null/undefined cases
    if (original === null || original === undefined) {
        if (modified !== null && modified !== undefined) {
            patches.push({
                op: 'add',
                path,
                value: modified
            });
        }
        return;
    }
    
    if (modified === null || modified === undefined) {
        patches.push({
            op: 'remove',
            path
        });
        return;
    }
    
    // Handle primitive values
    if (typeof original !== 'object' || typeof modified !== 'object') {
        if (!isEqual(original, modified, config.precision)) {
            patches.push({
                op: 'replace',
                path,
                value: modified
            });
        }
        return;
    }
    
    // Handle arrays
    if (Array.isArray(original) && Array.isArray(modified)) {
        if (config.arrayStrategy === 'replace') {
            if (!isEqual(original, modified, config.precision)) {
                patches.push({
                    op: 'replace',
                    path,
                    value: modified
                });
            }
        } else {
            // Handle array merging (more complex)
            handleArrayDiff(original, modified, path, patches, config, depth);
        }
        return;
    }
    
    // Handle objects
    if (Array.isArray(original) || Array.isArray(modified)) {
        // Type mismatch - replace entirely
        patches.push({
            op: 'replace',
            path,
            value: modified
        });
        return;
    }
    
    // Compare object properties
    const allKeys = new Set([...Object.keys(original), ...Object.keys(modified)]);
    
    for (const key of allKeys) {
        const newPath = path ? `${path}/${escapeJsonPointer(key)}` : `/${escapeJsonPointer(key)}`;
        
        if (!(key in original)) {
            // Property added
            patches.push({
                op: 'add',
                path: newPath,
                value: modified[key]
            });
        } else if (!(key in modified)) {
            // Property removed
            patches.push({
                op: 'remove',
                path: newPath
            });
        } else {
            // Property potentially modified
            generateDiffRecursive(
                original[key],
                modified[key],
                newPath,
                patches,
                config,
                depth + 1
            );
        }
    }
}

/**
 * Handle array differences with merge strategy
 */
function handleArrayDiff(
    original: any[],
    modified: any[],
    path: string,
    patches: JsonPatchOperation[],
    config: DiffConfig,
    depth: number
): void {
    const maxLen = Math.max(original.length, modified.length);
    
    for (let i = 0; i < maxLen; i++) {
        const itemPath = `${path}/${i}`;
        
        if (i >= original.length) {
            // Item added
            patches.push({
                op: 'add',
                path: itemPath,
                value: modified[i]
            });
        } else if (i >= modified.length) {
            // Item removed (remove from end backwards)
            patches.push({
                op: 'remove',
                path: `${path}/${original.length - 1}`
            });
        } else {
            // Item potentially modified
            generateDiffRecursive(
                original[i],
                modified[i],
                itemPath,
                patches,
                config,
                depth + 1
            );
        }
    }
}

/**
 * Apply a single patch operation
 */
function applyPatchOperation(target: any, patch: JsonPatchOperation): any {
    const result = deepClone(target);
    const pathSegments = parseJsonPointer(patch.path);
    
    switch (patch.op) {
        case 'add':
            return addValue(result, pathSegments, patch.value);
        case 'remove':
            return removeValue(result, pathSegments);
        case 'replace':
            return replaceValue(result, pathSegments, patch.value);
        case 'move':
            if (!patch.from) throw new Error('Move operation requires from path');
            const fromSegments = parseJsonPointer(patch.from);
            const value = getValue(result, fromSegments);
            const withoutValue = removeValue(result, fromSegments);
            return addValue(withoutValue, pathSegments, value);
        case 'copy':
            if (!patch.from) throw new Error('Copy operation requires from path');
            const copyFromSegments = parseJsonPointer(patch.from);
            const copyValue = getValue(result, copyFromSegments);
            return addValue(result, pathSegments, copyValue);
        case 'test':
            const testValue = getValue(result, pathSegments);
            if (!isEqual(testValue, patch.value)) {
                throw new Error(`Test operation failed at path ${patch.path}`);
            }
            return result;
        default:
            throw new Error(`Unknown patch operation: ${patch.op}`);
    }
}

/**
 * Get value at path segments
 */
function getValue(obj: any, pathSegments: string[]): any {
    let current = obj;
    for (const segment of pathSegments) {
        if (current == null) return undefined;
        current = current[segment];
    }
    return current;
}

/**
 * Add value at path segments
 */
function addValue(obj: any, pathSegments: string[], value: any): any {
    if (pathSegments.length === 0) return value;
    
    const result = deepClone(obj);
    let current = result;
    
    for (let i = 0; i < pathSegments.length - 1; i++) {
        const segment = pathSegments[i];
        if (current[segment] == null) {
            current[segment] = {};
        }
        current = current[segment];
    }
    
    const lastSegment = pathSegments[pathSegments.length - 1];
    current[lastSegment] = value;
    
    return result;
}

/**
 * Remove value at path segments
 */
function removeValue(obj: any, pathSegments: string[]): any {
    if (pathSegments.length === 0) return undefined;
    
    const result = deepClone(obj);
    let current = result;
    
    for (let i = 0; i < pathSegments.length - 1; i++) {
        const segment = pathSegments[i];
        if (current[segment] == null) return result;
        current = current[segment];
    }
    
    const lastSegment = pathSegments[pathSegments.length - 1];
    if (Array.isArray(current)) {
        current.splice(parseInt(lastSegment), 1);
    } else {
        delete current[lastSegment];
    }
    
    return result;
}

/**
 * Replace value at path segments
 */
function replaceValue(obj: any, pathSegments: string[], value: any): any {
    if (pathSegments.length === 0) return value;
    
    const result = deepClone(obj);
    let current = result;
    
    for (let i = 0; i < pathSegments.length - 1; i++) {
        const segment = pathSegments[i];
        if (current[segment] == null) {
            current[segment] = {};
        }
        current = current[segment];
    }
    
    const lastSegment = pathSegments[pathSegments.length - 1];
    current[lastSegment] = value;
    
    return result;
}

/**
 * Parse JSON Pointer path into segments
 */
function parseJsonPointer(path: string): string[] {
    if (path === '') return [];
    if (!path.startsWith('/')) {
        throw new Error('Invalid JSON Pointer: must start with /');
    }
    
    return path.slice(1).split('/').map(unescapeJsonPointer);
}

/**
 * Escape JSON Pointer segment
 */
function escapeJsonPointer(segment: string): string {
    return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

/**
 * Unescape JSON Pointer segment
 */
function unescapeJsonPointer(segment: string): string {
    return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

/**
 * Deep clone object
 */
function deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map(deepClone);
    
    const cloned: any = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    
    return cloned;
}

// Utility functions for game state reconciliation
export const GameStateDiffUtils = {
    /**
     * Calculate difference threshold for considering states divergent
     */
    calculateDivergenceScore(patches: JsonPatchOperation[]): number {
        let score = 0;
        for (const patch of patches) {
            switch (patch.op) {
                case 'add':
                case 'remove':
                    score += 2;
                    break;
                case 'replace':
                    score += 1;
                    break;
                case 'move':
                    score += 0.5;
                    break;
            }
        }
        return score;
    },
    
    /**
     * Check if patches represent critical changes that require immediate reconciliation
     */
    hasCriticalChanges(patches: JsonPatchOperation[]): boolean {
        const criticalPaths = [
            '/players',
            '/currentPlayer',
            '/gamePhase',
            '/grid',
            '/units',
            '/tick'
        ];
        
        return patches.some(patch => 
            criticalPaths.some(path => patch.path.startsWith(path))
        );
    },
    
    /**
     * Filter patches to only include those affecting specific subsystems
     */
    filterPatchesBySubsystem(patches: JsonPatchOperation[], subsystem: string): JsonPatchOperation[] {
        const subsystemPaths: Record<string, string[]> = {
            'units': ['/units', '/combat'],
            'tiles': ['/grid', '/tiles'],
            'resources': ['/resources', '/economy'],
            'ui': ['/ui', '/interface']
        };
        
        const paths = subsystemPaths[subsystem] || [];
        return patches.filter(patch => 
            paths.some(path => patch.path.startsWith(path))
        );
    }
}; 