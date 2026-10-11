import { useState } from 'react';
import { Sheet } from './Sheet';
import { FoodPicker } from './FoodPicker';
import { AddFood } from './AddFood';
import { useData } from '../data';
import type { Food, Meal, Portion } from '../types';
import { MEALS, MEAL_LABELS } from '../types';
import { matchPhrase, parseText, type ParsedPhrase } from '../lib/parser';
import { entryNutrition, findPortion, fmtKcal } from '../lib/calc';
import { buildEntry, ensurePortion, learnAlias } from '../store';
import { db } from '../db';
import type { LogEntry } from '../types';

interface Row {
  key: number;
  parsed: ParsedPhrase;
  food: Food | null;
  portion: Portion | null;
  newPortion?: Portion; // to save on the food when logging
  multiplier: number;
  low: boolean;
}

function buildRows(text: string, foods: Food[], usage: Map<string, number>): Row[] {
  return parseText(text).map((parsed, i) => {
    const m = matchPhrase(parsed, foods, usage);
    return {
      key: i,
      parsed,
      food: m?.food ?? null,
      portion: m?.portion ?? null,
      newPortion: m?.needsPortion,
      multiplier: m?.multiplier ?? parsed.qty,
      low: m ? m.confidence === 'low' : false
    };
  });
}

export function ConfirmSheet({ text, meal: initialMeal, onLogged, onClose }: { text: string; meal: Meal; onLogged: (entries: LogEntry[]) => void; onClose: () => void }) {
  const { foods, usage } = useData();
  const [rows, setRows] = useState<Row[]>(() => buildRows(text, foods, usage));
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [picking, setPicking] = useState<Row | null>(null);
  const [adding, setAdding] = useState<{ row: Row; name: string } | null>(null);

  const setRow = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const choose = async (row: Row, food: Food, learn: boolean) => {
    // Same portion logic as the parser, but forced onto the chosen food
    const m = matchPhrase(row.parsed, [{ ...food, name: row.parsed.query || food.name, aliases: [] }]);
    const portion = m?.portion ?? findPortion(food);
    setRow(row.key, { food, portion, newPortion: m?.needsPortion, multiplier: m?.multiplier ?? row.parsed.qty, low: false });
    if (learn && row.parsed.query) await learnAlias(food.id, row.parsed.query);
  };

  const ok = rows.filter((r) => r.food && r.portion && r.multiplier > 0);
  const bad = rows.some((r) => !r.food);
  const total = ok.reduce(
    (a, r) => {
      const n = entryNutrition(r.food!, r.portion!.amount, r.multiplier);
      return { kcal: a.kcal + n.kcal, protein: a.protein + n.protein };
    },
    { kcal: 0, protein: 0 }
  );

  const logAll = async () => {
    const now = Date.now();
    const entries: LogEntry[] = [];
    for (const [i, r] of ok.entries()) {
      if (r.newPortion) await ensurePortion(r.food!.id, r.newPortion);
      entries.push(buildEntry(r.food!, r.portion!, r.multiplier, meal, now + i));
    }
    await db.entries.bulkAdd(entries);
    onLogged(entries);
  };

  if (picking) {
    return (
      <FoodPicker
        initial={picking.parsed.query}
        onClose={() => setPicking(null)}
        onPick={(f) => {
          choose(picking, f, true);
          setPicking(null);
        }}
        onAddNew={(name) => {
          setAdding({ row: picking, name });
          setPicking(null);
        }}
      />
    );
  }
  if (adding) {
    return (
      <AddFood
        mode="quick"
        initialName={adding.name}
        pickOnly
        onDone={(r) => {
          if (r) choose(adding.row, r.food, true);
          setAdding(null);
        }}
      />
    );
  }

  return (
    <Sheet onClose={onClose}>
      <h2>Check and log</h2>
      <div className="sub">"{text}"</div>
      <div className="tabs">
        {MEALS.map((x) => (
          <button key={x} className={'tab' + (x === meal ? ' on' : '')} onClick={() => setMeal(x)}>
            {MEAL_LABELS[x]}
          </button>
        ))}
      </div>

      {rows.length === 0 && <div className="empty">Nothing recognised. Try "2 eggs, toast, large apple".</div>}

      {rows.map((r) => {
        if (!r.food) {
          return (
            <div key={r.key} className="c-row bad">
              <div className="c-top">
                <div className="c-food">
                  "{r.parsed.phrase}"<small>Not found in your library</small>
                </div>
                <button className="x" onClick={() => setRows(rows.filter((x) => x.key !== r.key))} aria-label="Remove">×</button>
              </div>
              <div className="c-ctrls">
                <button className="btn" style={{ height: 40 }} onClick={() => setPicking(r)}>Pick food</button>
                <button className="btn primary" style={{ height: 40 }} onClick={() => setAdding({ row: r, name: r.parsed.query })}>Add as new food</button>
                <button className="btn" style={{ height: 40 }} onClick={() => setRows(rows.filter((x) => x.key !== r.key))}>Remove</button>
              </div>
            </div>
          );
        }
        const n = entryNutrition(r.food, r.portion!.amount, r.multiplier || 0);
        const portions = r.newPortion && !r.food.portions.some((p) => p.id === r.newPortion!.id) ? [...r.food.portions, r.newPortion] : r.food.portions;
        return (
          <div key={r.key} className={'c-row' + (r.low ? ' low' : '')}>
            <div className="c-top">
              <button className="c-food" onClick={() => setPicking(r)}>
                {r.food.name}
                <small>
                  "{r.parsed.phrase}"{r.low ? ' · check this' : ''} · tap to change
                </small>
              </button>
              <div className="row-nums">
                <b>{fmtKcal(n.kcal)}</b> kcal
                <div className="row-sub">{n.protein}g</div>
              </div>
              <button className="x" onClick={() => setRows(rows.filter((x) => x.key !== r.key))} aria-label="Remove">×</button>
            </div>
            <div className="c-ctrls">
              <select value={r.portion!.id} onChange={(e) => setRow(r.key, { portion: portions.find((p) => p.id === e.target.value)!, low: false })}>
                {portions.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <span className="muted">×</span>
              <input
                inputMode="decimal"
                defaultValue={String(Math.round(r.multiplier * 100) / 100)}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setRow(r.key, { multiplier: v > 0 ? v : 0, low: false });
                }}
              />
            </div>
          </div>
        );
      })}

      <div className="btn-row">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!ok.length} onClick={logAll}>
          Log {ok.length > 1 ? `all ${ok.length}` : ok.length === 1 ? '1 item' : ''} · {fmtKcal(total.kcal)} kcal
        </button>
      </div>
      {bad && <div className="tiny muted" style={{ marginTop: 8 }}>Red items won't be logged until you pick or add a food.</div>}
    </Sheet>
  );
}
