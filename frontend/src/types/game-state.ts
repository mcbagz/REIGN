// To parse this data:
//
//   import { Convert, GameState } from "./file";
//
//   const gameState = Convert.toGameState(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

/**
 * Complete game state for Carcassonne: War of Ages
 */
export interface GameState {
    /**
     * Remaining tiles in the deck
     */
    availableTiles: AvailableTile[];
    /**
     * ID of the player whose turn it is
     */
    currentPlayer: number;
    /**
     * Three tile options for current player, null if not current player's turn
     */
    currentTileOptions?: TypeElement[] | null;
    /**
     * Recent game events for replay/logging
     */
    events?: Event[];
    /**
     * Unique identifier for the game session
     */
    gameId: string;
    /**
     * Game configuration settings
     */
    gameSettings?: GameSettings;
    /**
     * Timestamp when game started
     */
    gameStartTime: number;
    /**
     * Timestamp of last state update
     */
    lastUpdate: number;
    /**
     * Array of players in the game
     */
    players: Player[];
    /**
     * Current game status
     */
    status: Status;
    /**
     * Array of all tiles placed on the board
     */
    tiles: { [key: string]: any }[];
    /**
     * Current turn number
     */
    turnNumber: number;
    /**
     * Time remaining for current turn in seconds
     */
    turnTimeRemaining: number;
    /**
     * Array of all units on the board
     */
    units: { [key: string]: any }[];
    /**
     * ID of winning player, null if game not finished
     */
    winner?: number | null;
}

export interface AvailableTile {
    count: number;
    type:  TypeElement;
}

export enum TypeElement {
    Barracks = "barracks",
    CapitalCity = "capital_city",
    City = "city",
    Field = "field",
    Marsh = "marsh",
    Mine = "mine",
    Monastery = "monastery",
    Orchard = "orchard",
    Watchtower = "watchtower",
}

export interface Event {
    /**
     * Event-specific data
     */
    data: { [key: string]: any };
    /**
     * Unique event identifier
     */
    id: string;
    /**
     * ID of player who triggered the event
     */
    playerId?: number | null;
    /**
     * When the event occurred
     */
    timestamp: number;
    /**
     * Type of event
     */
    type: EventType;
}

/**
 * Type of event
 */
export enum EventType {
    GameEnded = "game_ended",
    GameStarted = "game_started",
    PlayerEliminated = "player_eliminated",
    TileDestroyed = "tile_destroyed",
    TilePlaced = "tile_placed",
    TurnChanged = "turn_changed",
    UnitAttacked = "unit_attacked",
    UnitCreated = "unit_created",
    UnitKilled = "unit_killed",
    UnitMoved = "unit_moved",
}

/**
 * Game configuration settings
 */
export interface GameSettings {
    /**
     * Size of the square map
     */
    mapSize?: number;
    /**
     * Maximum game duration in seconds
     */
    maxGameDuration?: number;
    /**
     * How often resources are updated in seconds
     */
    resourceUpdateInterval?: number;
    /**
     * Turn duration in seconds
     */
    turnDuration?: number;
}

export interface Player {
    /**
     * Position of capital city, null if eliminated
     */
    capitalCity: CapitalCity | null;
    /**
     * Player color (hex code)
     */
    color: string;
    /**
     * Player ID
     */
    id: number;
    /**
     * Whether player is currently connected
     */
    isConnected: boolean;
    /**
     * Whether player has been eliminated
     */
    isEliminated: boolean;
    /**
     * Player name
     */
    name: string;
    /**
     * Current resources
     */
    resources: Resources;
    /**
     * Player statistics
     */
    stats?: Stats;
    /**
     * Current technology level
     */
    techLevel: TechLevel;
}

export interface CapitalCity {
    x: number;
    y: number;
}

/**
 * Current resources
 */
export interface Resources {
    faith: number;
    food:  number;
    gold:  number;
}

/**
 * Player statistics
 */
export interface Stats {
    tilesDestroyed?: number;
    tilesPlaced?:    number;
    unitsCreated?:   number;
    unitsKilled?:    number;
}

/**
 * Current technology level
 */
export enum TechLevel {
    Duchy = "duchy",
    Kingdom = "kingdom",
    Manor = "manor",
}

/**
 * Current game status
 */
export enum Status {
    Finished = "finished",
    Paused = "paused",
    Playing = "playing",
    Starting = "starting",
    Waiting = "waiting",
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
    public static toGameState(json: string): GameState {
        return cast(JSON.parse(json), r("GameState"));
    }

