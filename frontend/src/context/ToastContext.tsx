import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
  action?: { label: string; to: string };
}

interface ToastContextType {
  show: (message: string, opts?: { tone?: Toast['tone']; action?: Toast['action'] }) => void;
}

const ToastContext = createContext<ToastContextType>({ show: () => undefined });

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  const show = useCallback<ToastContextType['show']>((message, opts = {}) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, message, tone: opts.tone ?? 'success', action: opts.action }]);
    window.setTimeout(() => dismiss(id), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg px-4 py-3 text-[15px] text-white shadow-lg ${
              t.tone === 'error' ? 'bg-sale' : 'bg-ink'
            }`}
          >
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <Link to={t.action.to} onClick={() => dismiss(t.id)} className="shrink-0 font-semibold underline underline-offset-4">
                {t.action.label}
              </Link>
            )}
            <button onClick={() => dismiss(t.id)} aria-label="알림 닫기" className="shrink-0 text-white/70 hover:text-white">
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
