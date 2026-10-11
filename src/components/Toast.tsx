import { useEffect } from 'react';

export interface ToastState {
  id: number;
  message: string;
  undo?: () => void;
}

export function Toast({ toast, onClose, low }: { toast: ToastState | null; onClose: () => void; low?: boolean }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [toast, onClose]);
  if (!toast) return null;
  return (
    <div className={'toast' + (low ? ' low' : '')} role="status">
      <span>{toast.message}</span>
      {toast.undo && (
        <button
          onClick={() => {
            toast.undo!();
            onClose();
          }}
        >
          Undo
        </button>
      )}
    </div>
  );
}
