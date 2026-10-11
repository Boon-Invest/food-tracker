import { describe, expect, it } from 'vitest';
import { matchPhrase, parseText, splitPhrases } from '../src/lib/parser';
import { seedFoods } from '../src/seed/seed';

const foods = seedFoods(0);

describe('splitting and quantities', () => {
  it('splits on commas, and, with, plus', () => {
    expect(splitPhrases('2 eggs, toast and a large apple with honey plus coffee')).toEqual(['2 eggs', 'toast', 'a large apple', 'honey', 'coffee']);
  });
  it('keeps "one and a half" together', () => {
    const p = parseText('one and a half scoops of whey and a banana');
    expect(p[0].qty).toBe(1.5);
    expect(p[0].query).toBe('whey');
    expect(p[1].query).toBe('banana');
  });
  it('reads quantity words, sizes and amounts', () => {
    const [a, b, c, d] = parseText('a couple of eggs, half an avocado, 200g chicken, 330ml coke');
    expect(a.qty).toBe(2);
    expect(b.qty).toBe(0.5);
    expect(c.amount).toBe(200);
    expect(c.query).toBe('chicken');
    expect(d.amount).toBe(330);
  });
  it('reads digits like 1.5', () => {
    expect(parseText('1.5 bagels')[0].qty).toBe(1.5);
  });
});

describe('matching against the seed library', () => {
  it('acceptance: "two eggs, a slice of toast and a large apple" matches all three', () => {
    const items = parseText('two eggs, a slice of toast and a large apple');
    expect(items).toHaveLength(3);
    const m = items.map((p) => matchPhrase(p, foods));
    expect(m[0]?.food.name).toBe('Egg');
    expect(m[0]?.multiplier).toBe(2);
    expect(m[1]?.food.name).toBe('Bread, white');
    expect(m[1]?.portion.label).toContain('slice');
    expect(m[2]?.food.name).toBe('Apple');
    expect(m[2]?.portion.label).toContain('large');
    expect(m.every((x) => x?.confidence === 'high')).toBe(true);
  });
  it('aliases map: flat white, americano, tuna', () => {
    expect(matchPhrase(parseText('a flat white')[0], foods)?.food.name).toBe('Coffee with milk');
    expect(matchPhrase(parseText('americano')[0], foods)?.food.name).toBe('Black coffee');
    expect(matchPhrase(parseText('a can of tuna')[0], foods)?.food.name).toBe('Tuna, canned in water');
  });
  it('200g chicken maps to grams', () => {
    const m = matchPhrase(parseText('200g chicken')[0], foods)!;
    expect(m.food.name).toBe('Chicken breast, cooked');
    expect(m.portion.amount * m.multiplier).toBe(200);
  });
  it('a learnt alias wins', () => {
    const lib = foods.map((f) => (f.name === 'Whey protein' ? { ...f, aliases: [...f.aliases, 'huel'] } : f));
    expect(matchPhrase(parseText('a huel')[0], lib)?.food.name).toBe('Whey protein');
  });
  it('nonsense does not match', () => {
    expect(matchPhrase(parseText('xylophone')[0], foods)).toBeNull();
  });
});
