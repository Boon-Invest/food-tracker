import type { LogEntry, Settings } from '../types';
import { addDays } from './dates';

export interface Today {
  kcal: number;
  protein: number;
  kcalLeft: number; // can be negative
  proteinLeft: number; // floored at 0
  kcalState: 'neutral' | 'amber' | 'red';
  proteinHit: boolean;
}

export function todayTotals(entries: LogEntry[], today: string, s: Pick<Settings, 'kcalTarget' | 'proteinTarget'>): Today {
  let kcal = 0;
  let protein = 0;
  for (const e of entries) {
    if (e.date !== today) continue;
    kcal += e.kcal;
    protein += e.protein;
  }
  protein = Math.round(protein * 10) / 10;
  return {
    kcal,
    protein,
    kcalLeft: s.kcalTarget - kcal,
    proteinLeft: Math.max(0, Math.round((s.proteinTarget - protein) * 10) / 10),
    kcalState: kcalState(kcal, s.kcalTarget),
    proteinHit: protein >= s.proteinTarget
  };
}

/** Neutral up to target, amber 1 to 50 over, red beyond 50 over. */
export function kcalState(kcal: number, target: number): 'neutral' | 'amber' | 'red' {
  const over = kcal - target;
  if (over <= 0) return 'neutral';
  if (over <= 50) return 'amber';
  return 'red';
}

export interface Week {
  daysLogged: number;
  totalKcal: number;
  totalProtein: number;
  avgKcal: number;
  avgProtein: number;
  kcalTarget: number; // kcal target x N
  proteinTarget: number; // protein target x N
  kcalDiff: number; // total minus target (negative = under)
  proteinDiff: number;
}

/** The 7 completed days before today, ignoring days with nothing logged. Null if N = 0. */
export function sevenDay(entries: LogEntry[], today: string, s: Pick<Settings, 'kcalTarget' | 'proteinTarget'>): Week | null {
  const start = addDays(today, -7);
  const days = new Set<string>();
  let totalKcal = 0;
  let totalProtein = 0;
  for (const e of entries) {
    if (e.date < start || e.date >= today) continue;
    days.add(e.date);
    totalKcal += e.kcal;
    totalProtein += e.protein;
  }
  const n = days.size;
  if (n === 0) return null;
  totalProtein = Math.round(totalProtein * 10) / 10;
  return {
    daysLogged: n,
    totalKcal,
    totalProtein,
    avgKcal: totalKcal / n,
    avgProtein: totalProtein / n,
    kcalTarget: s.kcalTarget * n,
    proteinTarget: s.proteinTarget * n,
    kcalDiff: totalKcal - s.kcalTarget * n,
    proteinDiff: Math.round((totalProtein - s.proteinTarget * n) * 10) / 10
  };
}
