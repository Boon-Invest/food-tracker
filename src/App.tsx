import { useCallback, useState } from 'react';
import { useData } from './data';
import type { Food, LogEntry, Meal } from './types';
import { defaultMeal } from './lib/meal';
import { fmtKcal } from './lib/calc';
import { deleteEntries, deleteEntry, logFood, restoreEntries, updateEntry } from './store';
import { Home } from './screens/Home';
import { LogScreen } from './screens/LogScreen';
import { Settings } from './screens/Settings';
import { AddFood, type AddMode, type AddResult } from './components/AddFood';
import { ConfirmSheet } from './components/ConfirmSheet';
import { QuantitySheet } from './components/QuantitySheet';
import { Toast, type ToastState } from './components/Toast';

type Screen = 'home' | 'log' | 'settings';

let toastId = 0;

export default function App() {
  const { ready, foodById } = useData();
  const [screen, setScreen] = useState<Screen>('home');
  const [meal, setMeal] = useState<Meal>(defaultMeal());
  const [toast, setToast] = useState<ToastState | null>(null);
  const [add, setAdd] = useState<{ mode: AddMode; name?: string; edit?: Food } | null>(null);
  const [freeText, setFreeText] = useState<{ text: string; meal: Meal } | null>(null);
  const [editing, setEditing] = useState<LogEntry | null>(null);

  const closeToast = useCallback(() => setToast(null), []);

  const notifyLogged = useCallback((entries: LogEntry[]) => {
    if (!entries.length) return;
    const k = entries.reduce((a, e) => a + e.kcal, 0);
    const p = Math.round(entries.reduce((a, e) => a + e.protein, 0) * 10) / 10;
    const message = entries.length === 1 ? `Added ${entries[0].nameSnapshot} · ${fmtKcal(k)} kcal · ${p}g` : `Added ${entries.length} items · ${fmtKcal(k)} kcal · ${p}g`;
    setToast({ id: ++toastId, message, undo: () => deleteEntries(entries.map((e) => e.id)) });
  }, []);

  const onDeleteEntry = useCallback(async (e: LogEntry) => {
    const gone = await deleteEntry(e.id);
    if (gone) setToast({ id: ++toastId, message: `Deleted ${gone.nameSnapshot}`, undo: () => restoreEntries([gone]) });
  }, []);

  const onAddDone = async (r: AddResult | null) => {
    setAdd(null);
    if (!r) return;
    if (r.action === 'log' || r.action === 'existing') {
      notifyLogged([await logFood(r.food, meal)]);
    } else if (!add?.edit) {
      setToast({ id: ++toastId, message: `Saved ${r.food.name} to library` });
    }
  };

  const openLog = (m: Meal) => {
    setMeal(m);
    setScreen('log');
  };

  if (!ready) return null;

  return (
    <>
      {screen === 'home' && (
        <Home
          onOpenLog={openLog}
          onSettings={() => setScreen('settings')}
          onFreeText={(text) => setFreeText({ text, meal: defaultMeal() })}
          onEditEntry={setEditing}
          onDeleteEntry={onDeleteEntry}
        />
      )}
      {screen === 'log' && (
        <LogScreen
          meal={meal}
          onMealChange={setMeal}
          onDone={() => setScreen('home')}
          onLogged={notifyLogged}
          onAddNew={(name) => setAdd({ mode: 'quick', name })}
          onScan={() => setAdd({ mode: 'scan' })}
          onQuickAdd={() => setAdd({ mode: 'quick' })}
          onFreeText={(text) => setFreeText({ text, meal })}
        />
      )}
      {screen === 'settings' && (
        <Settings onBack={() => setScreen('home')} onEditFood={(f) => setAdd({ mode: 'manual', edit: f })} onAddFood={() => setAdd({ mode: 'manual' })} />
      )}

      {editing && foodById.get(editing.foodId) && (
        <QuantitySheet
          food={foodById.get(editing.foodId)!}
          portionId={editing.portionId}
          multiplier={editing.multiplier}
          meal={editing.meal}
          confirmLabel="Save"
          onClose={() => setEditing(null)}
          onDelete={() => {
            onDeleteEntry(editing);
            setEditing(null);
          }}
          onConfirm={async (pid, mult, m) => {
            await updateEntry(editing, foodById.get(editing.foodId)!, pid, mult, m ?? editing.meal);
            setEditing(null);
          }}
        />
      )}

      {freeText && (
        <ConfirmSheet
          text={freeText.text}
          meal={freeText.meal}
          onClose={() => setFreeText(null)}
          onLogged={(entries) => {
            setFreeText(null);
            notifyLogged(entries);
          }}
        />
      )}

      {add && <AddFood mode={add.mode} initialName={add.name} editFood={add.edit} onDone={onAddDone} />}

      <Toast toast={toast} onClose={closeToast} low={screen !== 'home'} />
    </>
  );
}
