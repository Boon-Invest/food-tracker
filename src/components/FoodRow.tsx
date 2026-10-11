import { useRef } from 'react';
import type { Food } from '../types';
import { entryNutrition, findPortion, fmtKcal, formatMultiplier } from '../lib/calc';

/** Tap logs at the default portion; long-press or chevron opens the quantity sheet. */
export function FoodRow({ food, onTap, onMore }: { food: Food; onTap: () => void; onMore: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const p = findPortion(food);
  const m = food.defaultMultiplier ?? 1;
  const n = entryNutrition(food, p.amount, m);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <div className="row" style={{ padding: 0 }}>
      <button
        className="row"
        style={{ flex: 1, minWidth: 0 }}
        onPointerDown={(e) => {
          longPressed.current = false;
          startPos.current = { x: e.clientX, y: e.clientY };
          timer.current = setTimeout(() => {
            longPressed.current = true;
            navigator.vibrate?.(20);
            onMore();
          }, 450);
        }}
        onPointerMove={(e) => {
          const s = startPos.current;
          if (s && (Math.abs(e.clientX - s.x) > 10 || Math.abs(e.clientY - s.y) > 10)) cancel();
        }}
        onPointerUp={cancel}
        onPointerCancel={cancel}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (!longPressed.current) onTap();
        }}
      >
        <div className="row-main">
          <div className="row-name">{food.name}</div>
          <div className="row-sub">
            {p.label}
            {m !== 1 ? ' ' + formatMultiplier(m) : ''}
            {food.brand ? ` · ${food.brand}` : ''}
          </div>
        </div>
        <div className="row-nums">
          <b>{fmtKcal(n.kcal)}</b> kcal
          <div className="row-sub">{n.protein}g</div>
        </div>
      </button>
      <button className="chev" onClick={onMore} aria-label="Choose quantity">›</button>
    </div>
  );
}
