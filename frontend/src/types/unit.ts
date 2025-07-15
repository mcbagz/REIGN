// To parse this data:
//
//   import { Convert, Unit } from "./file";
//
//   const unit = Convert.toUnit(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

/**
 * A unit in the Carcassonne: War of Ages game
 */
export interface Unit {
    /**
     * Attack damage
     */
    attack: number;
    /**
     * Timestamp when unit was created
     */
    createdAt: number;
    /**
     * Defense rating
     */
    defense: number;
    /**
     * Current hit points
     */
    hp: number;
    /**
     * Unique identifier for the unit
     */
    id: string;
    /**
     * Timestamp of last action, null if no action taken
     */
    lastAction?: number | null;
    /**
     * Maximum hit points
     */
    maxHp: number;
    /**
     * Additional unit metadata
     */
    metadata?: Metadata;
    /**
     * Player ID who owns this unit
     */
    owner: number;
    /**
     * Current position of the unit
     */
    position: UnitPosition;
    /**
     * Attack range in tiles
     */
    range: number;
    /**
     * Movement speed in tiles per second
     */
    speed: number;
    /**
     * Current status of the unit
     */
    status: Status;
    /**
     * Current target for movement or attack, null if none
     */
    target?: Target | null;
    /**
     * Type of unit
     */
    type: UnitType;
}

/**
 * Additional unit metadata
 */
export interface Metadata {
    /**
     * Resource cost to train this unit
     */
    cost?: Cost;
    /**
     * Combat effectiveness against different unit types
     */
    effectiveness?: Effectiveness;
    /**
     * Time in seconds to train this unit
     */
    trainingTime?: number;
}

/**
 * Resource cost to train this unit
 */
export interface Cost {
    faith?: number;
    food?:  number;
    gold?:  number;
}

/**
 * Combat effectiveness against different unit types
 */
export interface Effectiveness {
    /**
     * Damage multiplier vs archer
     */
    archer?: number;
    /**
     * Damage multiplier vs infantry
     */
    infantry?: number;
    /**
     * Damage multiplier vs knight
     */
    knight?: number;
    /**
     * Damage multiplier vs siege
     */
    siege?: number;
}

/**
 * Current position of the unit
 */
export interface UnitPosition {
    /**
     * X coordinate on the 40x40 grid
     */
    x: number;
    /**
     * Y coordinate on the 40x40 grid
     */
    y: number;
}

/**
 * Current status of the unit
 */
export enum Status {
    Attacking = "attacking",
    Dead = "dead",
    Idle = "idle",
    Moving = "moving",
    Training = "training",
}

export interface Target {
    /**
     * ID of the target
     */
    id:       string;
    position: TargetPosition;
    /**
     * Type of target
     */
    type: TargetType;
}

export interface TargetPosition {
    x: number;
    y: number;
}

/**
 * Type of target
 */
export enum TargetType {
    Tile = "tile",
    Unit = "unit",
}

/**
 * Type of unit
 */
export enum UnitType {
    Archer = "archer",
    Infantry = "infantry",
    Knight = "knight",
    Siege = "siege",
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
    public static toUnit(json: string): Unit {
        return cast(JSON.parse(json), r("Unit"));
    }

    public static unitToJson(value: Unit): string {
        return JSON.stringify(uncast(value, r("Unit")), null, 2);
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
    "Unit": o([
        { json: "attack", js: "attack", typ: 0 },
        { json: "createdAt", js: "createdAt", typ: 3.14 },
        { json: "defense", js: "defense", typ: 0 },
        { json: "hp", js: "hp", typ: 0 },
        { json: "id", js: "id", typ: "" },
        { json: "lastAction", js: "lastAction", typ: u(undefined, u(3.14, null)) },
        { json: "maxHp", js: "maxHp", typ: 0 },
        { json: "metadata", js: "metadata", typ: u(undefined, r("Metadata")) },
        { json: "owner", js: "owner", typ: 0 },
        { json: "position", js: "position", typ: r("UnitPosition") },
        { json: "range", js: "range", typ: 0 },
        { json: "speed", js: "speed", typ: 3.14 },
        { json: "status", js: "status", typ: r("Status") },
        { json: "target", js: "target", typ: u(undefined, u(r("Target"), null)) },
        { json: "type", js: "type", typ: r("UnitType") },
    ], false),
    "Metadata": o([
        { json: "cost", js: "cost", typ: u(undefined, r("Cost")) },
        { json: "effectiveness", js: "effectiveness", typ: u(undefined, r("Effectiveness")) },
        { json: "trainingTime", js: "trainingTime", typ: u(undefined, 3.14) },
    ], false),
    "Cost": o([
        { json: "faith", js: "faith", typ: u(undefined, 0) },
        { json: "food", js: "food", typ: u(undefined, 0) },
        { json: "gold", js: "gold", typ: u(undefined, 0) },
    ], false),
    "Effectiveness": o([
        { json: "archer", js: "archer", typ: u(undefined, 3.14) },
        { json: "infantry", js: "infantry", typ: u(undefined, 3.14) },
        { json: "knight", js: "knight", typ: u(undefined, 3.14) },
        { json: "siege", js: "siege", typ: u(undefined, 3.14) },
    ], false),
    "UnitPosition": o([
        { json: "x", js: "x", typ: 0 },
        { json: "y", js: "y", typ: 0 },
    ], false),
    "Target": o([
        { json: "id", js: "id", typ: "" },
        { json: "position", js: "position", typ: r("TargetPosition") },
        { json: "type", js: "type", typ: r("TargetType") },
    ], false),
    "TargetPosition": o([
        { json: "x", js: "x", typ: 0 },
        { json: "y", js: "y", typ: 0 },
    ], false),
    "Status": [
        "attacking",
        "dead",
        "idle",
        "moving",
        "training",
    ],
    "TargetType": [
        "tile",
        "unit",
    ],
    "UnitType": [
        "archer",
        "infantry",
        "knight",
        "siege",
    ],
};