    public static gameStateToJson(value: GameState): string {
        return JSON.stringify(uncast(value, r("GameState")), null, 2);
    }
}

function invalidValue(typ: any, val: any, key: any, parent: any = ''): never {
    const prettyTyp = prettyTypeName(typ);
    const parentText = parent ? ` on ${parent}` : '';
    const keyText = key ? ` for key "${key}"` : '';
    throw Error(`Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(val)}`);
}

function prettyTypeName(typ: any): string {
    if (Array.isArray(typ)) {
        if (typ.length === 2 && typ[0] === undefined) {
            return `an optional ${prettyTypeName(typ[1])}`;
        } else {
            return `one of [${typ.map(a => { return prettyTypeName(a); }).join(", ")}]`;
        }
    } else if (typeof typ === "object" && typ.literal !== undefined) {
        return typ.literal;
    } else {
        return typeof typ;
    }
}

function jsonToJSProps(typ: any): any {
    if (typ.jsonToJS === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.json] = { key: p.js, typ: p.typ });
        typ.jsonToJS = map;
    }
    return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
    if (typ.jsToJSON === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.js] = { key: p.json, typ: p.typ });
        typ.jsToJSON = map;
    }
    return typ.jsToJSON;
}

function transform(val: any, typ: any, getProps: any, key: any = '', parent: any = ''): any {
    function transformPrimitive(typ: string, val: any): any {
        if (typeof typ === typeof val) return val;
        return invalidValue(typ, val, key, parent);
    }

    function transformUnion(typs: any[], val: any): any {
        // val must validate against one typ in typs
        const l = typs.length;
        for (let i = 0; i < l; i++) {
            const typ = typs[i];
            try {
                return transform(val, typ, getProps);
            } catch (_) {}
        }
        return invalidValue(typs, val, key, parent);
    }

    function transformEnum(cases: string[], val: any): any {
        if (cases.indexOf(val) !== -1) return val;
        return invalidValue(cases.map(a => { return l(a); }), val, key, parent);
    }

    function transformArray(typ: any, val: any): any {
        // val must be an array with no invalid elements
        if (!Array.isArray(val)) return invalidValue(l("array"), val, key, parent);
        return val.map(el => transform(el, typ, getProps));
    }

    function transformDate(val: any): any {
        if (val === null) {
            return null;
        }
        const d = new Date(val);
        if (isNaN(d.valueOf())) {
            return invalidValue(l("Date"), val, key, parent);
        }
        return d;
    }

    function transformObject(props: { [k: string]: any }, additional: any, val: any): any {
        if (val === null || typeof val !== "object" || Array.isArray(val)) {
            return invalidValue(l(ref || "object"), val, key, parent);
        }
        const result: any = {};
        Object.getOwnPropertyNames(props).forEach(key => {
            const prop = props[key];
            const v = Object.prototype.hasOwnProperty.call(val, key) ? val[key] : undefined;
            result[prop.key] = transform(v, prop.typ, getProps, key, ref);
        });
        Object.getOwnPropertyNames(val).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(props, key)) {
                result[key] = transform(val[key], additional, getProps, key, ref);
            }
        });
        return result;
    }

    if (typ === "any") return val;
    if (typ === null) {
        if (val === null) return val;
        return invalidValue(typ, val, key, parent);
    }
    if (typ === false) return invalidValue(typ, val, key, parent);
    let ref: any = undefined;
    while (typeof typ === "object" && typ.ref !== undefined) {
        ref = typ.ref;
        typ = typeMap[typ.ref];
    }
    if (Array.isArray(typ)) return transformEnum(typ, val);
    if (typeof typ === "object") {
        return typ.hasOwnProperty("unionMembers") ? transformUnion(typ.unionMembers, val)
            : typ.hasOwnProperty("arrayItems")    ? transformArray(typ.arrayItems, val)
            : typ.hasOwnProperty("props")         ? transformObject(getProps(typ), typ.additional, val)
            : invalidValue(typ, val, key, parent);
    }
    // Numbers can be parsed by Date but shouldn't be.
    if (typ === Date && typeof val !== "number") return transformDate(val);
    return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
    return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
    return transform(val, typ, jsToJSONProps);
}

function l(typ: any) {
    return { literal: typ };
}

function a(typ: any) {
    return { arrayItems: typ };
}

function u(...typs: any[]) {
    return { unionMembers: typs };
}

