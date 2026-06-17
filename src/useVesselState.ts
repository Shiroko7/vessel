import { useState, useEffect, useCallback } from 'react';
import OBR from '@owlbear-rodeo/sdk';
import type { VesselState, WallStats, RoomStats } from './types';
import { DEFAULT_STATE, METADATA_KEY, ensureWalls } from './dugongData';

const BROADCAST_CHANNEL = 'com.vessel.state.sync';

function mergeDeep(defaults: VesselState, saved: Partial<VesselState>): VesselState {
  const rooms = { ...defaults.rooms, ...(saved.rooms ?? {}) };
  const walls = ensureWalls(rooms, { ...defaults.walls, ...(saved.walls ?? {}) });
  return { rooms, walls };
}

export function useVesselState() {
  const [state, setState] = useState<VesselState>(DEFAULT_STATE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let unsubMeta: (() => void) | null = null;
    let unsubBroadcast: (() => void) | null = null;

    OBR.onReady(async () => {
      try {
        const meta = await OBR.room.getMetadata();
        const saved = meta[METADATA_KEY] as Partial<VesselState> | undefined;
        if (saved && isMounted) setState(mergeDeep(DEFAULT_STATE, saved));
      } catch {
        // no saved state yet
      }

      if (!isMounted) return;

      // Primary real-time sync: broadcast pushes state to all connected clients immediately
      unsubBroadcast = OBR.broadcast.onMessage(
        BROADCAST_CHANNEL,
        (event: { data: unknown; connectionId: string }) => {
          const saved = event.data as Partial<VesselState>;
          if (saved) setState(mergeDeep(DEFAULT_STATE, saved));
        },
      );

      // Fallback: metadata change events cover reconnects and missed broadcasts
      unsubMeta = OBR.room.onMetadataChange((meta: Record<string, unknown>) => {
        const saved = meta[METADATA_KEY] as Partial<VesselState> | undefined;
        if (saved) setState(mergeDeep(DEFAULT_STATE, saved));
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
    // Persist to room metadata so new/reconnected clients load the latest state
    try {
      await OBR.room.setMetadata({ [METADATA_KEY]: next });
    } catch (e) {
      console.warn('[Vessel] setMetadata failed:', e);
    }
    // Push to all other connected clients immediately
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
