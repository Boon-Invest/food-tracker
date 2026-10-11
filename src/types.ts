export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink';

export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack', 'drink'];

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  drink: 'Drink'
};

export type Basis = 'per100g' | 'per100ml' | 'perItem';

export interface Portion {
  id: string;
  label: string; // "medium", "1 pot (170g)", "1 can"
  amount: number; // grams or ml if basis is per100g/ml; multiplier if perItem
}

export interface Food {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  basis: Basis;
  kcal: number; // per basis unit
  protein: number; // grams per basis unit
  portions: Portion[];
  defaultPortionId: string;
  defaultMultiplier?: number; // last multiplier used, set by the quantity sheet
  source: 'cofid' | 'off' | 'manual';
  archived: boolean;
  aliases: string[];
  createdAt: number;
  updatedAt: number;
}

export interface LogEntry {
  id: string;
  date: string; // local date 'YYYY-MM-DD' (Europe/London)
  loggedAt: number;
  meal: Meal;
  foodId: string;
  portionId: string;
  multiplier: number;
  kcal: number; // snapshot, whole kcal
  protein: number; // snapshot, 1 dp
  nameSnapshot: string;
}

export interface SavedMealItem {
  foodId: string;
  portionId: string;
  multiplier: number;
}

export interface SavedMeal {
  id: string;
  name: string;
  meal: Meal;
  items: SavedMealItem[];
}

export type VoiceMode = 'safari' | 'keyboard';

export interface Settings {
  id: 'settings';
  kcalTarget: number;
  proteinTarget: number;
  voiceMode: VoiceMode;
  seeded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  kcalTarget: 2000,
  proteinTarget: 150,
  voiceMode: 'safari',
  seeded: false
};
