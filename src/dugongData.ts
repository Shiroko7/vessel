import type { VesselState, RoomStats, WallStats, DerivedWall, WallEdge } from './types';

// Dugong — fantasy submersible (Barotrauma-style reskin).
// Stern (engine + propeller) on the LEFT, bow on the RIGHT.
// Two full main decks fill the hull; Engine spans both at the stern and Storage
// spans both at the bow. The conning tower on top is just two ordinary rooms
// (Airlock + Aux) sitting above the main deck — same size as every other room.

// ── Shared hull geometry (viewBox 0 0 1240 470) ──
export const HULL = {
  left: 92,      // inner edge where rooms meet the stern cap
  right: 1148,   // inner edge where rooms meet the bow cap
  top: 146,      // main-deck (deck 1) top
  mid: 256,      // divider between deck 1 and deck 2
  bottom: 366,   // deck 2 bottom
  skinTop: 138,
  skinBottom: 374,
  capOut: 64,    // how far the bow/stern caps bulge past left/right
} as const;

// Conning tower sits on top of the main deck (its rooms are full deck height).
export const CONNING = { roomY: 36, roomH: HULL.top - 36, skinTop: 28, left: 550, right: 914 } as const;

// Horizontal guide lines the layout editor snaps room edges to.
export const SNAP_Y = [CONNING.roomY, HULL.top, HULL.mid, HULL.bottom] as const;

const WALL_T = 12;  // hull plating thickness
const EPS = 4;      // tolerance for "edges coincide" tests
const MINSEG = 14;  // ignore exterior slivers shorter than this

const near = (a: number, b: number) => Math.abs(a - b) <= EPS;

// Subtract covered sub-ranges from [a0,a1]; return the exposed gaps.
function subtract(a0: number, a1: number, covers: [number, number][]): [number, number][] {
  const cs = covers
    .map(([s, e]): [number, number] => [Math.max(s, a0), Math.min(e, a1)])
    .filter(([s, e]) => e > s)
    .sort((p, q) => p[0] - q[0]);
  const gaps: [number, number][] = [];
  let cur = a0;
  for (const [s, e] of cs) {
    if (s > cur) gaps.push([cur, s]);
    cur = Math.max(cur, e);
  }
  if (cur < a1) gaps.push([cur, a1]);
  return gaps.filter(([s, e]) => e - s >= MINSEG);
}

// Cap bulge as a function of y (parabola: max at hull mid-height, 0 at the ends).
const CAP_MID = (HULL.skinTop + HULL.skinBottom) / 2;
const CAP_HALF = (HULL.skinBottom - HULL.skinTop) / 2;
function bulge(y: number): number {
  const t = (y - CAP_MID) / CAP_HALF;
  return Math.max(0, HULL.capOut * (1 - t * t));
}
function capSlice(y1: number, y2: number, side: 'stern' | 'bow'): string {
  const inner = side === 'stern' ? HULL.left : HULL.right;
  const out = (y: number) => (side === 'stern' ? inner - bulge(y) : inner + bulge(y));
  const N = 8;
  let d = `M${inner},${y1.toFixed(1)} L${inner},${y2.toFixed(1)} `;
  for (let i = N; i >= 0; i--) {
    const y = y1 + ((y2 - y1) * i) / N;
    d += `L${out(y).toFixed(1)},${y.toFixed(1)} `;
  }
  return d + 'Z';
}

const EDGE_LABEL: Record<WallEdge, string> = {
  top: 'Hull Top', bottom: 'Hull Bot', left: 'Hull Side', right: 'Hull Side', stern: 'Stern', bow: 'Bow',
};
const EDGE_HP: Record<WallEdge, number> = {
  top: 30, bottom: 30, left: 30, right: 30, stern: 30, bow: 30,
};
const EDGE_AC: Record<WallEdge, number> = {
  top: 14, bottom: 14, left: 14, right: 14, stern: 14, bow: 14,
};

/**
 * Walls follow rooms. Every part of a room's outline that is NOT shared with a
 * neighbouring room is an exterior wall, segmented and labelled per room.
 * Single source of truth for wall geometry — robust to any drag-edited layout.
 */
export function deriveWalls(rooms: Record<string, RoomStats>): DerivedWall[] {
  const rs = Object.values(rooms);
  const out: DerivedWall[] = [];

  const emit = (edge: WallEdge, r: RoomStats, i: number, geo: Pick<DerivedWall, 'kind' | 'box' | 'path'>) => {
    out.push({ id: `${edge}:${r.id}${i ? `:${i}` : ''}`, label: `${EDGE_LABEL[edge]} · ${r.label}`, edge, ...geo });
  };

  for (const r of rs) {
    const x0 = r.x, x1 = r.x + r.w, y0 = r.y, y1 = r.y + r.h;

    // TOP — rooms whose bottom rests on r's top
    const topCov = rs.filter(o => o.id !== r.id && near(o.y + o.h, y0)).map(o => [o.x, o.x + o.w] as [number, number]);
    subtract(x0, x1, topCov).forEach(([a, b], i) =>
      emit('top', r, i, { kind: 'rect', box: { x: a, y: y0 - WALL_T, w: b - a, h: WALL_T } }));

    // BOTTOM — rooms whose top rests on r's bottom
    const botCov = rs.filter(o => o.id !== r.id && near(o.y, y1)).map(o => [o.x, o.x + o.w] as [number, number]);
    subtract(x0, x1, botCov).forEach(([a, b], i) =>
      emit('bottom', r, i, { kind: 'rect', box: { x: a, y: y1, w: b - a, h: WALL_T } }));

    // LEFT — stern cap if on the hull's left edge, otherwise a flat side wall
    const leftCov = rs.filter(o => o.id !== r.id && near(o.x + o.w, x0)).map(o => [o.y, o.y + o.h] as [number, number]);
    subtract(y0, y1, leftCov).forEach(([a, b], i) => near(x0, HULL.left)
      ? emit('stern', r, i, { kind: 'path', path: capSlice(a, b, 'stern') })
      : emit('left', r, i, { kind: 'rect', box: { x: x0 - WALL_T, y: a, w: WALL_T, h: b - a } }));

    // RIGHT — bow cap if on the hull's right edge, otherwise a flat side wall
    const rightCov = rs.filter(o => o.id !== r.id && near(o.x, x1)).map(o => [o.y, o.y + o.h] as [number, number]);
    subtract(y0, y1, rightCov).forEach(([a, b], i) => near(x1, HULL.right)
      ? emit('bow', r, i, { kind: 'path', path: capSlice(a, b, 'bow') })
      : emit('right', r, i, { kind: 'rect', box: { x: x1, y: a, w: WALL_T, h: b - a } }));
  }
  return out;
}

