import type { Food } from '../types';
import { nameScore, normalise } from './parser';

/** Whole-library search, ranked by match quality then usage. */
export function searchFoods(query: string, foods: Food[], usage: Map<string, number>, limit = 40): Food[] {
  const q = normalise(query);
  if (!q) return [];
  const scored: { f: Food; s: number }[] = [];
  for (const f of foods) {
    if (f.archived) continue;
    const name = normalise(f.name + (f.brand ? ' ' + f.brand : ''));
    let s = nameScore(q, f.name);
    if (name.startsWith(q)) s = Math.max(s, 0.96);
    else if (name.split(' ').some((w) => w.startsWith(q))) s = Math.max(s, 0.9);
    else if (name.includes(q)) s = Math.max(s, 0.8);
    for (const a of f.aliases) {
      const na = normalise(a);
      if (na === q) s = Math.max(s, 0.95);
      else if (na.startsWith(q)) s = Math.max(s, 0.85);
      else s = Math.max(s, nameScore(q, a) * 0.9);
    }
    if (s >= 0.4) scored.push({ f, s });
  }
  // Bucket the score so usage decides between similarly good matches
  return scored
    .sort((a, b) => Math.round(b.s * 10) - Math.round(a.s * 10) || (usage.get(b.f.id) ?? 0) - (usage.get(a.f.id) ?? 0) || a.f.name.localeCompare(b.f.name))
    .slice(0, limit)
    .map((x) => x.f);
}
