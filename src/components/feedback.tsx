'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { EASE } from '@/components/ui';

type Tone = 'default' | 'success' | 'error';
interface ToastAction { label: string; run: () => void }
interface ToastItem { id: number; text: string; tone: Tone; action?: ToastAction }
interface ToastOptions { tone?: Tone; action?: ToastAction }
interface ConfirmOptions { title: string; body?: string; confirmLabel?: string; danger?: boolean }

interface Feedback {
  toast: (text: string, options?: ToastOptions) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<Feedback | null>(null);

export function useFeedback(): Feedback {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used inside FeedbackProvider');
  return ctx;
}

const MAX_TOASTS = 3;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => setToasts(list => list.filter(t => t.id !== id)), []);

  const toast = useCallback((text: string, options: ToastOptions = {}) => {
    const id = ++nextId.current;
    const tone = options.tone ?? 'default';
    setToasts(list => [...list, { id, text, tone, action: options.action }].slice(-MAX_TOASTS));
    const ms = tone === 'error' ? 8000 : options.action ? 6000 : 4500;
    setTimeout(() => dismiss(id), ms);
  }, [dismiss]);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>(resolve => {
    setDialog({ ...options, resolve });
  }), []);

  function closeDialog(ok: boolean) {
    dialog?.resolve(ok);
    setDialog(null);
  }

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      <div className="toast-stack" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              layout
              className={`toast ${t.tone}`}
              role={t.tone === 'error' ? 'alert' : 'status'}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.15 } }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              {t.tone === 'error' && <AlertCircle size={16} className="toast-icon" aria-hidden />}
              {t.tone === 'success' && <CheckCircle2 size={16} className="toast-icon" aria-hidden />}
              <span className="toast-text">{t.text}</span>
              {t.action && (
                <button className="toast-action" onClick={() => { t.action!.run(); dismiss(t.id); }}>{t.action.label}</button>
              )}
              <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss"><X size={14} /></button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {dialog && <ConfirmDialog key="confirm" {...dialog} onClose={closeDialog} />}
      </AnimatePresence>
    </FeedbackContext.Provider>
  );
}

function ConfirmDialog({ title, body, confirmLabel = 'Confirm', danger, onClose }: ConfirmOptions & { onClose: (ok: boolean) => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <motion.div className="scrim dialog-scrim" onClick={() => onClose(false)}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} />
      <div className="dialog-wrap">
        <motion.div
          className="dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ duration: 0.2, ease: EASE }}
        >
          <h2 id="dialog-title" className="dialog-title">{title}</h2>
          {body && <p className="dialog-body">{body}</p>}
          <div className="dialog-actions">
            <button className="btn" onClick={() => onClose(false)}>Cancel</button>
            <button ref={confirmRef} className={`btn ${danger ? 'btn-danger-solid' : 'btn-primary'}`} onClick={() => onClose(true)}>
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
}
