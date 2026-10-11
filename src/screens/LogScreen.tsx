import { useEffect, useMemo, useState } from 'react';
import { useData } from '../data';
import type { Food, LogEntry, Meal, SavedMeal } from '../types';
import { MEALS, MEAL_LABELS } from '../types';
import { rankUsual } from '../lib/ranking';
import { searchFoods } from '../lib/search';
import { addDays } from '../lib/dates';
import { fmtKcal } from '../lib/calc';
import { todayTotals } from '../lib/stats';
import { copyMeal, lastDayWithMeal, logFood, logSavedMeal, logWithChoice, saveMealFromEntries } from '../store';
import { db } from '../db';
import { FoodRow } from '../components/FoodRow';
import { QuantitySheet } from '../components/QuantitySheet';
import { VoiceBar } from '../components/VoiceBar';
import { BackIcon, ScanIcon } from '../components/Icons';

interface Props {
  meal: Meal;
  onMealChange: (m: Meal) => void;
  onDone: () => void;
  onLogged: (entries: LogEntry[]) => void;
  onAddNew: (name: string) => void;
  onScan: () => void;
  onQuickAdd: () => void;
  onFreeText: (text: string) => void;
}

function shortDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function LogScreen({ meal, onMealChange, onDone, onLogged, onAddNew, onScan, onQuickAdd, onFreeText }: Props) {
  const { foods, entries, today, usage, savedMeals, settings } = useData();
  const [q, setQ] = useState('');
  const [sheetFood, setSheetFood] = useState<Food | null>(null);
  const [copyFrom, setCopyFrom] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    lastDayWithMeal(meal, today).then((d) => live && setCopyFrom(d));
    return () => {
      live = false;
    };
  }, [meal, today, entries.length]);

  const usual = useMemo(() => rankUsual(foods, entries, meal, today), [foods, entries, meal, today]);
  const results = useMemo(() => (q.trim() ? searchFoods(q, foods, usage) : []), [q, foods, usage]);
  const mealSaved = savedMeals.filter((s) => s.meal === meal);
  const todayMeal = entries.filter((e) => e.date === today && e.meal === meal);
  const t = todayTotals(entries, today, settings);

  // Library fallback while there's no history yet: show seeded regulars first
  const starter = useMemo(() => (usual.length < 5 ? foods
            .filter((f) => !f.archived && !usual.some((u) => u.food.id === f.id))
            .sort((a, b) => a.createdAt - b.createdAt)
            .slice(0, 15 - usual.length) : []), [usual, foods]);

  const tapLog = async (f: Food) => {
    const e = await logFood(f, meal);
    onLogged([e]);
  };

  const logSaved = async (sm: SavedMeal) => onLogged(await logSavedMeal(sm, meal));

  const copy = async () => {
    if (!copyFrom) return;
    onLogged(await copyMeal(copyFrom, meal));
  };

  const saveAsMeal = async () => {
    const name = window.prompt(`Name this saved ${MEAL_LABELS[meal].toLowerCase()}`, `Usual ${MEAL_LABELS[meal].toLowerCase()}`);
    if (name?.trim()) await saveMealFromEntries(name, meal, todayMeal);
  };

  const yesterday = addDays(today, -1);

  return (
    <div className="app">
      <div className="log-head">
        <div className="topbar" style={{ marginBottom: 8 }}>
          <button className="icon-btn" onClick={onDone} aria-label="Back"><BackIcon /></button>
          <h1>Log {MEAL_LABELS[meal].toLowerCase()}</h1>
          <button className="icon-btn" onClick={onScan} aria-label="Scan barcode"><ScanIcon /></button>
        </div>
        <div className="tabs">
          {MEALS.map((m) => (
            <button key={m} className={'tab' + (m === meal ? ' on' : '')} onClick={() => onMealChange(m)}>
              {MEAL_LABELS[m]}
            </button>
          ))}
        </div>
        <VoiceBar
          value={q}
          onChange={setQ}
          voiceMode={settings.voiceMode}
          placeholder="Search, type or say it"
          onSubmit={(text) => {
            // A list ("eggs, toast") or a spoken phrase goes to the confirm sheet; a plain search stays a search
            if (/,|\band\b|\bwith\b|\bplus\b|\d/.test(text) || results.length === 0) {
              setQ('');
              onFreeText(text);
            }
          }}
        />
      </div>

      {q.trim() ? (
        <>
          <div className="rows">
            {results.map((f) => (
              <FoodRow key={f.id} food={f} onTap={() => tapLog(f)} onMore={() => setSheetFood(f)} />
            ))}
            <button className="row" onClick={() => onAddNew(q.trim())}>
              <div className="row-main link">Add "{q.trim()}" as new food</div>
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="section-title">Your usual</div>
          <div className="rows">
            {usual.map((r) => (
              <FoodRow key={r.food.id} food={r.food} onTap={() => tapLog(r.food)} onMore={() => setSheetFood(r.food)} />
            ))}
            {starter.map((f) => (
              <FoodRow key={f.id} food={f} onTap={() => tapLog(f)} onMore={() => setSheetFood(f)} />
            ))}
          </div>

          {(mealSaved.length > 0 || copyFrom || todayMeal.length > 1) && <div className="section-title">Meals</div>}
          <div className="rows">
            {mealSaved.map((sm) => (
              <div key={sm.id} className="row" style={{ padding: 0 }}>
                <button className="row" style={{ flex: 1 }} onClick={() => logSaved(sm)}>
                  <div className="row-main">
                    <div className="row-name">{sm.name}</div>
                    <div className="row-sub">{sm.items.length} items, one tap</div>
                  </div>
                </button>
                <button
                  className="chev"
                  aria-label="Delete saved meal"
                  onClick={() => window.confirm(`Delete saved meal "${sm.name}"?`) && db.savedMeals.delete(sm.id)}
                >
                  ×
                </button>
              </div>
            ))}
            {copyFrom && (
              <button className="row" onClick={copy}>
                <div className="row-main">
                  <div className="row-name">
                    {copyFrom === yesterday ? `Copy yesterday's ${MEAL_LABELS[meal].toLowerCase()}` : `Copy ${MEAL_LABELS[meal].toLowerCase()} from ${shortDay(copyFrom)}`}
                  </div>
                  <div className="row-sub">
                    {entries.filter((e) => e.date === copyFrom && e.meal === meal).map((e) => e.nameSnapshot.split(',')[0]).join(', ')}
                  </div>
                </div>
              </button>
            )}
            {todayMeal.length > 1 && (
              <button className="row" onClick={saveAsMeal}>
                <div className="row-main link">Save today's {MEAL_LABELS[meal].toLowerCase()} as a saved meal</div>
              </button>
            )}
          </div>
          <div className="spacer" />
          <button className="btn block" onClick={onQuickAdd}>Quick add a new food</button>
        </>
      )}

      <div className="log-dock">
        <div className="today-strip">
          Today: {fmtKcal(t.kcal)} kcal · {Math.round(t.protein * 10) / 10}g
          {todayMeal.length ? ` · ${MEAL_LABELS[meal]}: ${todayMeal.length} item${todayMeal.length > 1 ? 's' : ''}` : ''}
        </div>
        <div className="dock-inner">
          <button className="btn" style={{ flex: '0 0 auto' }} onClick={onScan}>
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ScanIcon /> Scan</span>
          </button>
          <button className="btn primary" style={{ flex: 1 }} onClick={onDone}>Done</button>
        </div>
      </div>

      {sheetFood && (
        <QuantitySheet
          food={sheetFood}
          confirmLabel="Add"
          onClose={() => setSheetFood(null)}
          onConfirm={async (pid, mult) => {
            const e = await logWithChoice(sheetFood, meal, pid, mult);
            setSheetFood(null);
            onLogged([e]);
          }}
        />
      )}
    </div>
  );
}
