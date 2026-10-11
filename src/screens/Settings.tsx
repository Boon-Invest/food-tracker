import { useState } from 'react';
import { useData } from '../data';
import { saveSettings } from '../db';
import type { Food } from '../types';
import { searchFoods } from '../lib/search';
import { speechCtor } from '../lib/speech';
import { BackIcon } from '../components/Icons';

export function Settings({ onBack, onEditFood, onAddFood }: { onBack: () => void; onEditFood: (f: Food) => void; onAddFood: () => void }) {
  const { settings, foods, usage } = useData();
  const [kcal, setKcal] = useState(String(settings.kcalTarget));
  const [protein, setProtein] = useState(String(settings.proteinTarget));
  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const commit = () => {
    const k = parseInt(kcal, 10);
    const p = parseInt(protein, 10);
    saveSettings({
      kcalTarget: k > 0 ? k : settings.kcalTarget,
      proteinTarget: p > 0 ? p : settings.proteinTarget
    });
  };

  const list = q.trim()
    ? searchFoods(q, showArchived ? foods.map((f) => ({ ...f, archived: false })) : foods, usage, 200).map((f) => foods.find((x) => x.id === f.id)!)
    : [...foods].filter((f) => showArchived || !f.archived).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="app" style={{ paddingBottom: 40 }}>
      <div className="topbar">
        <button className="icon-btn" onClick={() => { commit(); onBack(); }} aria-label="Back"><BackIcon /></button>
        <h1>Settings</h1>
        <span style={{ width: 40 }} />
      </div>

      <div className="card">
        <h2>Daily targets</h2>
        <div className="field-row">
          <div className="field">
            <label>Calories (kcal)</label>
            <input inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} onBlur={commit} />
          </div>
          <div className="field">
            <label>Protein (g)</label>
            <input inputMode="numeric" value={protein} onChange={(e) => setProtein(e.target.value)} onBlur={commit} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Voice</h2>
        <div className="seg">
          <button className={settings.voiceMode === 'safari' ? 'on' : ''} onClick={() => saveSettings({ voiceMode: 'safari' })}>Safari speech</button>
          <button className={settings.voiceMode === 'keyboard' ? 'on' : ''} onClick={() => saveSettings({ voiceMode: 'keyboard' })}>Keyboard dictation</button>
        </div>
        <div className="tiny muted">
          Speech recognition {speechCtor() ? 'is available' : 'is not available'} on this device. If it misbehaves, switch to keyboard dictation.
        </div>
      </div>

      <div className="card">
        <h2>Food library ({foods.filter((f) => !f.archived).length})</h2>
        <input value={q} placeholder="Search foods" onChange={(e) => setQ(e.target.value)} />
        <div className="btn-row" style={{ marginBottom: 8 }}>
          <button className="btn" onClick={onAddFood}>+ Add food</button>
          <button className="btn" onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'Hide archived' : 'Show archived'}</button>
        </div>
      </div>
      <div className="rows settings-list">
        {list.map((f) => (
          <button key={f.id} className="row" onClick={() => onEditFood(f)}>
            <div className="row-main">
              <div className="row-name">{f.name}{f.archived ? ' (archived)' : ''}</div>
              <div className="row-sub">
                {f.basis === 'perItem' ? `${f.kcal} kcal · ${f.protein}g per item` : `${f.kcal} kcal · ${f.protein}g per 100${f.basis === 'per100ml' ? 'ml' : 'g'}`}
                {f.brand ? ` · ${f.brand}` : ''}
              </div>
            </div>
            <span className="chev">›</span>
          </button>
        ))}
      </div>
      <div className="tiny muted" style={{ textAlign: 'center', marginTop: 16 }}>
        Data is stored on this phone only. Barcode data from Open Food Facts (ODbL).
      </div>
    </div>
  );
}
