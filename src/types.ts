export interface WallStats {
  id: string;
  label: string;
  hp: number;
  maxHp: number;
  tempHp: number;
  ac: number;
}

export interface RoomStats {
  id: string;
  label: string;
  /** Geometry in schematic viewBox units (0 0 1240 470). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Renders a fixed water-level fill (ballast tanks). */
  ballast?: boolean;
}

export type WallEdge = 'top' | 'bottom' | 'left' | 'right' | 'stern' | 'bow';

/** Render geometry for a hull wall, derived from room edges (see deriveWalls). */
export interface DerivedWall {
  id: string;
  label: string;
  edge: WallEdge;
  kind: 'rect' | 'path';
  box?: { x: number; y: number; w: number; h: number };
  path?: string;
}

export interface VesselState {
  rooms: Record<string, RoomStats>;
  walls: Record<string, WallStats>;
}

export type DamageLevel = 'pristine' | 'damaged' | 'heavy' | 'critical' | 'destroyed';

export function getDamageLevel(hp: number, maxHp: number): DamageLevel {
  const pct = maxHp > 0 ? hp / maxHp : 0;
  if (pct <= 0) return 'destroyed';
  if (pct < 0.25) return 'critical';
  if (pct < 0.5) return 'heavy';
  if (pct < 0.8) return 'damaged';
  return 'pristine';
}

export const DAMAGE_COLORS: Record<DamageLevel, string> = {
  pristine: '#00d4ff',
  damaged: '#f0c040',
  heavy: '#ff8800',
  critical: '#ff2222',
  destroyed: '#440000',
};
