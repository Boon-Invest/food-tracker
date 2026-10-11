import { useState } from 'react';
import { Sheet } from './Sheet';
import type { Food, Meal } from '../types';
import { MEALS, MEAL_LABELS } from '../types';
import { entryNutrition, findPortion, fmtKcal } from '../lib/calc';
import { addPortion } from '../store';

const CHIPS = [0.5, 1, 1.5, 2];

interface Props {
  food: Food;
  portionId?: string;
  multiplier?: number;
  meal?: Meal; // shown as tabs when editing an entry
  confirmLabel: string;
  onConfirm: (portionId: string, multiplier: number, meal?: Meal) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function QuantitySheet({ food: initialFood, portionId, multiplier, meal, confirmLabel, onConfirm, onDelete, onClose }: Props) {
  const [food, setFood] = useState(initialFood);
  const [pid, setPid] = useState(findPortion(initialFood, portionId).id);
  const [mult, setMult] = useState(multiplier ?? initialFood.defaultMultiplier ?? 1);
  const [custom, setCustom] = useState(CHIPS.includes(multiplier ?? 1) ? '' : String(multiplier));
  const [m, setM] = useState<Meal | undefined>(meal);
  const [adding, setAdding] = useState(false);
  const [pLabel, setPLabel] = useState('');
  const [pAmount, setPAmount] = useState('');

  const portion = findPortion(food, pid);
  const n = entryNutrition(food, portion.amount, mult || 0);
  const unit = food.basis === 'per100ml' ? 'ml' : food.basis === 'per100g' ? 'g' : '× item';

  const savePortion = async () => {
    const amount = parseFloat(pAmount);
    if (!pLabel.trim() || !(amount > 0)) return;
    const p = await addPortion(food, pLabel.trim(), amount);
    setFood({ ...food, portions: [...food.portions, p] });
    setPid(p.id);
    setAdding(false);
    setPLabel('');
    setPAmount('');
  };

  return (
    <Sheet onClose={onClose}>
      <h2>{food.name}</h2>
      <div className="sub">
        {food.basis === 'perItem' ? `${food.kcal} kcal · ${food.protein}g per item` : `${food.kcal} kcal · ${food.protein}g per 100${unit}`}
      </div>

      {m && (
        <div className="tabs">
          {MEALS.map((x) => (
            <button key={x} className={'tab' + (x === m ? ' on' : '')} onClick={() => setM(x)}>
              {MEAL_LABELS[x]}
            </button>
          ))}
        </div>
      )}

      <div className="chips">
        {food.portions.map((p) => (
          <button key={p.id} className={'chip' + (p.id === pid ? ' on' : '')} onClick={() => setPid(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="chips">
        {CHIPS.map((c) => (
          <button
            key={c}
            className={'chip' + (c === mult && !custom ? ' on' : '')}
            onClick={() => {
              setMult(c);
              setCustom('');
            }}
          >
            ×{c}
          </button>
        ))}
        <input
          className="chip-input"
          inputMode="decimal"
          placeholder="×…"
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value);
            const v = parseFloat(e.target.value);
            if (v > 0) setMult(v);
          }}
        />
      </div>

      <div className="preview">
        {fmtKcal(n.kcal)} kcal <span>· {n.protein}g protein</span>
      </div>

      {adding ? (
        <div className="card">
          <div className="field-row">
            <div className="field">
              <label>Label</label>
              <input value={pLabel} placeholder="e.g. large" onChange={(e) => setPLabel(e.target.value)} />
            </div>
            <div className="field">
              <label>{food.basis === 'perItem' ? 'Multiplier' : unit === 'ml' ? 'Millilitres' : 'Grams'}</label>
              <input inputMode="decimal" value={pAmount} onChange={(e) => setPAmount(e.target.value)} />
            </div>
          </div>
          <div className="btn-row">
            <button className="btn" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn primary" onClick={savePortion}>Save portion</button>
          </div>
        </div>
      ) : (
        <button className="link" onClick={() => setAdding(true)}>+ Add portion size</button>
      )}

      <div className="btn-row">
        {onDelete && (
          <button className="btn danger" onClick={onDelete}>Delete</button>
        )}
        <button className="btn primary" disabled={!(mult > 0)} onClick={() => onConfirm(pid, mult, m)}>
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
