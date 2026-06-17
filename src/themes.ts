import type { DamageLevel } from './types';

// ── Theme system ──────────────────────────────────────────────────────────
// Each theme is a self-contained palette: CSS custom properties (consumed by
// App.css) + JS-side colors for the SVG schematic and the damage ramp.
// Toggle is per-user (localStorage), so each player can pick their own look.

export interface Theme {
  id: string;
  name: string;
  blurb: string;
  /** Applied as inline CSS custom properties on the .app root. */
  vars: Record<string, string>;
  /** HP damage ramp — healthy → destroyed. */
  damage: Record<DamageLevel, string>;
  /** Colors used directly inside the SVG schematic. */
  schematic: {
    hullFill: string;
    hullStroke: string;
    deco: string;
    scan: string;
    roomFill: string;
    roomFillOpacity: number;
    roomStroke: string;
    roomLabel: string;
    water: string;
    shipName: string;
    tooltipBg: string;
    accent: string;
    temp: string;
  };
}

// ── 1. Abyssal — techno-magic cyan ──
const abyssal: Theme = {
  id: 'abyssal',
  name: 'Abyssal',
  blurb: 'Techno-magic depths',
  vars: {
    '--bg': '#060a12',
    '--bg2': '#0b1119',
    '--bg3': '#111a26',
    '--border': '#1d3144',
    '--accent': '#2ee6ff',
    '--accent-dim': '#0a5a73',
    '--accent-bright': '#8af2ff',
    '--text': '#c2dcec',
    '--text-dim': '#638298',
    '--danger': '#ff5454',
    '--heal': '#2ec56a',
    '--temp': '#74b4ff',
    '--glow': '46,230,255',
  },
  damage: {
    pristine: '#2ee6ff',
    damaged: '#ffd24d',
    heavy: '#ff8c2e',
    critical: '#ff3b3b',
    destroyed: '#4a0d0d',
  },
  schematic: {
    hullFill: '#070b13',
    hullStroke: '#243b50',
    deco: '#3a5568',
    scan: '#2ee6ff',
    roomFill: '#2ee6ff',
    roomFillOpacity: 0.07,
    roomStroke: '#1d4d63',
    roomLabel: '#7fc4dc',
    water: '#1d6f9e',
    shipName: '#456176',
    tooltipBg: '#070b13',
    accent: '#2ee6ff',
    temp: '#74b4ff',
  },
};

// ── 2. Nautilus — arcane brass & verdigris ──
const nautilus: Theme = {
  id: 'nautilus',
  name: 'Nautilus',
  blurb: 'Arcane brass & verdigris',
  vars: {
    '--bg': '#0a0d0a',
    '--bg2': '#11160f',
    '--bg3': '#181f14',
    '--border': '#3a4429',
    '--accent': '#e6bd57',
    '--accent-dim': '#6b4e1f',
    '--accent-bright': '#f7dc92',
    '--text': '#ddcca4',
    '--text-dim': '#94835c',
    '--danger': '#df5f3e',
    '--heal': '#7bb85f',
    '--temp': '#d6b96a',
    '--glow': '230,189,87',
  },
  damage: {
    pristine: '#6fd6a8',
    damaged: '#e8c44d',
    heavy: '#e0883c',
    critical: '#cf3b2b',
    destroyed: '#3a1c0d',
  },
  schematic: {
    hullFill: '#0c100c',
    hullStroke: '#3e4a2c',
    deco: '#6b5a3a',
    scan: '#e6bd57',
    roomFill: '#e6bd57',
    roomFillOpacity: 0.05,
    roomStroke: '#4a4226',
    roomLabel: '#c2a866',
    water: '#2f7a64',
    shipName: '#5e5331',
    tooltipBg: '#0c100c',
    accent: '#e6bd57',
    temp: '#d6b96a',
  },
};

// ── 3. Crimson Reactor — emergency ember ──
const crimson: Theme = {
  id: 'crimson',
  name: 'Crimson',
  blurb: 'Reactor breach alarm',
  vars: {
    '--bg': '#0c0608',
    '--bg2': '#14090b',
    '--bg3': '#1d0d10',
    '--border': '#4a2222',
    '--accent': '#ff6a48',
    '--accent-dim': '#7a2418',
    '--accent-bright': '#ffa078',
    '--text': '#f2cdbd',
    '--text-dim': '#a46e5e',
    '--danger': '#ff2424',
    '--heal': '#d9aa3c',
    '--temp': '#ff9a6e',
    '--glow': '255,106,72',
  },
  damage: {
    pristine: '#ffd24d',
    damaged: '#ff9a2e',
    heavy: '#ff5e2e',
    critical: '#ff1f1f',
    destroyed: '#4a0808',
  },
  schematic: {
    hullFill: '#100608',
    hullStroke: '#4d2424',
    deco: '#6a3a3a',
    scan: '#ff6a48',
    roomFill: '#ff6a48',
    roomFillOpacity: 0.05,
    roomStroke: '#5a2420',
    roomLabel: '#d68a78',
    water: '#7a2a2a',
    shipName: '#5e2c2c',
    tooltipBg: '#100608',
    accent: '#ff6a48',
    temp: '#ff9a6e',
  },
};

// ── 4. Spectral Bloom — bioluminescent eldritch ──
const spectral: Theme = {
  id: 'spectral',
  name: 'Spectral',
  blurb: 'Bioluminescent bloom',
  vars: {
    '--bg': '#04090a',
    '--bg2': '#0a1113',
    '--bg3': '#0f1b1d',
    '--border': '#1a4a3a',
    '--accent': '#4dffb0',
    '--accent-dim': '#1a6b4a',
    '--accent-bright': '#9affd0',
    '--text': '#c4ecd8',
    '--text-dim': '#5f9a7c',
    '--danger': '#ff5e8a',
    '--heal': '#5effc0',
    '--temp': '#b06eff',
    '--glow': '77,255,176',
  },
  damage: {
    pristine: '#5effc0',
    damaged: '#d6ff5e',
    heavy: '#ffb24d',
    critical: '#ff5e8a',
    destroyed: '#2a0d2a',
  },
  schematic: {
    hullFill: '#050b0a',
    hullStroke: '#1c5040',
    deco: '#2a5a4a',
    scan: '#4dffb0',
    roomFill: '#4dffb0',
    roomFillOpacity: 0.05,
    roomStroke: '#1a5240',
    roomLabel: '#74d6ac',
    water: '#1a6f5a',
    shipName: '#2e5e4e',
    tooltipBg: '#050b0a',
    accent: '#4dffb0',
    temp: '#b06eff',
  },
};

export const THEMES: Theme[] = [abyssal, nautilus, crimson, spectral];

const STORAGE_KEY = 'vessel.theme';

export function loadThemeId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? THEMES[0].id;
  } catch {
    return THEMES[0].id;
  }
}

export function saveThemeId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // storage unavailable — selection just won't persist
  }
}

export function getTheme(id: string): Theme {
  return THEMES.find(t => t.id === id) ?? THEMES[0];
}
