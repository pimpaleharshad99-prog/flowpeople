import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'danger' | 'warning' | 'info' | 'default';

interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  onUndo?: () => void;
}

export interface ToastOptions {
  title?: string;
  description?: string;
  message?: string;
  type?: ToastType;
  onUndo?: () => void;
}

export interface ToastContextType {
  showToast: (message: string, type?: ToastType, onUndo?: () => void) => void;
  addToast: (options: ToastOptions | string) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  addToast: () => {},
});

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((options: ToastOptions | string) => {
    const id = Math.random().toString(36).substring(2, 9);
    if (typeof options === 'string') {
      setToasts((prev) => [...prev, { id, type: 'info', message: options }]);
    } else {
      const type = options.type || 'info';
      const message = options.description || options.message || options.title || '';
      const title = options.title && options.description ? options.title : undefined;
      setToasts((prev) => [...prev, { id, type, title, message, onUndo: options.onUndo }]);
    }
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'success', onUndo?: () => void) => {
      addToast({ message, type, onUndo });
    },
    [addToast]
  );

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast, addToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto glass-panel bg-[var(--surface-card)] border-[var(--border-glass)] p-3 shadow-xl rounded-[var(--radius-card)] flex items-start justify-between gap-3 text-xs animate-in slide-in-from-bottom-2 duration-150"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {(toast.type === 'success') && (
                <CheckCircle2 className="w-4 h-4 text-[#4A5A3F] shrink-0 mt-0.5" />
              )}
              {(toast.type === 'error' || toast.type === 'danger') && (
                <AlertCircle className="w-4 h-4 text-[#590907] shrink-0 mt-0.5" />
              )}
              {toast.type === 'warning' && (
                <AlertTriangle className="w-4 h-4 text-[#8C4820] shrink-0 mt-0.5" />
              )}
              {(toast.type === 'info' || toast.type === 'default') && (
                <Info className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                {toast.title && <p className="font-semibold text-[var(--text-main)] mb-0.5">{toast.title}</p>}
                <p className="text-[var(--text-secondary)] leading-relaxed">{toast.message}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              {toast.onUndo && (
                <button
                  onClick={() => {
                    toast.onUndo?.();
                    removeToast(toast.id);
                  }}
                  className="px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--surface-hover)] rounded border border-[var(--border-glass)] transition-colors"
                >
                  Undo
                </button>
              )}
              <button
                onClick={() => removeToast(toast.id)}
                className="text-[var(--text-subtle)] hover:text-[var(--text-main)] p-1 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
