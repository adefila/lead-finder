'use client';

import { useEffect, useRef, useState, type ComponentProps, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export const EASE = [0.22, 1, 0.36, 1] as const;

const PATHS: Record<string, ReactNode> = {
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>,
  send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  sync: <><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" /><path d="M21 3v5h-5M3 21v-5h5" /></>,
  up: <path d="m6 15 6-6 6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  external: <><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>,
  arrowRight: <path d="M5 12h14m-6-6 6 6-6 6" />,
  arrowLeft: <path d="M19 12H5m6 6-6-6 6-6" />,
  trash: <><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></>,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" />,
};

export function Icon({ name, size = 14 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[name]}
    </svg>
  );
}

export function Btn(props: ComponentProps<typeof motion.button>) {
  return <motion.button whileTap={{ scale: 0.97 }} {...props} />;
}

export function LinkBtn(props: ComponentProps<typeof motion.a>) {
  return <motion.a whileTap={{ scale: 0.97 }} {...props} />;
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`icon-btn${done ? ' done' : ''}`}
      aria-label={done ? 'Copied' : label}
      title={done ? 'Copied' : label}
      onClick={e => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={done ? 'check' : 'copy'}
          style={{ display: 'grid' }}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <Icon name={done ? 'check' : 'copy'} />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

export interface DropdownOption<T extends string> { value: T; label: string; count?: number }

export function Dropdown<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const current = options.find(o => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, options.findIndex(o => o.value === value)));
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, options, value]);

  function choose(v: T) {
    onChange(v);
    setOpen(false);
  }

  function onKey(e: ReactKeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setActive(i => (i + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    }
    if ((e.key === 'Enter' || e.key === ' ') && open) { e.preventDefault(); choose(options[active].value); }
  }

  return (
    <div className="dropdown" ref={root} onKeyDown={onKey}>
      <button type="button" className={`dropdown-btn${open ? ' open' : ''}`} aria-haspopup="listbox" aria-expanded={open}
        aria-label={label} onClick={() => setOpen(o => !o)}>
        <span className="dropdown-value">{current?.label}</span>
        <motion.span className="dropdown-chev" animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.18 }}>
          <Icon name="down" size={14} />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul className="dropdown-menu" role="listbox" aria-label={label}
            initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}>
            {options.map((o, i) => (
              <li key={o.value} role="option" aria-selected={o.value === value}
                className={`dropdown-item${i === active ? ' active' : ''}`}
                onMouseEnter={() => setActive(i)} onMouseDown={e => e.preventDefault()} onClick={() => choose(o.value)}>
                <span>{o.label}</span>
                <span className="dropdown-meta">
                  {o.count !== undefined && <span className="dropdown-count">{o.count}</span>}
                  <span className="dropdown-check">{o.value === value && <Icon name="check" size={13} />}</span>
                </span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
