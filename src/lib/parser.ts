import type { Food, Portion } from '../types';

/** One phrase from free text or speech, before matching. */
export interface ParsedPhrase {
  phrase: string; // original chunk, e.g. "a large apple"
  query: string; // food words only, e.g. "apple"
  qty: number; // multiplier, default 1
  size?: string; // small, medium, large, regular
  unit?: string; // slice, can, scoop, handful...
  amount?: number; // grams or ml if stated, e.g. 200 for "200g"
}

export type Confidence = 'high' | 'low';

export interface MatchResult {
  food: Food;
  portion: Portion;
  multiplier: number;
  confidence: Confidence;
  score: number;
  /** Set when an amount like "200g" needs a new 100g portion created on the food. */
  needsPortion?: Portion;
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  half: 0.5, single: 1, couple: 2, few: 3, double: 2
};

const SIZE_WORDS: Record<string, string> = {
  small: 'small', little: 'small', medium: 'medium', regular: 'regular', normal: 'regular',
  large: 'large', big: 'large'
};

const UNIT_WORDS = new Set([
  'slice', 'piece', 'cup', 'mug', 'can', 'tin', 'pot', 'scoop', 'bowl', 'glass', 'handful', 'portion',
  'pack', 'packet', 'pouch', 'bar', 'bottle', 'tbsp', 'tablespoon', 'tsp', 'teaspoon', 'serving', 'spoon',
  'spoonful', 'wrap', 'breast', 'wing', 'fillet', 'rasher', 'pint', 'shot', 'carton'
]);

const FILLER = new Set(['of', 'some', 'the', 'my', 'x', 'and', 'with', 'plus', 'i', 'had', 'ate', 'drank']);

const NUMBER_WORD_RE = '(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\\d+)';

/** Lowercase, strip punctuation (keeping decimal points), collapse spaces. */
export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/(\d)\.(\d)/g, '$1§$2')
    .replace(/[^a-z0-9§%\s,&+]/g, ' ')
    .replace(/§/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Crude singular form: berries -> berry, tomatoes -> tomato, eggs -> egg. */
export function singular(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.endsWith('oes')) return w.slice(0, -2);
  if (/(ches|shes|xes|sses)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) return w.slice(0, -1);
  return w;
}

function numberWordValue(w: string): number {
  return NUMBER_WORDS[w] ?? Number(w);
}

/** Split free text into phrases on commas, "and", "with", "plus". */
export function splitPhrases(text: string): string[] {
  let t = normalise(text);
  // Protect fractional quantities before splitting on "and"
  t = t.replace(new RegExp(`\\b${NUMBER_WORD_RE} and a half\\b`, 'g'), (m) => {
    const w = m.split(' ')[0];
    return String(numberWordValue(w) + 0.5);
  });
  t = t.replace(/\ba couple of\b/g, '2 ');
  t = t.replace(/\bhalf an?\b/g, '0.5 ');
  return t
    .split(/\s*(?:,|&|\+|\band\b|\bwith\b|\bplus\b)\s*/)
    .map((s) => s.trim())
    .filter((s) => s && !/^(a|an|and|with|plus)$/.test(s));
}

export function parsePhrase(phrase: string): ParsedPhrase {
  let words = normalise(phrase).split(' ').filter(Boolean);
  let qty: number | undefined;
  let size: string | undefined;
  let unit: string | undefined;
  let amount: number | undefined;
  const rest: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    // "200g", "330ml", "200 g", "200 grams"
    const amt = w.match(/^(\d+(?:\.\d+)?)(g|gr|grams?|ml|millilitres?|milliliters?)$/);
    if (amt) {
      amount = Number(amt[1]);
      continue;
    }
    if (/^\d+(\.\d+)?$/.test(w) && /^(g|gr|grams?|ml|millilitres?|milliliters?)$/.test(words[i + 1] ?? '')) {
      amount = Number(w);
      i++;
      continue;
    }
    // "x2" or "2x"
    const times = w.match(/^x(\d+(?:\.\d+)?)$/) || w.match(/^(\d+(?:\.\d+)?)x$/);
    if (times) {
      qty = Number(times[1]);
      continue;
    }
    if (qty === undefined && rest.length === 0 && (w in NUMBER_WORDS || /^\d+(\.\d+)?$/.test(w))) {
      qty = numberWordValue(w);
      continue;
    }
    if (w in SIZE_WORDS) {
      size = SIZE_WORDS[w];
      continue;
    }
    const sw = singular(w);
    if (UNIT_WORDS.has(sw) && words[i + 1] === 'of') {
      unit = sw;
      i++;
      continue;
    }
    if (FILLER.has(w)) continue;
    rest.push(w);
  }

  // A trailing unit word with nothing after it ("a can") is the food itself, keep it in the query
  words = rest;
  return { phrase: phrase.trim(), query: words.join(' '), qty: qty ?? 1, size, unit, amount };
}

export function parseText(text: string): ParsedPhrase[] {
  return splitPhrases(text).map(parsePhrase).filter((p) => p.query.length > 0);
}

