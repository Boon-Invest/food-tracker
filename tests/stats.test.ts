import { describe, expect, it } from 'vitest';
import { kcalState, sevenDay, todayTotals } from '../src/lib/stats';
import type { LogEntry } from '../src/types';

const e = (date: string, kcal: number, protein: number): LogEntry => ({
  id: Math.random().toString(),
  date,
  loggedAt: 0,
  meal: 'lunch',
  foodId: 'f',
  portionId: 'p',
  multiplier: 1,
  kcal,
  protein,
  nameSnapshot: ''
});
const targets = { kcalTarget: 2000, proteinTarget: 150 };

describe('7-day stats', () => {
  it('PRD worked example: 6 days, 11,100 kcal, 870g', () => {
    const today = '2026-10-11';
    const days = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-08', '2026-10-09', '2026-10-10'];
    const kcal = [1800, 1900, 1850, 1700, 2000, 1850]; // 11,100
    const prot = [140, 150, 145, 135, 155, 145]; // 870
    const entries = days.flatMap((d, i) => [e(d, kcal[i] - 500, prot[i] - 40), e(d, 500, 40)]);
    entries.push(e(today, 3000, 10)); // today excluded
    entries.push(e('2026-10-03', 5000, 10)); // 8 days ago, outside window
    const w = sevenDay(entries, today, targets)!;
    expect(w.daysLogged).toBe(6);
    expect(w.avgKcal).toBe(1850);
    expect(w.kcalDiff).toBe(-900);
    expect(w.avgProtein).toBe(145);
    expect(w.proteinDiff).toBe(-30);
  });
  it('returns null with nothing logged', () => {
    expect(sevenDay([e('2026-10-11', 100, 1)], '2026-10-11', targets)).toBeNull();
  });
});

describe('today', () => {
  it('colour rules: 2,030 amber, 2,051 red, 2,000 neutral', () => {
    expect(kcalState(2000, 2000)).toBe('neutral');
    expect(kcalState(2030, 2000)).toBe('amber');
    expect(kcalState(2050, 2000)).toBe('amber');
    expect(kcalState(2051, 2000)).toBe('red');
  });
  it('170g protein is hit, left floored at 0', () => {
    const t = todayTotals([e('2026-10-11', 2100, 170)], '2026-10-11', targets);
    expect(t.proteinHit).toBe(true);
    expect(t.proteinLeft).toBe(0);
    expect(t.kcalLeft).toBe(-100);
  });
});
