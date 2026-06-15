import { useState } from 'react';
import type { RoomStats } from '../types';
import type { Theme } from '../themes';

interface Props {
  room: RoomStats;
  theme: Theme;
  onSave: (patch: Partial<RoomStats>) => void;
  onClose: () => void;
}

export function RoomEditor({ room, theme, onSave, onClose }: Props) {
  const [label, setLabel] = useState(room.label);
  const accent = theme.schematic.accent;

  function handleSave() {
    const trimmed = label.trim();
    if (trimmed) onSave({ label: trimmed });
    onClose();
  }

  return (
    <div className="stat-editor-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="stat-editor">
        <div className="stat-editor-header">
          <span className="stat-editor-title" style={{ color: accent }}>Rename Room</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="stat-grid" style={{ gridTemplateColumns: '1fr' }}>
          <label>Room Name
            <input type="text" value={label} autoFocus
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose(); }} />
          </label>
        </div>

        <div className="stat-editor-actions">
          <button className="btn-save" onClick={handleSave}>Apply</button>
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
