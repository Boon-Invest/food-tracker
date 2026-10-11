import { describe, expect, it } from 'vitest';
import { mapOffProduct } from '../src/lib/off';

describe('Open Food Facts mapping', () => {
  it('maps kcal, protein and serving portion', () => {
    const r = mapOffProduct({
      product_name: 'Greek Yoghurt 0%',
      brands: 'Fage,Total',
      quantity: '450 g',
      serving_size: '1 pot (170g)',
      serving_quantity: 170,
      nutriments: { 'energy-kcal_100g': 54, proteins_100g: 10.3 }
    });
    expect(r).toEqual({ name: 'Greek Yoghurt 0%', brand: 'Fage', basis: 'per100g', kcal: 54, protein: 10.3, serving: { label: '1 pot (170g)', amount: 170 } });
  });
  it('converts kJ when kcal is missing and detects ml', () => {
    const r = mapOffProduct({ product_name: 'Cola', quantity: '330 ml', nutriments: { 'energy-kj_100g': 180, proteins_100g: 0 } });
    expect(r.kcal).toBe(43); // 180 / 4.184 = 43.02
    expect(r.basis).toBe('per100ml');
    expect(r.serving).toBeUndefined();
  });
  it('leaves missing values as null rather than guessing', () => {
    const r = mapOffProduct({ product_name: 'Thing', nutriments: {} });
    expect(r.kcal).toBeNull();
    expect(r.protein).toBeNull();
  });
});