function o(props: any[], additional: any) {
    return { props, additional };
}

function m(additional: any) {
    return { props: [], additional };
}

function r(name: string) {
    return { ref: name };
}

const typeMap: any = {
    "GameState": o([
        { json: "availableTiles", js: "availableTiles", typ: a(r("AvailableTile")) },
        { json: "currentPlayer", js: "currentPlayer", typ: 0 },
        { json: "currentTileOptions", js: "currentTileOptions", typ: u(undefined, u(a(r("TypeElement")), null)) },
        { json: "events", js: "events", typ: u(undefined, a(r("Event"))) },
        { json: "gameId", js: "gameId", typ: "" },
        { json: "gameSettings", js: "gameSettings", typ: u(undefined, r("GameSettings")) },
        { json: "gameStartTime", js: "gameStartTime", typ: 3.14 },
        { json: "lastUpdate", js: "lastUpdate", typ: 3.14 },
        { json: "players", js: "players", typ: a(r("Player")) },
        { json: "status", js: "status", typ: r("Status") },
        { json: "tiles", js: "tiles", typ: a(m("any")) },
        { json: "turnNumber", js: "turnNumber", typ: 0 },
        { json: "turnTimeRemaining", js: "turnTimeRemaining", typ: 3.14 },
        { json: "units", js: "units", typ: a(m("any")) },
        { json: "winner", js: "winner", typ: u(undefined, u(0, null)) },
    ], false),
    "AvailableTile": o([
        { json: "count", js: "count", typ: 0 },
        { json: "type", js: "type", typ: r("TypeElement") },
    ], false),
    "Event": o([
        { json: "data", js: "data", typ: m("any") },
        { json: "id", js: "id", typ: "" },
        { json: "playerId", js: "playerId", typ: u(undefined, u(0, null)) },
        { json: "timestamp", js: "timestamp", typ: 3.14 },
        { json: "type", js: "type", typ: r("EventType") },
    ], false),
    "GameSettings": o([
        { json: "mapSize", js: "mapSize", typ: u(undefined, 0) },
        { json: "maxGameDuration", js: "maxGameDuration", typ: u(undefined, 3.14) },
        { json: "resourceUpdateInterval", js: "resourceUpdateInterval", typ: u(undefined, 3.14) },
        { json: "turnDuration", js: "turnDuration", typ: u(undefined, 3.14) },
    ], false),
    "Player": o([
        { json: "capitalCity", js: "capitalCity", typ: u(r("CapitalCity"), null) },
        { json: "color", js: "color", typ: "" },
        { json: "id", js: "id", typ: 0 },
        { json: "isConnected", js: "isConnected", typ: true },
        { json: "isEliminated", js: "isEliminated", typ: true },
        { json: "name", js: "name", typ: "" },
        { json: "resources", js: "resources", typ: r("Resources") },
        { json: "stats", js: "stats", typ: u(undefined, r("Stats")) },
        { json: "techLevel", js: "techLevel", typ: r("TechLevel") },
    ], false),
    "CapitalCity": o([
        { json: "x", js: "x", typ: 0 },
        { json: "y", js: "y", typ: 0 },
    ], false),
    "Resources": o([
        { json: "faith", js: "faith", typ: 0 },
        { json: "food", js: "food", typ: 0 },
        { json: "gold", js: "gold", typ: 0 },
    ], false),
    "Stats": o([
        { json: "tilesDestroyed", js: "tilesDestroyed", typ: u(undefined, 0) },
        { json: "tilesPlaced", js: "tilesPlaced", typ: u(undefined, 0) },
        { json: "unitsCreated", js: "unitsCreated", typ: u(undefined, 0) },
        { json: "unitsKilled", js: "unitsKilled", typ: u(undefined, 0) },
    ], false),
    "TypeElement": [
        "barracks",
        "capital_city",
        "city",
        "field",
        "marsh",
        "mine",
        "monastery",
        "orchard",
        "watchtower",
    ],
    "EventType": [
        "game_ended",
        "game_started",
        "player_eliminated",
        "tile_destroyed",
        "tile_placed",
        "turn_changed",
        "unit_attacked",
        "unit_created",
        "unit_killed",
        "unit_moved",
    ],
    "TechLevel": [
        "duchy",
        "kingdom",
        "manor",
    ],
    "Status": [
        "finished",
        "paused",
        "playing",
        "starting",
        "waiting",
    ],
};
