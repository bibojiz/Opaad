import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

/* ---------- Toasts: one at a time, optional Undo ---------- */

type Toast = { id: number; text: string; undo?: () => void };
const ToastCtx = createContext<(text: string, undo?: () => void) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((text: string, undo?: () => void) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), text, undo });
    timer.current = setTimeout(() => setToast(null), undo ? 5000 : 3000);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center px-4">
        {toast && (
          <div key={toast.id} role="status" className="anim-rise pointer-events-auto flex min-h-12 w-full max-w-sm items-center gap-2 rounded-card bg-ink py-1.5 pr-1.5 pl-4 text-sm text-white shadow-lg">
            <span className="flex-1">{toast.text}</span>
            {toast.undo && (
              <button
                type="button"
                className="h-9 rounded-field px-2.5 font-semibold text-lime hover:bg-white/10"
                onClick={() => {
                  toast.undo?.();
                  setToast(null);
                }}
              >
                Undo
              </button>
            )}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/* ---------- Sheet: bottom sheet on phones, centred dialog on desktop ---------- */

export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('input, textarea, button:not([data-close])')?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      restore.current?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center lg:items-center">
      <button type="button" aria-label="Close" data-close tabIndex={-1} className="anim-fade absolute inset-0 bg-ink/40" onClick={onClose} />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`anim-rise relative max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-surface p-4 pb-6 lg:rounded-2xl ${wide ? 'lg:max-w-xl' : 'lg:max-w-md'}`}>
        <span aria-hidden className="mx-auto mb-2 block h-1 w-10 rounded-full bg-line lg:hidden" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-[22px] leading-none tracking-[-1px]">{title}</h2>
          <button type="button" data-close onClick={onClose} aria-label="Close" className="flex size-10 items-center justify-center rounded-card border border-line">
            <X size={16} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
