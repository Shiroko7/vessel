import { useState, useEffect } from 'react';
import { useVesselState } from './useVesselState';
import { DugongSchematic } from './components/DugongSchematic';
import { StatEditor } from './components/StatEditor';
import { RoomEditor } from './components/RoomEditor';
import { THEMES, getTheme, loadThemeId, saveThemeId } from './themes';
import './App.css';

export default function App() {
  const { state, ready, updateWall, updateRoom } = useVesselState();
  const [selectedWall, setSelectedWall] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [themeId, setThemeId] = useState<string>(() => loadThemeId());

  const theme = getTheme(themeId);

  useEffect(() => { saveThemeId(themeId); }, [themeId]);

  if (!ready) {
    return (
      <div className="loading" style={theme.vars as React.CSSProperties}>
        <div className="loading-text">Initialising vessel systems...</div>
      </div>
    );
  }

  const selectedStats = selectedWall ? state.walls[selectedWall] : null;
  const selectedRoomStats = selectedRoom ? state.rooms[selectedRoom] : null;

  return (
    <div className="app" style={theme.vars as React.CSSProperties}>
      <header className="app-header">
        <div className="header-sigil">⬡</div>
        <h1 className="header-title">VESSEL STATUS MONITOR</h1>
        <div className="header-sub">CLASS: DUGONG</div>

        <button
          className={`edit-btn${editMode ? ' active' : ''}`}
          onClick={() => { setEditMode(e => !e); setSelectedWall(null); }}
        >
          {editMode ? '✓ Editing Layout' : '✎ Edit Layout'}
        </button>

        <div className="theme-switch" role="group" aria-label="Display theme">
          {THEMES.map(t => (
            <button
              key={t.id}
              className={`theme-btn${t.id === themeId ? ' active' : ''}`}
              title={`${t.name} — ${t.blurb}`}
              onClick={() => setThemeId(t.id)}
            >
              <span className="theme-swatch" style={{ background: t.vars['--accent'] }} />
              <span className="theme-name">{t.name}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="app-main">
        <DugongSchematic
          state={state}
          theme={theme}
          editMode={editMode}
          onSelectWall={(id) => setSelectedWall(id)}
          onSelectRoom={(id) => setSelectedRoom(id)}
          onUpdateRoom={updateRoom}
        />

        <div className="legend">
          <div className="legend-item"><span className="legend-dot" style={{ background: theme.damage.pristine }} />Pristine</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: theme.damage.damaged }} />Damaged</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: theme.damage.heavy }} />Heavy</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: theme.damage.critical }} />Critical</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: theme.damage.destroyed, border: '1px solid #880000' }} />Destroyed</div>
          <div className="legend-hint">
            {editMode ? 'Drag rooms to move · drag edges to resize · click to rename' : 'Click any hull section to edit'}
          </div>
        </div>
      </main>

      {!editMode && selectedWall && selectedStats && (
        <StatEditor
          stats={selectedStats}
          theme={theme}
          onSave={(patch) => updateWall(selectedWall, patch)}
          onClose={() => setSelectedWall(null)}
        />
      )}

      {editMode && selectedRoom && selectedRoomStats && (
        <RoomEditor
          room={selectedRoomStats}
          theme={theme}
          onSave={(patch) => updateRoom(selectedRoom, patch)}
          onClose={() => setSelectedRoom(null)}
        />
      )}
    </div>
  );
}
