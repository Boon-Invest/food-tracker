import { useRef, useState, type ReactNode } from 'react';

/** Row that deletes on a left swipe and fires onTap on a plain tap. */
export function SwipeRow({ children, onTap, onDelete }: { children: ReactNode; onTap: () => void; onDelete: () => void }) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; locked: 'h' | 'v' | null } | null>(null);
  const moved = useRef(false);

  return (
    <div className="swipe">
      <div className="swipe-bg" style={{ opacity: dx < -10 ? 1 : 0 }}>Delete</div>
      <button
        className="row"
        style={{ transform: `translateX(${dx}px)`, transition: start.current ? 'none' : 'transform 0.2s' }}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, y: e.clientY, locked: null };
          moved.current = false;
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const ddx = e.clientX - s.x;
          const ddy = e.clientY - s.y;
          if (!s.locked && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) s.locked = Math.abs(ddx) > Math.abs(ddy) ? 'h' : 'v';
          if (s.locked === 'h') {
            moved.current = true;
            setDx(Math.min(0, ddx));
          } else if (s.locked === 'v') moved.current = true;
        }}
        onPointerUp={() => {
          const s = start.current;
          start.current = null;
          if (dx < -90) {
            setDx(-window.innerWidth);
            setTimeout(onDelete, 150);
            return;
          }
          setDx(0);
          if (!moved.current && s) onTap();
        }}
        onPointerCancel={() => {
          start.current = null;
          setDx(0);
        }}
      >
        {children}
      </button>
    </div>
  );
}
