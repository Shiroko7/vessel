import { useState, useEffect, useCallback } from 'react';
import OBR from '@owlbear-rodeo/sdk';
import type { VesselState, WallStats, RoomStats } from './types';
import { DEFAULT_STATE, METADATA_KEY, LEGACY_METADATA_KEYS, ensureWalls } from './dugongData';

const BROADCAST_CHANNEL = 'com.vessel.state.sync';
// Stable key — intentionally NOT versioned so deploys and schema bumps
// never wipe the local cache. mergeDeep + ensureWalls handle any drift.
const LOCAL_KEY = 'com.vessel.statusmonitor.state.local';

function mergeDeep(defaults: VesselState, saved: Partial<VesselState>): VesselState {
  const rooms = { ...defaults.rooms, ...(saved.rooms ?? {}) };
  const walls = ensureWalls(rooms, { ...defaults.walls, ...(saved.walls ?? {}) });
  return { rooms, walls };
}

function loadLocal(): VesselState | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    return mergeDeep(DEFAULT_STATE, JSON.parse(raw) as Partial<VesselState>);
  } catch {
    return null;
  }
}

function saveLocal(s: VesselState) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(s)); } catch { /* quota / private mode */ }
}

export function useVesselState() {
  // Initialise synchronously from localStorage so the last-known state
  // renders immediately on F5 — no blank flash while waiting for OBR.
  const [state, setState] = useState<VesselState>(() => loadLocal() ?? DEFAULT_STATE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let unsubMeta: (() => void) | null = null;
    let unsubBroadcast: (() => void) | null = null;

    OBR.onReady(async () => {
      // OBR room metadata is the authoritative source; overwrite local cache on load.
      try {
        const meta = await OBR.room.getMetadata();
        let saved = meta[METADATA_KEY] as Partial<VesselState> | undefined;

        // Fall back to the newest legacy versioned key so a room that hasn't
        // been migrated yet doesn't silently render DEFAULT_STATE (a fresh
        // stable/bumped key has no data until someone writes to it).
        const legacyKeysPresent = LEGACY_METADATA_KEYS.filter((k) => meta[k] != null);
        if (!saved && legacyKeysPresent.length > 0) {
          saved = meta[legacyKeysPresent[legacyKeysPresent.length - 1]] as Partial<VesselState>;
        }

        // One-time GM-only cleanup: migrate legacy data forward under the
        // stable key and null out every legacy key so we stop hoarding
        // duplicate ship-state snapshots in the shared 16kB room metadata
        // budget. Read-only players skip this (no permission assumed).
        if (isMounted && legacyKeysPresent.length > 0) {
          const role = await OBR.player.getRole().catch(() => 'PLAYER');
          if (role === 'GM') {
            const cleanup: Record<string, null> = {};
            for (const k of legacyKeysPresent) cleanup[k] = null;
            try {
              await OBR.room.setMetadata({ ...cleanup, [METADATA_KEY]: saved ?? DEFAULT_STATE });
            } catch (e) {
              console.warn('[Vessel] legacy metadata cleanup failed:', e);
            }
          }
        }

        if (saved && isMounted) {
          const merged = mergeDeep(DEFAULT_STATE, saved);
          setState(merged);
          saveLocal(merged);
        }
      } catch {
        // no saved state yet — keep whatever localStorage gave us
      }

      if (!isMounted) return;

      // Primary real-time sync: broadcast from GM → all connected clients.
      unsubBroadcast = OBR.broadcast.onMessage(
        BROADCAST_CHANNEL,
        (event: { data: unknown; connectionId: string }) => {
          const saved = event.data as Partial<VesselState>;
          if (saved) {
            const merged = mergeDeep(DEFAULT_STATE, saved);
            setState(merged);
            saveLocal(merged); // keep local cache current for next F5
          }
        },
      );

      // Fallback: metadata change events (reconnects, missed broadcasts).
      unsubMeta = OBR.room.onMetadataChange((meta: Record<string, unknown>) => {
        const saved = meta[METADATA_KEY] as Partial<VesselState> | undefined;
        if (saved) {
          const merged = mergeDeep(DEFAULT_STATE, saved);
          setState(merged);
          saveLocal(merged);
        }
      });

      setReady(true);
    });

    return () => {
      isMounted = false;
      unsubMeta?.();
      unsubBroadcast?.();
    };
  }, []);

  const persist = useCallback(async (next: VesselState) => {
    saveLocal(next); // synchronous — survives F5 even if OBR calls fail
    try {
      await OBR.room.setMetadata({ [METADATA_KEY]: next });
    } catch (e) {
      console.warn('[Vessel] setMetadata failed:', e);
    }
    try {
      await OBR.broadcast.sendMessage(BROADCAST_CHANNEL, next, { destination: 'REMOTE' });
    } catch (e) {
      console.warn('[Vessel] broadcast failed:', e);
    }
  }, []);

  const updateWall = useCallback((id: string, patch: Partial<WallStats>) => {
    setState(prev => {
      const next: VesselState = {
        ...prev,
        walls: { ...prev.walls, [id]: { ...prev.walls[id], ...patch } },
      };
      persist(next);
      return next;
    });
  }, [persist]);

  const updateRoom = useCallback((id: string, patch: Partial<RoomStats>) => {
    setState(prev => {
      const rooms = { ...prev.rooms, [id]: { ...prev.rooms[id], ...patch } };
      const walls = ensureWalls(rooms, prev.walls);
      const next: VesselState = { rooms, walls };
      persist(next);
      return next;
    });
  }, [persist]);

  const resetAll = useCallback(() => {
    persist(DEFAULT_STATE);
  }, [persist]);

  return { state, ready, updateWall, updateRoom, resetAll };
}
