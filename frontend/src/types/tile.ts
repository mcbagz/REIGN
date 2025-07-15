// To parse this data:
//
//   import { Convert, Tile } from "./file";
//
//   const tile = Convert.toTile(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

/**
 * A tile in the Carcassonne: War of Ages game
 */
export interface Tile {
    /**
     * Edges of the tile [North, East, South, West]
     */
    edges: Edge[];
    /**
     * Current hit points
     */
    hp: number;
    /**
     * Unique identifier for the tile (e.g., '10,15')
     */
    id: string;
    /**
     * Maximum hit points
     */
    maxHp: number;
    /**
     * Additional tile metadata
     */
    metadata?: Metadata;
    /**
     * Player ID who owns this tile, null if unowned
     */
    owner: number | null;
    /**
     * Timestamp when tile was placed
     */
    placedAt: number;
    /**
     * Resource generation of this tile
     */
    resources: Resources;
    /**
     * Type of tile
     */
    type: TileType;
    /**
     * Worker placed on this tile, null if no worker
     */
    worker?: null | Worker;
    /**
     * X coordinate on the 40x40 grid
     */
    x: number;
    /**
     * Y coordinate on the 40x40 grid
     */
    y: number;
}

export enum Edge {
    Barracks = "barracks",
    City = "city",
    Field = "field",
    Marsh = "marsh",
    Mine = "mine",
    Monastery = "monastery",
    Orchard = "orchard",
    Watchtower = "watchtower",
}

/**
 * Additional tile metadata
 */
export interface Metadata {
    /**
     * Whether units can be trained at this tile
     */
    canTrain?: boolean;
    /**
     * Defense bonus provided by this tile
     */
    defenseBonus?: number;
    /**
     * Speed multiplier for units passing through
     */
    speedMultiplier?: number;
    /**
     * Maximum number of workers this tile can hold
     */
    workerCapacity?: number;
}

/**
 * Resource generation of this tile
 */
export interface Resources {
    /**
     * Faith generation per second
     */
    faith?: number;
    /**
     * Food generation per second
     */
    food?: number;
    /**
     * Gold generation per second
     */
    gold?: number;
}

/**
 * Type of tile
 */
export enum TileType {
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

export interface Worker {
    /**
     * Worker ID
     */
    id: number;
    /**
     * Player ID who owns this worker
     */
    owner: number;
    /**
     * Worker type
     */
    type: WorkerType;
    [property: string]: any;
}

/**
 * Worker type
 */
export enum WorkerType {
    Farmer = "farmer",
    Magistrate = "magistrate",
    Monk = "monk",
    Scout = "scout",
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
    public static toTile(json: string): Tile {
        return cast(JSON.parse(json), r("Tile"));
    }

    public static tileToJson(value: Tile): string {
        return JSON.stringify(uncast(value, r("Tile")), null, 2);
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
    "Tile": o([
        { json: "edges", js: "edges", typ: a(r("Edge")) },
        { json: "hp", js: "hp", typ: 0 },
        { json: "id", js: "id", typ: "" },
        { json: "maxHp", js: "maxHp", typ: 0 },
        { json: "metadata", js: "metadata", typ: u(undefined, r("Metadata")) },
        { json: "owner", js: "owner", typ: u(0, null) },
        { json: "placedAt", js: "placedAt", typ: 3.14 },
        { json: "resources", js: "resources", typ: r("Resources") },
        { json: "type", js: "type", typ: r("TileType") },
        { json: "worker", js: "worker", typ: u(undefined, u(null, r("Worker"))) },
        { json: "x", js: "x", typ: 0 },
        { json: "y", js: "y", typ: 0 },
    ], false),
    "Metadata": o([
        { json: "canTrain", js: "canTrain", typ: u(undefined, true) },
        { json: "defenseBonus", js: "defenseBonus", typ: u(undefined, 3.14) },
        { json: "speedMultiplier", js: "speedMultiplier", typ: u(undefined, 3.14) },
        { json: "workerCapacity", js: "workerCapacity", typ: u(undefined, 0) },
    ], false),
    "Resources": o([
        { json: "faith", js: "faith", typ: u(undefined, 0) },
        { json: "food", js: "food", typ: u(undefined, 0) },
        { json: "gold", js: "gold", typ: u(undefined, 0) },
    ], false),
    "Worker": o([
        { json: "id", js: "id", typ: 0 },
        { json: "owner", js: "owner", typ: 0 },
        { json: "type", js: "type", typ: r("WorkerType") },
    ], "any"),
    "Edge": [
        "barracks",
        "city",
        "field",
        "marsh",
        "mine",
        "monastery",
        "orchard",
        "watchtower",
    ],
    "TileType": [
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
    "WorkerType": [
        "farmer",
        "magistrate",
        "monk",
        "scout",
    ],
};
