import { useState, useEffect, useCallback } from 'react';
import OBR from '@owlbear-rodeo/sdk';
import type { VesselState, WallStats, RoomStats } from './types';
import { DEFAULT_STATE, METADATA_KEY, ensureWalls } from './dugongData';

function mergeDeep(defaults: VesselState, saved: Partial<VesselState>): VesselState {
  const rooms = { ...defaults.rooms, ...(saved.rooms ?? {}) };
  const walls = ensureWalls(rooms, { ...defaults.walls, ...(saved.walls ?? {}) });
  return { rooms, walls };
}

export function useVesselState() {
  const [state, setState] = useState<VesselState>(DEFAULT_STATE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    OBR.onReady(async () => {
      try {
        const meta = await OBR.room.getMetadata();
        const saved = meta[METADATA_KEY] as Partial<VesselState> | undefined;
        if (saved) setState(mergeDeep(DEFAULT_STATE, saved));
      } catch {
        // no saved state yet
      }

      OBR.room.onMetadataChange((meta: Record<string, unknown>) => {
        const saved = meta[METADATA_KEY] as Partial<VesselState> | undefined;
        if (saved) setState(mergeDeep(DEFAULT_STATE, saved));
      });

      setReady(true);
    });
  }, []);

  const persist = useCallback(async (next: VesselState) => {
    setState(next);
    try {
      await OBR.room.setMetadata({ [METADATA_KEY]: next });
    } catch {
      // offline / no permission — state still updates locally
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
      // re-derive walls so geometry/labels track the room change (HP preserved)
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
