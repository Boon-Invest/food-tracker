import type { Food, Portion } from '../types';

export interface Nutrition {
  kcal: number;
  protein: number;
}

/** Unrounded kcal and protein for a food, portion and multiplier. */
export function rawNutrition(food: Pick<Food, 'basis' | 'kcal' | 'protein'>, portionAmount: number, multiplier: number): Nutrition {
  const factor = food.basis === 'perItem' ? portionAmount * multiplier : (portionAmount / 100) * multiplier;
  return { kcal: food.kcal * factor, protein: food.protein * factor };
}

export function roundKcal(n: number): number {
  return Math.round(n);
}

export function roundProtein(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Snapshot values as stored on a log entry: rounded once, at the end. */
export function entryNutrition(food: Pick<Food, 'basis' | 'kcal' | 'protein'>, portionAmount: number, multiplier: number): Nutrition {
  const raw = rawNutrition(food, portionAmount, multiplier);
  return { kcal: roundKcal(raw.kcal), protein: roundProtein(raw.protein) };
}

export function findPortion(food: Food, portionId?: string): Portion {
  return (
    food.portions.find((p) => p.id === portionId) ??
    food.portions.find((p) => p.id === food.defaultPortionId) ??
    food.portions[0]
  );
}

export function formatMultiplier(m: number): string {
  return '×' + (Number.isInteger(m) ? String(m) : String(Math.round(m * 100) / 100));
}

export function entryName(food: Food, portion: Portion, multiplier: number): string {
  return `${food.name}, ${portion.label} ${formatMultiplier(multiplier)}`;
}

export function fmtProtein(g: number): string {
  return `${roundProtein(g)}g`;
}

export function fmtKcal(k: number): string {
  return Math.round(k).toLocaleString('en-GB');
}
