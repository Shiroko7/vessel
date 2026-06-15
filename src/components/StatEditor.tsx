import { useState } from 'react';
import type { WallStats } from '../types';
import { getDamageLevel } from '../types';
import type { Theme } from '../themes';

interface Props {
  stats: WallStats;
  theme: Theme;
  onSave: (patch: Partial<WallStats>) => void;
  onClose: () => void;
}

export function StatEditor({ stats, theme, onSave, onClose }: Props) {
  const [hp, setHp] = useState<number>(stats.hp);
  const [maxHp, setMaxHp] = useState<number>(stats.maxHp);
  const [tempHp, setTempHp] = useState<number>(stats.tempHp);
  const [ac, setAc] = useState<number>(stats.ac);

  const dmgColor = theme.damage[getDamageLevel(hp, maxHp)];
  const pct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;

  function handleSave() {
    onSave({ hp, maxHp, tempHp, ac });
    onClose();
  }

  return (
    <div className="stat-editor-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="stat-editor">
        <div className="stat-editor-header">
          <span className="stat-editor-title" style={{ color: dmgColor }}>{stats.label}</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="hp-bar-wrap">
          <div className="hp-bar-track">
            <div className="hp-bar-fill" style={{ width: `${pct * 100}%`, background: dmgColor }} />
            {tempHp > 0 && (
              <div
                className="hp-bar-temp"
                style={{ width: `${Math.min(tempHp / maxHp, 1) * 100}%` }}
              />
            )}
          </div>
          <span className="hp-label">{hp + tempHp} / {maxHp} HP{tempHp > 0 ? ` (+${tempHp} tmp)` : ''}</span>
        </div>

        <div className="stat-grid">
          <label>HP
            <input type="number" min={0} max={maxHp} value={hp}
              onChange={e => setHp(Math.max(0, Math.min(maxHp, +e.target.value)))} />
          </label>
          <label>Max HP
            <input type="number" min={1} value={maxHp}
              onChange={e => setMaxHp(Math.max(1, +e.target.value))} />
          </label>
          <label>Temp HP
            <input type="number" min={0} value={tempHp}
              onChange={e => setTempHp(Math.max(0, +e.target.value))} />
          </label>
          <label>Armor Class
            <input type="number" min={0} value={ac}
              onChange={e => setAc(Math.max(0, +e.target.value))} />
          </label>
        </div>

        <div className="quick-damage">
          <span className="qdmg-label">Quick Damage</span>
          {[5, 10, 25, 50].map(v => (
            <button key={v} className="qdmg-btn dmg"
              onClick={() => {
                if (tempHp >= v) {
                  setTempHp(t => t - v);
                } else {
                  const overflow = v - tempHp;
                  setTempHp(0);
                  setHp(h => Math.max(0, h - overflow));
                }
              }}>
              -{v}
            </button>
          ))}
          {[5, 10, 25].map(v => (
            <button key={v} className="qdmg-btn heal"
              onClick={() => setHp(h => Math.min(maxHp, h + v))}>
              +{v}
            </button>
          ))}
        </div>

        <div className="stat-editor-actions">
          <button className="btn-save" onClick={handleSave}>Apply</button>
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
