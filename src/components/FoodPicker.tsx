import { useState } from 'react';
import { useData } from '../data';
import { searchFoods } from '../lib/search';
import type { Food } from '../types';
import { BackIcon } from './Icons';

/** Full-screen search to choose a food, used to correct a voice match. */
export function FoodPicker({ initial, onPick, onClose, onAddNew }: { initial: string; onPick: (f: Food) => void; onClose: () => void; onAddNew: (name: string) => void }) {
  const { foods, usage } = useData();
  const [q, setQ] = useState(initial);
  const results = searchFoods(q, foods, usage);
  return (
    <div className="overlay">
      <div className="overlay-inner">
        <div className="topbar">
          <button className="icon-btn" onClick={onClose} aria-label="Back"><BackIcon /></button>
          <h1>Choose food</h1>
          <span style={{ width: 40 }} />
        </div>
        <input autoFocus value={q} placeholder="Search library" onChange={(e) => setQ(e.target.value)} />
        <div className="spacer" />
        <div className="rows">
          {results.map((f) => (
            <button key={f.id} className="row" onClick={() => onPick(f)}>
              <div className="row-main">
                <div className="row-name">{f.name}</div>
                {f.brand && <div className="row-sub">{f.brand}</div>}
              </div>
            </button>
          ))}
          {q.trim() && (
            <button className="row" onClick={() => onAddNew(q.trim())}>
              <div className="row-main link">Add "{q.trim()}" as new food</div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
