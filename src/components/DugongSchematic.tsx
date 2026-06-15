import { useState } from 'react';
import type { VesselState, WallStats, RoomStats } from '../types';
import { getDamageLevel } from '../types';
import type { Theme } from '../themes';
import { HULL, CONNING, SNAP_Y, deriveWalls } from '../dugongData';

interface Props {
  state: VesselState;
  theme: Theme;
  editMode: boolean;
  onSelectWall: (id: string) => void;
  onSelectRoom: (id: string) => void;
  onUpdateRoom: (id: string, patch: Partial<RoomStats>) => void;
}

interface HoverInfo {
  label: string;
  hp: number; maxHp: number; tempHp: number; ac: number;
  x: number; y: number;
}

type DragMode = 'move' | 'l' | 'r' | 't' | 'b';
interface Box { x: number; y: number; w: number; h: number }
interface DragState {
  id: string;
  mode: DragMode;
  px: number; py: number;   // pointer SVG coords at drag start
  orig: Box;
  box: Box;                 // live preview
  moved: boolean;
}

const MIN = 36;
const SNAP_T = 12;
const PLATE = 13;   // how far the dark hull backing extends past each room
const EDGE_EPS = 6; // tolerance for "room sits on the hull edge"

function snap(v: number, guides: readonly number[]): number {
  let best = v, bd = SNAP_T;
  for (const g of guides) {
    const d = Math.abs(v - g);
    if (d <= bd) { bd = d; best = g; }
  }
  return best;
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function DugongSchematic({ state, theme, editMode, onSelectWall, onSelectRoom, onUpdateRoom }: Props) {
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const sc = theme.schematic;

  // Apply any in-progress drag as a live preview so the hull + walls follow the room.
  const rooms: Record<string, RoomStats> = drag
    ? { ...state.rooms, [drag.id]: { ...state.rooms[drag.id], ...drag.box } }
    : state.rooms;
  const roomList = Object.values(rooms);
  const walls = deriveWalls(rooms);

  // Decorations that should track the layout rather than sit at fixed points.
  const sternRooms = roomList.filter(r => Math.abs(r.x - HULL.left) < EDGE_EPS);
  const propY = sternRooms.length
    ? (Math.min(...sternRooms.map(r => r.y)) + Math.max(...sternRooms.map(r => r.y + r.h))) / 2
    : HULL.mid;
  const minY = roomList.length ? Math.min(...roomList.map(r => r.y)) : CONNING.roomY;
  const topRooms = roomList.filter(r => Math.abs(r.y - minY) < EDGE_EPS);
  const topCx = topRooms.length
    ? topRooms.reduce((s, r) => s + r.x + r.w / 2, 0) / topRooms.length
    : 620;

  function segColor(s: WallStats): string {
    return theme.damage[getDamageLevel(s.hp, s.maxHp)];
  }
  function segOpacity(s: WallStats): number {
    const lvl = getDamageLevel(s.hp, s.maxHp);
    if (lvl === 'destroyed') return 0.18;
    if (lvl === 'critical') return 0.6;
    return 1;
  }

  function toSvg(e: React.PointerEvent | React.MouseEvent): { x: number; y: number } {
    const svg = (e.currentTarget as SVGElement).closest('svg');
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (1240 / r.width), y: (e.clientY - r.top) * (470 / r.height) };
  }

  function showHover(item: WallStats, e: React.MouseEvent) {
    const p = toSvg(e);
    setHover({ label: item.label, hp: item.hp, maxHp: item.maxHp, tempHp: item.tempHp, ac: item.ac, x: p.x, y: p.y });
  }

  function wallHandlers(id: string) {
    if (editMode) return {};
    const w = state.walls[id];
    return {
      onClick: () => onSelectWall(id),
      onMouseEnter: (e: React.MouseEvent) => showHover(w, e),
      onMouseMove: (e: React.MouseEvent) => showHover(w, e),
    };
  }

  // ── Drag / resize ──
  function beginDrag(id: string, mode: DragMode, e: React.PointerEvent) {
    if (!editMode) return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const r = state.rooms[id];
    const orig = { x: r.x, y: r.y, w: r.w, h: r.h };
    const p = toSvg(e);
    setHover(null);
    setDrag({ id, mode, px: p.x, py: p.y, orig, box: { ...orig }, moved: false });
  }

  function computeBox(d: DragState, dx: number, dy: number): Box {
    const o = d.orig;
    const xg: number[] = [HULL.left, HULL.right];
    for (const r of Object.values(state.rooms)) {
      if (r.id === d.id) continue;
      xg.push(r.x, r.x + r.w);
    }
    let { x, y, w, h } = o;
    switch (d.mode) {
      case 'move': {
        x = clamp(snap(o.x + dx, xg), HULL.left, HULL.right - o.w);
        y = clamp(snap(o.y + dy, SNAP_Y), CONNING.roomY, HULL.bottom - o.h);
        break;
      }
      case 'l': {
        const nx = clamp(snap(o.x + dx, xg), HULL.left, o.x + o.w - MIN);
        x = nx; w = o.x + o.w - nx;
        break;
      }
      case 'r': {
        const rx = clamp(snap(o.x + o.w + dx, xg), o.x + MIN, HULL.right);
        w = rx - o.x;
        break;
      }
      case 't': {
        const ny = clamp(snap(o.y + dy, SNAP_Y), CONNING.roomY, o.y + o.h - MIN);
        y = ny; h = o.y + o.h - ny;
        break;
      }
      case 'b': {
        const by = clamp(snap(o.y + o.h + dy, SNAP_Y), o.y + MIN, HULL.bottom);
        h = by - o.y;
        break;
      }
    }
    return { x, y, w, h };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const p = toSvg(e);
    const dx = p.x - drag.px, dy = p.y - drag.py;
    const moved = drag.moved || Math.abs(dx) > 2 || Math.abs(dy) > 2;
    setDrag({ ...drag, box: computeBox(drag, dx, dy), moved });
  }

  function onPointerUp() {
    if (!drag) return;
    if (drag.moved) onUpdateRoom(drag.id, drag.box);
    else onSelectRoom(drag.id);
    setDrag(null);
  }

  function renderLabel(b: Box, label: string, color: string) {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const words = label.split(' ');
    const stack = words.length > 1 && b.w < 170;
    if (stack) {
      return (
        <text x={cx} y={cy} textAnchor="middle" className="room-label" fill={color}>
          <tspan x={cx} dy="-2">{words[0]}</tspan>
          <tspan x={cx} dy="14">{words.slice(1).join(' ')}</tspan>
        </text>
      );
    }
    return <text x={cx} y={cy + 4} textAnchor="middle" className="room-label" fill={color}>{label}</text>;
  }

  return (
    <div className="schematic-wrap">
      <svg
        viewBox="0 0 1240 470"
        className={`schematic-svg${editMode ? ' editing' : ''}`}
        onMouseLeave={() => setHover(null)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <pattern id="scan" width="5" height="5" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="5" stroke={sc.scan} strokeWidth="0.4" opacity="0.06" />
          </pattern>
        </defs>

        {/* ── Hull body: dark plating backing derived from the rooms ── */}
        {roomList.map((r) => (
          <rect key={`bk-${r.id}`} x={r.x - PLATE} y={r.y - PLATE} width={r.w + PLATE * 2} height={r.h + PLATE * 2}
            rx={10} fill={sc.hullFill} pointerEvents="none" />
        ))}
        {roomList.map((r) => (
          <rect key={`sc-${r.id}`} x={r.x - PLATE} y={r.y - PLATE} width={r.w + PLATE * 2} height={r.h + PLATE * 2}
            rx={10} fill="url(#scan)" pointerEvents="none" />
        ))}

        {/* Edit-mode snap guides */}
        {editMode && SNAP_Y.map(y => (
          <line key={y} x1="36" y1={y} x2="1204" y2={y} stroke={sc.accent} strokeWidth="0.6"
            strokeDasharray="6 6" opacity="0.35" pointerEvents="none" />
        ))}

        {/* ── Propeller (stern, decorative) ── */}
        <g pointerEvents="none" stroke={sc.deco} strokeWidth="2" fill="none" opacity="0.8">
          <line x1={HULL.left - PLATE} y1={propY} x2="10" y2={propY} />
          <ellipse cx="10" cy={propY - 20} rx="5" ry="18" />
          <ellipse cx="10" cy={propY + 20} rx="5" ry="18" />
        </g>

        {/* ── Periscopes over the topmost rooms (decorative) ── */}
        <g pointerEvents="none" stroke={sc.deco} strokeWidth="2.5" opacity="0.85">
          <line x1={topCx - 50} y1={minY - PLATE} x2={topCx - 50} y2={minY - PLATE - 26} />
          <line x1={topCx - 50} y1={minY - PLATE - 26} x2={topCx - 34} y2={minY - PLATE - 26} />
          <line x1={topCx + 50} y1={minY - PLATE} x2={topCx + 50} y2={minY - PLATE - 26} />
          <line x1={topCx + 50} y1={minY - PLATE - 26} x2={topCx + 34} y2={minY - PLATE - 26} />
        </g>

        {/* ── Rooms ── */}
        {roomList.map((r) => {
          const b: Box = { x: r.x, y: r.y, w: r.w, h: r.h };
          return (
            <g key={r.id} className={`room-seg${editMode ? ' editing' : ''}`}
              onMouseEnter={editMode ? undefined : () => setHover(null)}
              onMouseMove={editMode ? undefined : () => setHover(null)}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={3}
                fill={sc.roomFill} fillOpacity={sc.roomFillOpacity} stroke={sc.roomStroke} strokeWidth={1}
                onPointerDown={editMode ? (e) => beginDrag(r.id, 'move', e) : undefined} />
              {r.ballast && (
                <rect x={b.x + 2} y={b.y + b.h - Math.max(4, b.h - 26)}
                  width={b.w - 4} height={Math.max(4, b.h - 26)}
                  fill={sc.water} fillOpacity={0.2} pointerEvents="none" />
              )}
              {renderLabel(b, r.label, sc.roomLabel)}
              {editMode && (
                <g>
                  <rect className="rz rz-x" x={b.x - 4} y={b.y} width={8} height={b.h}
                    onPointerDown={(e) => beginDrag(r.id, 'l', e)} />
                  <rect className="rz rz-x" x={b.x + b.w - 4} y={b.y} width={8} height={b.h}
                    onPointerDown={(e) => beginDrag(r.id, 'r', e)} />
                  <rect className="rz rz-y" x={b.x} y={b.y - 4} width={b.w} height={8}
                    onPointerDown={(e) => beginDrag(r.id, 't', e)} />
                  <rect className="rz rz-y" x={b.x} y={b.y + b.h - 4} width={b.w} height={8}
                    onPointerDown={(e) => beginDrag(r.id, 'b', e)} />
                </g>
              )}
            </g>
          );
        })}

        {/* ── Derived hull walls (follow room edges) ── */}
        {walls.map((dw) => {
          const w = state.walls[dw.id];
          if (!w) return null;
          const common = {
            fill: segColor(w), opacity: segOpacity(w),
            className: 'wall-seg', filter: 'url(#glow)',
            pointerEvents: (editMode ? 'none' : undefined) as React.SVGProps<SVGPathElement>['pointerEvents'],
            ...wallHandlers(dw.id),
          };
          return dw.kind === 'rect'
            ? <rect key={dw.id} x={dw.box!.x} y={dw.box!.y} width={dw.box!.w} height={dw.box!.h} rx={2} {...common} />
            : <path key={dw.id} d={dw.path!} {...common} />;
        })}

        {/* ── Deck gun (bottom centre, decorative) ── */}
        <g pointerEvents="none" stroke={sc.deco} strokeWidth="3" opacity="0.8" fill="none">
          <line x1="618" y1={HULL.skinBottom + 2} x2="618" y2={HULL.skinBottom + 24} />
          <line x1="600" y1={HULL.skinBottom + 24} x2="660" y2={HULL.skinBottom + 24} strokeWidth="5" strokeLinecap="round" />
        </g>

        <text x={620} y="432" textAnchor="middle" className="ship-name" fill={sc.shipName}>D U G O N G</text>

        {/* ── Tooltip (walls only) ── */}
        {hover && !editMode && (() => {
          const tw = 318, th = 162;
          const tx = Math.min(Math.max(hover.x + 18, 4), 1240 - tw - 4);
          const ty = hover.y > 250 ? hover.y - th - 16 : hover.y + 16;
          return (
            <g transform={`translate(${tx},${ty})`} pointerEvents="none">
              <rect x={0} y={0} width={tw} height={th} rx={8}
                fill={sc.tooltipBg} stroke={sc.accent} strokeWidth={1.5} opacity={0.97} />
              <text x={16} y={30} className="tt-title">{hover.label}</text>
              <line x1={10} y1={42} x2={tw - 10} y2={42} stroke={sc.accent} strokeWidth={0.7} opacity={0.4} />
              <text x={16} y={68} className="tt-row">HP</text>
              <text x={tw - 16} y={68} textAnchor="end" className="tt-val">{hover.hp} / {hover.maxHp}</text>
              <text x={16} y={96} className="tt-row">Temp HP</text>
              <text x={tw - 16} y={96} textAnchor="end" className="tt-val tt-temp">{hover.tempHp}</text>
              <text x={16} y={124} className="tt-row">Armor Class</text>
              <text x={tw - 16} y={124} textAnchor="end" className="tt-val">{hover.ac}</text>
              <text x={16} y={150} className="tt-row tt-hint">Click to edit</text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
