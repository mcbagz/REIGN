// To parse this data:
//
//   import { Convert, WebSocketMessage } from "./file";
//
//   const webSocketMessage = Convert.toWebSocketMessage(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

/**
 * WebSocket message envelope for client-server communication
 */
export interface WebSocketMessage {
    /**
     * ID of the game this message relates to, null for lobby messages
     */
    gameId?: null | string;
    /**
     * Unique identifier for this message
     */
    messageId: string;
    /**
     * Message metadata
     */
    metadata?: Metadata;
    /**
     * Message payload, structure depends on message type
     */
    payload: boolean | number | { [key: string]: any } | null | string;
    /**
     * ID of the player who sent the message, null for server messages
     */
    playerId?: number | null;
    /**
     * Message priority for processing order
     */
    priority?: Priority;
    /**
     * Message ID this is a reply to, null if not a reply
     */
    replyTo?: null | string;
    /**
     * Whether this message requires acknowledgment
     */
    requiresAck?: boolean;
    /**
     * Sequence number for ordering messages
     */
    sequenceNumber?: number;
    /**
     * Unix timestamp when message was created
     */
    timestamp: number;
    /**
     * Type of message
     */
    type: Type;
}

/**
 * Message metadata
 */
export interface Metadata {
    /**
     * Maximum number of retry attempts
     */
    maxRetries?: number;
    /**
     * Number of retry attempts
     */
    retryCount?: number;
    /**
     * Source of the message
     */
    source?: Source;
    /**
     * Time to live in seconds
     */
    ttl?: number;
    /**
     * Protocol version
     */
    version?: string;
}

/**
 * Source of the message
 */
export enum Source {
    Client = "client",
    Server = "server",
}

/**
 * Message priority for processing order
 */
export enum Priority {
    Critical = "critical",
    High = "high",
    Low = "low",
    Normal = "normal",
}

/**
 * Type of message
 */
export enum Type {
    Command = "command",
    Error = "error",
    GameEnded = "game_ended",
    GameStarted = "game_started",
    JoinGame = "join_game",
    LeaveGame = "leave_game",
    Ping = "ping",
    PlayerJoined = "player_joined",
    PlayerLeft = "player_left",
    Pong = "pong",
    ResourceUpdated = "resource_updated",
    State = "state",
    TilePlaced = "tile_placed",
    TurnChanged = "turn_changed",
    UnitAttacked = "unit_attacked",
    UnitCreated = "unit_created",
    UnitMoved = "unit_moved",
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
    public static toWebSocketMessage(json: string): WebSocketMessage {
        return cast(JSON.parse(json), r("WebSocketMessage"));
    }

    public static webSocketMessageToJson(value: WebSocketMessage): string {
        return JSON.stringify(uncast(value, r("WebSocketMessage")), null, 2);
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
    "WebSocketMessage": o([
        { json: "gameId", js: "gameId", typ: u(undefined, u(null, "")) },
        { json: "messageId", js: "messageId", typ: "" },
        { json: "metadata", js: "metadata", typ: u(undefined, r("Metadata")) },
        { json: "payload", js: "payload", typ: u(true, 3.14, m("any"), null, "") },
        { json: "playerId", js: "playerId", typ: u(undefined, u(0, null)) },
        { json: "priority", js: "priority", typ: u(undefined, r("Priority")) },
        { json: "replyTo", js: "replyTo", typ: u(undefined, u(null, "")) },
        { json: "requiresAck", js: "requiresAck", typ: u(undefined, true) },
        { json: "sequenceNumber", js: "sequenceNumber", typ: u(undefined, 0) },
        { json: "timestamp", js: "timestamp", typ: 3.14 },
        { json: "type", js: "type", typ: r("Type") },
    ], false),
    "Metadata": o([
        { json: "maxRetries", js: "maxRetries", typ: u(undefined, 0) },
        { json: "retryCount", js: "retryCount", typ: u(undefined, 0) },
        { json: "source", js: "source", typ: u(undefined, r("Source")) },
        { json: "ttl", js: "ttl", typ: u(undefined, 3.14) },
        { json: "version", js: "version", typ: u(undefined, "") },
    ], false),
    "Source": [
        "client",
        "server",
    ],
    "Priority": [
        "critical",
        "high",
        "low",
        "normal",
    ],
    "Type": [
        "command",
        "error",
        "game_ended",
        "game_started",
        "join_game",
        "leave_game",
        "ping",
        "player_joined",
        "player_left",
        "pong",
        "resource_updated",
        "state",
        "tile_placed",
        "turn_changed",
        "unit_attacked",
        "unit_created",
        "unit_moved",
    ],
};
