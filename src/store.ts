import { db } from './db';
import type { Food, LogEntry, Meal, Portion, SavedMeal } from './types';
import { entryName, entryNutrition, findPortion } from './lib/calc';
import { addDays, localDate } from './lib/dates';
import { uid } from './lib/id';
import { normalise } from './lib/parser';

export function buildEntry(food: Food, portion: Portion, multiplier: number, meal: Meal, now = Date.now()): LogEntry {
  const n = entryNutrition(food, portion.amount, multiplier);
  return {
    id: uid(),
    date: localDate(now),
    loggedAt: now,
    meal,
    foodId: food.id,
    portionId: portion.id,
    multiplier,
    kcal: n.kcal,
    protein: n.protein,
    nameSnapshot: entryName(food, portion, multiplier)
  };
}

export async function logFood(food: Food, meal: Meal, portionId?: string, multiplier?: number): Promise<LogEntry> {
  const portion = findPortion(food, portionId);
  const m = multiplier ?? (portionId ? 1 : food.defaultMultiplier ?? 1);
  const entry = buildEntry(food, portion, m, meal);
  await db.entries.add(entry);
  return entry;
}

/** Quantity sheet choice: log it and remember it as the food's default. */
export async function logWithChoice(food: Food, meal: Meal, portionId: string, multiplier: number): Promise<LogEntry> {
  await db.foods.update(food.id, { defaultPortionId: portionId, defaultMultiplier: multiplier, updatedAt: Date.now() });
  return logFood({ ...food, defaultPortionId: portionId }, meal, portionId, multiplier);
}

export async function deleteEntry(id: string): Promise<LogEntry | undefined> {
  const e = await db.entries.get(id);
  if (e) await db.entries.delete(id);
  return e;
}

export async function restoreEntries(entries: LogEntry[]): Promise<void> {
  await db.entries.bulkPut(entries);
}

export async function deleteEntries(ids: string[]): Promise<void> {
  await db.entries.bulkDelete(ids);
}

/** Re-snapshot an entry after editing its portion, multiplier or meal. */
export async function updateEntry(entry: LogEntry, food: Food, portionId: string, multiplier: number, meal: Meal): Promise<void> {
  const portion = findPortion(food, portionId);
  const n = entryNutrition(food, portion.amount, multiplier);
  await db.entries.put({
    ...entry,
    meal,
    portionId: portion.id,
    multiplier,
    kcal: n.kcal,
    protein: n.protein,
    nameSnapshot: entryName(food, portion, multiplier)
  });
}

export async function saveFood(food: Food): Promise<void> {
  await db.foods.put({ ...food, updatedAt: Date.now() });
}

export async function addPortion(food: Food, label: string, amount: number): Promise<Portion> {
  const p: Portion = { id: uid(), label, amount };
  await db.foods.update(food.id, { portions: [...food.portions, p], updatedAt: Date.now() });
  return p;
}

export async function ensurePortion(foodId: string, portion: Portion): Promise<void> {
  const f = await db.foods.get(foodId);
  if (f && !f.portions.some((p) => p.id === portion.id)) {
    await db.foods.update(foodId, { portions: [...f.portions, portion], updatedAt: Date.now() });
  }
}

/** Learn a phrase so it matches this food next time; removes it from any other food. */
export async function learnAlias(foodId: string, phrase: string): Promise<void> {
  const a = normalise(phrase);
  if (!a) return;
  await db.transaction('rw', db.foods, async () => {
    const all = await db.foods.toArray();
    for (const f of all) {
      const has = f.aliases.some((x) => normalise(x) === a);
      if (f.id === foodId && !has) await db.foods.update(f.id, { aliases: [...f.aliases, a], updatedAt: Date.now() });
      if (f.id !== foodId && has) await db.foods.update(f.id, { aliases: f.aliases.filter((x) => normalise(x) !== a) });
    }
  });
}

export interface NewFoodInput {
  name: string;
  brand?: string;
  barcode?: string;
  basis: Food['basis'];
  kcal: number;
  protein: number;
  portions: { label: string; amount: number }[];
  source: Food['source'];
  aliases?: string[];
}

export async function createFood(input: NewFoodInput): Promise<Food> {
  const now = Date.now();
  const portions = (input.portions.length ? input.portions : [{ label: input.basis === 'perItem' ? '1 item' : '100g', amount: input.basis === 'perItem' ? 1 : 100 }]).map((p) => ({
    id: uid(),
    label: p.label,
    amount: p.amount
  }));
  const food: Food = {
    id: uid(),
    name: input.name.trim(),
    brand: input.brand?.trim() || undefined,
    barcode: input.barcode || undefined,
    basis: input.basis,
    kcal: input.kcal,
    protein: input.protein,
    portions,
    defaultPortionId: portions[0].id,
    source: input.source,
    archived: false,
    aliases: input.aliases ?? [],
    createdAt: now,
    updatedAt: now
  };
  await db.foods.add(food);
  return food;
}

/** Copy every entry from a previous day's meal into today's same meal. */
export async function copyMeal(fromDate: string, meal: Meal, toMeal: Meal = meal): Promise<LogEntry[]> {
  const src = (await db.entries.where('date').equals(fromDate).toArray()).filter((e) => e.meal === meal);
  const now = Date.now();
  const copies = src.map((e, i) => ({ ...e, id: uid(), date: localDate(now), loggedAt: now + i, meal: toMeal }));
  await db.entries.bulkAdd(copies);
  return copies;
}

/** Most recent day before today that has entries for this meal, within the last 14 days. */
export async function lastDayWithMeal(meal: Meal, today = localDate()): Promise<string | null> {
  const from = addDays(today, -14);
  const rows = await db.entries.where('date').between(from, today, true, false).toArray();
  const dates = rows.filter((e) => e.meal === meal).map((e) => e.date).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

export async function saveMealFromEntries(name: string, meal: Meal, entries: LogEntry[]): Promise<SavedMeal> {
  const sm: SavedMeal = {
    id: uid(),
    name: name.trim(),
    meal,
    items: entries.map((e) => ({ foodId: e.foodId, portionId: e.portionId, multiplier: e.multiplier }))
  };
  await db.savedMeals.add(sm);
  return sm;
}

export async function logSavedMeal(sm: SavedMeal, meal: Meal): Promise<LogEntry[]> {
  const foods = await db.foods.bulkGet(sm.items.map((i) => i.foodId));
  const now = Date.now();
  const out: LogEntry[] = [];
  sm.items.forEach((it, i) => {
    const f = foods[i];
    if (!f) return;
    out.push(buildEntry(f, findPortion(f, it.portionId), it.multiplier, meal, now + i));
  });
  await db.entries.bulkAdd(out);
  return out;
}
