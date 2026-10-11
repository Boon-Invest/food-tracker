import seedData from './seed-foods.json';
import type { Basis, Food } from '../types';
import { db, getSettings, saveSettings } from '../db';
import { uid } from '../lib/id';

interface SeedFood {
  name: string;
  basis: Basis;
  kcal: number;
  protein: number;
  portions: { label: string; amount: number }[];
  aliases: string[];
  source: 'cofid' | 'manual';
}

export function seedFoods(now = Date.now()): Food[] {
  // createdAt steps by 1ms so the list keeps seed order (regulars first) before any history exists
  return (seedData as SeedFood[]).map((s, i) => {
    const portions = s.portions.map((p) => ({ id: uid(), label: p.label, amount: p.amount }));
    return {
      id: uid(),
      name: s.name,
      basis: s.basis,
      kcal: s.kcal,
      protein: s.protein,
      portions,
      defaultPortionId: portions[0].id,
      source: s.source,
      archived: false,
      aliases: s.aliases,
      createdAt: now + i,
      updatedAt: now + i
    };
  });
}

/** Runs once, on first launch. */
export async function seedIfNeeded(): Promise<void> {
  const s = await getSettings();
  if (s.seeded) return;
  await db.transaction('rw', db.foods, db.settings, async () => {
    if ((await db.foods.count()) === 0) await db.foods.bulkAdd(seedFoods());
    await saveSettings({ seeded: true });
  });
}
