import { describe, expect, it } from 'vitest';
import { entryNutrition } from '../src/lib/calc';

describe('entry calculation', () => {
  it('PRD worked example: apple large 200g x1.5 at 52 kcal / 0.3g per 100g', () => {
    expect(entryNutrition({ basis: 'per100g', kcal: 52, protein: 0.3 }, 200, 1.5)).toEqual({ kcal: 156, protein: 0.9 });
  });
  it('perItem multiplies portion amount directly', () => {
    expect(entryNutrition({ basis: 'perItem', kcal: 105, protein: 24 }, 1, 2)).toEqual({ kcal: 210, protein: 48 });
  });
  it('rounds only at the end', () => {
    // 33.3 x 3 = 99.9 -> 100, not 33 x 3 = 99
    expect(entryNutrition({ basis: 'perItem', kcal: 33.3, protein: 0.15 }, 1, 3).kcal).toBe(100);
    expect(entryNutrition({ basis: 'perItem', kcal: 33.3, protein: 0.15 }, 1, 3).protein).toBe(0.5);
  });
  it('per100ml works like per100g', () => {
    expect(entryNutrition({ basis: 'per100ml', kcal: 42, protein: 0 }, 330, 1)).toEqual({ kcal: 139, protein: 0 });
  });
});
