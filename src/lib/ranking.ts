import type { Food, LogEntry, Meal } from '../types';
import { daysBetween } from './dates';

export const HALF_LIFE_DAYS = 14;
export const WINDOW_DAYS = 60;
export const OTHER_MEAL_WEIGHT = 0.25;
export const NEW_FOOD_DAYS = 3;
export const NEW_FOOD_FLOOR = 1;
export const USUAL_LIMIT = 15;

export interface Ranked {
  food: Food;
  score: number;
  lastUsed: number;
}

/**
 * "Your usual" score per food for one meal tab:
 * sum over entries in the last 60 days of 0.5^(ageDays/14) x w_meal,
 * w_meal = 1 for the same meal, 0.25 otherwise.
 * Foods created in the last 3 days get a floor score in the meal they were first logged to.
 */
export function usualScores(foods: Food[], entries: LogEntry[], meal: Meal, today: string, now: number = Date.now()): Map<string, Ranked> {
  const map = new Map<string, Ranked>();
  const byId = new Map(foods.map((f) => [f.id, f]));
  const firstMeal = new Map<string, { meal: Meal; at: number }>();

  for (const e of entries) {
    const food = byId.get(e.foodId);
    if (!food || food.archived) continue;
    const age = daysBetween(e.date, today);
    const first = firstMeal.get(e.foodId);
    if (!first || e.loggedAt < first.at) firstMeal.set(e.foodId, { meal: e.meal, at: e.loggedAt });
    if (age < 0 || age > WINDOW_DAYS) continue;
    const w = e.meal === meal ? 1 : OTHER_MEAL_WEIGHT;
    const s = Math.pow(0.5, age / HALF_LIFE_DAYS) * w;
    const r = map.get(e.foodId) ?? { food, score: 0, lastUsed: 0 };
    r.score += s;
    r.lastUsed = Math.max(r.lastUsed, e.loggedAt);
    map.set(e.foodId, r);
  }

  const cutoff = now - NEW_FOOD_DAYS * 86400000;
  for (const [foodId, first] of firstMeal) {
    const food = byId.get(foodId)!;
    if (food.createdAt >= cutoff && first.meal === meal) {
      const r = map.get(foodId) ?? { food, score: 0, lastUsed: first.at };
      r.score = Math.max(r.score, NEW_FOOD_FLOOR);
      map.set(foodId, r);
    }
  }
  return map;
}

export function rankUsual(foods: Food[], entries: LogEntry[], meal: Meal, today: string, now: number = Date.now(), limit = USUAL_LIMIT): Ranked[] {
  return [...usualScores(foods, entries, meal, today, now).values()]
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.lastUsed - a.lastUsed)
    .slice(0, limit);
}

/** Meal-agnostic usage score, used to break ties in search and voice matching. */
export function usageScores(entries: LogEntry[], today: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) {
    const age = daysBetween(e.date, today);
    if (age < 0 || age > WINDOW_DAYS) continue;
    m.set(e.foodId, (m.get(e.foodId) ?? 0) + Math.pow(0.5, age / HALF_LIFE_DAYS));
  }
  return m;
}
