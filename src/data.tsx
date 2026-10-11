import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Food, LogEntry, SavedMeal, Settings } from './types';
import { DEFAULT_SETTINGS } from './types';
import { addDays, localDate } from './lib/dates';
import { usageScores } from './lib/ranking';

export interface Data {
  ready: boolean;
  today: string;
  foods: Food[];
  foodById: Map<string, Food>;
  entries: LogEntry[]; // last ~62 days
  savedMeals: SavedMeal[];
  settings: Settings;
  usage: Map<string, number>;
}

const Ctx = createContext<Data | null>(null);

function useToday(): string {
  const [today, setToday] = useState(localDate());
  useEffect(() => {
    const tick = () => setToday(localDate());
    const t = setInterval(tick, 30000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return today;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const today = useToday();
  const foods = useLiveQuery(() => db.foods.toArray(), []);
  const entries = useLiveQuery(() => db.entries.where('date').aboveOrEqual(addDays(today, -62)).toArray(), [today]);
  const savedMeals = useLiveQuery(() => db.savedMeals.toArray(), []);
  const settingsRow = useLiveQuery(() => db.settings.get('settings'), []);

  const value = useMemo<Data>(() => {
    const f = foods ?? [];
    const e = entries ?? [];
    return {
      ready: foods !== undefined && entries !== undefined,
      today,
      foods: f,
      foodById: new Map(f.map((x) => [x.id, x])),
      entries: e,
      savedMeals: savedMeals ?? [],
      settings: { ...DEFAULT_SETTINGS, ...settingsRow },
      usage: usageScores(e, today)
    };
  }, [foods, entries, savedMeals, settingsRow, today]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): Data {
  const d = useContext(Ctx);
  if (!d) throw new Error('DataProvider missing');
  return d;
}
