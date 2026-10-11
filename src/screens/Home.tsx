import { useMemo, useState } from 'react';
import { useData } from '../data';
import type { LogEntry, Meal } from '../types';
import { MEALS, MEAL_LABELS } from '../types';
import { todayTotals, sevenDay } from '../lib/stats';
import { fmtKcal } from '../lib/calc';
import { defaultMeal } from '../lib/meal';
import { SwipeRow } from '../components/SwipeRow';
import { VoiceBar } from '../components/VoiceBar';
import { GearIcon } from '../components/Icons';

interface Props {
  onOpenLog: (meal: Meal) => void;
  onSettings: () => void;
  onFreeText: (text: string) => void;
  onEditEntry: (e: LogEntry) => void;
  onDeleteEntry: (e: LogEntry) => void;
}

export function Home({ onOpenLog, onSettings, onFreeText, onEditEntry, onDeleteEntry }: Props) {
  const { entries, today, settings } = useData();
  const [text, setText] = useState('');
  const t = todayTotals(entries, today, settings);
  const week = sevenDay(entries, today, settings);
  const timeMeal = defaultMeal();

  const byMeal = useMemo(() => {
    const m = new Map<Meal, LogEntry[]>();
    for (const e of entries.filter((x) => x.date === today).sort((a, b) => a.loggedAt - b.loggedAt)) {
      m.set(e.meal, [...(m.get(e.meal) ?? []), e]);
    }
    return m;
  }, [entries, today]);

  const kcalPct = Math.min(100, (t.kcal / settings.kcalTarget) * 100);
  const protPct = Math.min(100, (t.protein / settings.proteinTarget) * 100);
  const kcalClass = t.kcalState === 'amber' ? 'is-amber' : t.kcalState === 'red' ? 'is-red' : '';

  return (
    <div className="app">
      <div className="topbar">
        <h1>Today</h1>
        <button className="icon-btn" onClick={onSettings} aria-label="Settings"><GearIcon /></button>
      </div>

      <div className="card">
        <div className={'metric ' + kcalClass}>
          <div className="metric-row">
            <span className="metric-big">{t.kcalLeft >= 0 ? `${fmtKcal(t.kcalLeft)} left` : `${fmtKcal(-t.kcalLeft)} over`}</span>
            <span className="metric-sub">Calories: {fmtKcal(t.kcal)} of {fmtKcal(settings.kcalTarget)}</span>
          </div>
          <div className="bar"><div style={{ width: kcalPct + '%' }} /></div>
        </div>
        <div className={'metric ' + (t.proteinHit ? 'is-green' : '')}>
          <div className="metric-row">
            <span className="metric-big">{t.proteinHit ? 'Target hit' : `${t.proteinLeft}g left`}</span>
            <span className="metric-sub">Protein: {Math.round(t.protein * 10) / 10}g of {settings.proteinTarget}g</span>
          </div>
          <div className="bar"><div style={{ width: protPct + '%' }} /></div>
        </div>
      </div>

      <div className="card">
        <h2>Last 7 days</h2>
        {week ? (
          <>
            <div className="week-grid">
              <div>
                <div className="label">Avg calories</div>
                <div className="val">{fmtKcal(week.avgKcal)}</div>
              </div>
              <div>
                <div className="label">Avg protein</div>
                <div className="val">{Math.round(week.avgProtein)}g</div>
              </div>
              <div>
                <div className="label">Calories vs target</div>
                <div className="val">{week.kcalDiff <= 0 ? `${fmtKcal(-week.kcalDiff)} under` : `${fmtKcal(week.kcalDiff)} over`}</div>
                <div className="label">{fmtKcal(week.totalKcal)} of {fmtKcal(week.kcalTarget)}</div>
              </div>
              <div>
                <div className="label">Protein vs target</div>
                <div className="val">{week.proteinDiff < 0 ? `${Math.round(-week.proteinDiff)}g short` : `${Math.round(week.proteinDiff)}g over`}</div>
                <div className="label">{Math.round(week.totalProtein)}g of {week.proteinTarget}g</div>
              </div>
            </div>
            {week.daysLogged < 7 && <div className="note">Based on {week.daysLogged} of 7 days</div>}
          </>
        ) : (
          <div className="note">Not enough data yet</div>
        )}
      </div>

      {byMeal.size === 0 && <div className="empty">Nothing logged today. Tap a meal below, or type what you ate.</div>}
      {MEALS.filter((m) => byMeal.has(m)).map((m) => {
        const list = byMeal.get(m)!;
        const sum = list.reduce((a, e) => ({ k: a.k + e.kcal, p: a.p + e.protein }), { k: 0, p: 0 });
        return (
          <div key={m} className="meal-group">
            <h3>
              <span>{MEAL_LABELS[m]}</span>
              <span>{fmtKcal(sum.k)} kcal · {Math.round(sum.p * 10) / 10}g</span>
            </h3>
            <div className="rows">
              {list.map((e) => (
                <SwipeRow key={e.id} onTap={() => onEditEntry(e)} onDelete={() => onDeleteEntry(e)}>
                  <div className="row-main">
                    <div className="row-name">{e.nameSnapshot}</div>
                  </div>
                  <div className="row-nums">
                    <b>{fmtKcal(e.kcal)}</b> kcal
                    <div className="row-sub">{e.protein}g</div>
                  </div>
                </SwipeRow>
              ))}
            </div>
          </div>
        );
      })}

      <div className="dock">
        <div className="dock-inner">
          <div className="say-row">
            <VoiceBar
              value={text}
              onChange={setText}
              voiceMode={settings.voiceMode}
              placeholder="Type or say it"
              onSubmit={(v) => {
                setText('');
                onFreeText(v);
              }}
            />
            <button className="fab" onClick={() => onOpenLog(timeMeal)}>+ Log</button>
          </div>
          <div className="meal-btns">
            {MEALS.map((m) => (
              <button key={m} className={'meal-btn' + (m === timeMeal ? ' on' : '')} onClick={() => onOpenLog(m)}>
                {MEAL_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
