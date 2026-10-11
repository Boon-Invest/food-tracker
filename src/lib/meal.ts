import type { Meal } from '../types';
import { localMinutes } from './dates';

/** Default meal by Europe/London time of day. Drink is never the default. */
export function mealForMinutes(min: number): Meal {
  if (min >= 4 * 60 && min <= 11 * 60 + 59) return 'breakfast';
  if (min >= 12 * 60 && min <= 14 * 60 + 30) return 'lunch';
  if (min >= 14 * 60 + 31 && min <= 17 * 60 + 29) return 'snack';
  if (min >= 17 * 60 + 30 && min <= 21 * 60 + 59) return 'dinner';
  return 'snack';
}

export function defaultMeal(ts: number = Date.now()): Meal {
  return mealForMinutes(localMinutes(ts));
}
