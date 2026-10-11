import { describe, expect, it } from 'vitest';
import { rankUsual } from '../src/lib/ranking';
import { mealForMinutes } from '../src/lib/meal';
import type { Food, LogEntry, Meal } from '../src/types';

const OLD = Date.UTC(2026, 0, 1);
const NOW = Date.UTC(2026, 9, 11, 12);
const food = (id: string, createdAt = OLD): Food => ({
  id, name: id, basis: 'perItem', kcal: 1, protein: 1, portions: [{ id: 'p', label: '1', amount: 1 }],
  defaultPortionId: 'p', source: 'manual', archived: false, aliases: [], createdAt, updatedAt: createdAt
});
let n = 0;
const entry = (foodId: string, date: string, meal: Meal): LogEntry => ({
  id: String(n++), date, loggedAt: Date.parse(date + 'T12:00:00Z') + n, meal, foodId, portionId: 'p', multiplier: 1, kcal: 1, protein: 1, nameSnapshot: ''
});

describe('your usual', () => {
  it('a food logged at lunch 3 times this week is top 5 at lunch', () => {
    const foods = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'new'].map((id) => food(id));
    const entries: LogEntry[] = [];
    // Older habits: other foods logged at lunch many times 4 to 8 weeks ago
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g'])
      for (let d = 30; d < 58; d += 4) entries.push(entry(id, `2026-0${d < 41 ? 9 : 8}-${String(d < 41 ? 41 - d : 72 - d).padStart(2, '0')}`, 'lunch'));
    // Breakfast staple, heavily used but at breakfast
    for (let d = 1; d <= 9; d++) entries.push(entry('a', `2026-10-0${d}`, 'breakfast'));
    // New habit: 3 lunches this week
    entries.push(entry('new', '2026-10-06', 'lunch'), entry('new', '2026-10-08', 'lunch'), entry('new', '2026-10-10', 'lunch'));
    const top5 = rankUsual(foods, entries, 'lunch', '2026-10-11', NOW).slice(0, 5).map((r) => r.food.id);
    expect(top5).toContain('new');
  });
  it('archived foods never show and entries older than 60 days are ignored', () => {
    const foods = [food('x'), { ...food('y'), archived: true }];
    const entries = [entry('x', '2026-08-01', 'lunch'), entry('y', '2026-10-10', 'lunch')];
    expect(rankUsual(foods, entries, 'lunch', '2026-10-11', NOW)).toEqual([]);
  });
  it('same-meal use outranks other-meal use', () => {
    const foods = [food('x'), food('y')];
    const entries = [entry('x', '2026-10-10', 'breakfast'), entry('x', '2026-10-10', 'breakfast'), entry('y', '2026-10-10', 'lunch')];
    expect(rankUsual(foods, entries, 'lunch', '2026-10-11', NOW)[0].food.id).toBe('y');
  });
  it('new food gets a floor score in its first meal', () => {
    const f = food('fresh', NOW - 86400000);
    const entries = [entry('fresh', '2026-09-01', 'dinner')];
    // Old entry outside window would score 0; the floor keeps it visible at dinner, not lunch
    entries[0].loggedAt = NOW - 1000;
    entries[0].date = '2026-10-11';
    expect(rankUsual([f], entries, 'dinner', '2026-10-11', NOW).length).toBe(1);
    expect(rankUsual([f], entries, 'dinner', '2026-10-11', NOW)[0].score).toBeGreaterThanOrEqual(1);
  });
  it('ties break on most recent use', () => {
    const foods = [food('x'), food('y')];
    const ex = entry('x', '2026-10-10', 'lunch');
    const ey = entry('y', '2026-10-10', 'lunch');
    ey.loggedAt = ex.loggedAt + 1000;
    expect(rankUsual(foods, [ex, ey], 'lunch', '2026-10-11', NOW)[0].food.id).toBe('y');
  });
});

describe('default meal by time', () => {
  const t = (h: number, m: number) => mealForMinutes(h * 60 + m);
  it('follows the PRD table', () => {
    expect(t(4, 0)).toBe('breakfast');
    expect(t(11, 59)).toBe('breakfast');
    expect(t(12, 0)).toBe('lunch');
    expect(t(14, 30)).toBe('lunch');
    expect(t(14, 31)).toBe('snack');
    expect(t(17, 29)).toBe('snack');
    expect(t(17, 30)).toBe('dinner');
    expect(t(21, 59)).toBe('dinner');
    expect(t(22, 0)).toBe('snack');
    expect(t(3, 59)).toBe('snack');
  });
});
