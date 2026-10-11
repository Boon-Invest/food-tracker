import type { ReactNode } from 'react';

export function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog">
        <div className="grab" />
        {children}
      </div>
    </>
  );
}
