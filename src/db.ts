import Dexie, { type Table } from 'dexie';
import type { Food, LogEntry, SavedMeal, Settings } from './types';
import { DEFAULT_SETTINGS } from './types';

// Never rename tables or indexed fields without a new db.version() migration:
// that would wipe real logged data on the phone.
export class FoodDB extends Dexie {
  foods!: Table<Food, string>;
  entries!: Table<LogEntry, string>;
  savedMeals!: Table<SavedMeal, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('food-tracker');
    this.version(1).stores({
      foods: 'id, name, barcode, archived, updatedAt',
      entries: 'id, date, loggedAt, meal, foodId',
      savedMeals: 'id, meal',
      settings: 'id'
    });
  }
}

export const db = new FoodDB();

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('settings');
  return { ...DEFAULT_SETTINGS, ...s };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, id: 'settings' });
}

export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch {
    // ignore
  }
  return false;
}