// ── Default rooms (stern → bow). All rooms are the same deck height. ──
const D = CONNING.roomH;            // standard deck-room height
const DECK = { top: HULL.top, mid: HULL.mid };
const DH = HULL.mid - HULL.top;     // deck-1 height
const SPAN = HULL.bottom - HULL.top; // full main-hull height (decks 1+2)

const DEFAULT_ROOMS: Record<string, RoomStats> = {
  // Conning tower (two narrow rooms, ~30% slimmer, centred over Diving Locker + Crew Quarters)
  airlock: { id: 'airlock', label: 'Airlock',          x: 458, y: CONNING.roomY, w: 126, h: D },
  aux:     { id: 'aux',     label: 'Aux. Compartment', x: 584, y: CONNING.roomY, w: 112, h: D },

  // Deck 1+2 spanning rooms (stern / bow)
  engine:  { id: 'engine',  label: 'Engine Room', x: 92,   y: DECK.top, w: 150, h: SPAN },
  storage: { id: 'storage', label: 'Storage',     x: 1052, y: DECK.top, w: 96,  h: SPAN },

  // Deck 1 (upper main)
  commander:     { id: 'commander',     label: 'Commander Room', x: 242, y: DECK.top, w: 170, h: DH },
  diving_locker: { id: 'diving_locker', label: 'Diving Locker',  x: 412, y: DECK.top, w: 150, h: DH },
  crew:          { id: 'crew',          label: 'Crew Quarters',  x: 562, y: DECK.top, w: 180, h: DH },
  medbay:        { id: 'medbay',        label: 'Medicine Bay',   x: 742, y: DECK.top, w: 160, h: DH },
  armory:        { id: 'armory',        label: 'Armory',         x: 902, y: DECK.top, w: 150, h: DH },

  // Deck 2 (lower main)
  ballast_a: { id: 'ballast_a', label: 'Ballast A',      x: 242, y: DECK.mid, w: 200, h: DH, ballast: true },
  reactor:   { id: 'reactor',   label: 'Reactor Room',   x: 442, y: DECK.mid, w: 170, h: DH },
  junction:  { id: 'junction',  label: 'Junction Boxes', x: 612, y: DECK.mid, w: 270, h: DH },
  ballast_b: { id: 'ballast_b', label: 'Ballast B',      x: 882, y: DECK.mid, w: 170, h: DH, ballast: true },
};

function statFor(w: DerivedWall): WallStats {
  const hp = EDGE_HP[w.edge];
  return { id: w.id, label: w.label, hp, maxHp: hp, tempHp: 0, ac: EDGE_AC[w.edge] };
}

export const DEFAULT_STATE: VesselState = {
  rooms: DEFAULT_ROOMS,
  walls: (() => {
    const walls: Record<string, WallStats> = {};
    for (const w of deriveWalls(DEFAULT_ROOMS)) walls[w.id] = statFor(w);
    return walls;
  })(),
};

/** Fill in stats for any derived wall missing from `walls`; refresh labels. */
export function ensureWalls(rooms: Record<string, RoomStats>, walls: Record<string, WallStats>): Record<string, WallStats> {
  const out: Record<string, WallStats> = { ...walls };
  for (const w of deriveWalls(rooms)) {
    out[w.id] = out[w.id] ? { ...out[w.id], label: w.label } : statFor(w);
  }
  return out;
}

// Stable key — intentionally NOT versioned, same rationale as LOCAL_KEY in
// useVesselState.ts. mergeDeep + ensureWalls already absorb schema drift on
// load, so a schema change never needs a new key. (Previously this bumped on
// every schema change — v3, v5, v6, v7, ... v11 — which permanently orphaned
// a full ship-state snapshot under each old key: they're shallow-merged room
// metadata, sharing one 16kB budget across every extension in the room, and
// nothing ever deleted the old ones. See LEGACY_METADATA_KEYS below, which
// useVesselState.ts uses to migrate + clean up existing rooms once.)
export const METADATA_KEY = 'com.vessel.statusmonitor.state';

/** Every versioned key this extension has ever written to room metadata. */
export const LEGACY_METADATA_KEYS = Array.from(
  { length: 20 },
  (_, i) => `com.vessel.statusmonitor.state.v${i + 1}`,
);