// ---------- Matching ----------

function tokens(s: string): string[] {
  return normalise(s)
    .replace(/,/g, ' ')
    .split(' ')
    .filter((w) => w && !FILLER.has(w))
    .map(singular);
}

function lev(a: string, b: string): number {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

function tokenMatch(q: string, n: string): number {
  if (q === n) return 1;
  if (q.length >= 3 && n.startsWith(q)) return 0.8;
  if (q.length >= 4 && n.length >= 4 && lev(q, n) <= 1) return 0.8;
  return 0;
}

/** 0..1 similarity between a query and a food name (or alias). */
export function nameScore(query: string, name: string): number {
  const q = tokens(query);
  const nAll = tokens(name);
  if (!q.length || !nAll.length) return 0;
  const qs = q.join(' ');
  if (qs === nAll.join(' ')) return 1;
  // Main part of the name before the first comma: "Chicken breast, cooked" -> "chicken breast"
  const head = tokens(name.split(',')[0]);
  if (qs === head.join(' ')) return 0.97;

  let matched = 0;
  for (const qt of q) {
    let best = 0;
    for (const nt of nAll) best = Math.max(best, tokenMatch(qt, nt));
    matched += best;
  }
  const qCover = matched / q.length; // how much of what was said is in the name
  let headHit = 0;
  for (const ht of head) {
    let best = 0;
    for (const qt of q) best = Math.max(best, tokenMatch(qt, ht));
    headHit += best;
  }
  const headCover = headHit / head.length; // how much of the food's main name was said
  return Math.min(0.95, qCover * 0.6 + headCover * 0.35);
}

export const HIGH_CONFIDENCE = 0.8;
export const MIN_MATCH = 0.45;

export interface Candidate {
  food: Food;
  score: number;
}

/** Ranked candidates for a query: learnt aliases first, then fuzzy name, ties on usage. */
export function candidates(query: string, foods: Food[], usage: Map<string, number> = new Map()): Candidate[] {
  const q = tokens(query).join(' ');
  const out: Candidate[] = [];
  for (const f of foods) {
    if (f.archived) continue;
    let score = 0;
    for (const a of f.aliases) {
      if (tokens(a).join(' ') === q) score = Math.max(score, 1.01); // exact alias beats everything
      else score = Math.max(score, nameScore(query, a) * 0.95);
    }
    score = Math.max(score, nameScore(query, f.name));
    if (score > 0) out.push({ food: f, score });
  }
  return out.sort((a, b) => b.score - a.score || (usage.get(b.food.id) ?? 0) - (usage.get(a.food.id) ?? 0));
}

function pickPortion(food: Food, p: ParsedPhrase): { portion: Portion; multiplier: number; needsPortion?: Portion; exact: boolean } {
  const def = food.portions.find((x) => x.id === food.defaultPortionId) ?? food.portions[0];
  const isMass = food.basis !== 'perItem';

  if (p.amount !== undefined && isMass) {
    const same = food.portions.find((x) => x.amount === p.amount);
    if (same) return { portion: same, multiplier: p.qty, exact: true };
    const hundred = food.portions.find((x) => x.amount === 100);
    if (hundred) return { portion: hundred, multiplier: (p.amount / 100) * p.qty, exact: true };
    const unitLabel = food.basis === 'per100ml' ? '100ml' : '100g';
    const created: Portion = { id: 'p100-' + food.id.slice(0, 8), label: unitLabel, amount: 100 };
    return { portion: created, multiplier: (p.amount / 100) * p.qty, needsPortion: created, exact: true };
  }

  const labelHas = (w: string) => food.portions.find((x) => tokens(x.label).includes(singular(w)));
  if (p.size) {
    const bySize = labelHas(p.size);
    if (bySize) return { portion: bySize, multiplier: p.qty, exact: true };
  }
  if (p.unit) {
    const byUnit = labelHas(p.unit);
    if (byUnit) return { portion: byUnit, multiplier: p.qty, exact: true };
  }
  // A size or amount we couldn't place is a reason to lower confidence
  const exact = !p.size && (p.amount === undefined || !isMass);
  return { portion: def, multiplier: p.qty, exact: exact && p.amount === undefined };
}

export function matchPhrase(p: ParsedPhrase, foods: Food[], usage?: Map<string, number>): MatchResult | null {
  const c = candidates(p.query, foods, usage);
  if (!c.length || c[0].score < MIN_MATCH) return null;
  const top = c[0];
  const pp = pickPortion(top.food, p);
  // Close runner-up means we're guessing between two foods
  const ambiguous = c.length > 1 && c[1].score >= top.score - 0.05 && top.score < 1;
  const confidence: Confidence = top.score >= HIGH_CONFIDENCE && pp.exact && !ambiguous ? 'high' : 'low';
  return { food: top.food, portion: pp.portion, multiplier: pp.multiplier, confidence, score: top.score, needsPortion: pp.needsPortion };
}
