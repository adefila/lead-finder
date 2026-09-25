'use client';

import { useEffect, useRef, useState, type ComponentProps, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, Copy, ExternalLink, Mail, Minus, Phone,
  RefreshCw, Search, Send, Sparkles, Trash2, Undo2, X, type LucideIcon,
} from 'lucide-react';

export const EASE = [0.22, 1, 0.36, 1] as const;

const ICONS = {
  mail: Mail,
  phone: Phone,
  copy: Copy,
  check: Check,
  minus: Minus,
  x: X,
  undo: Undo2,
  send: Send,
  search: Search,
  sync: RefreshCw,
  up: ChevronUp,
  down: ChevronDown,
  external: ExternalLink,
  arrowRight: ArrowRight,
  arrowLeft: ArrowLeft,
  trash: Trash2,
  sparkle: Sparkles,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 15, strokeWidth = 2 }: { name: IconName; size?: number; strokeWidth?: number }) {
  const Glyph = ICONS[name];
  return <Glyph size={size} strokeWidth={strokeWidth} aria-hidden focusable={false} />;
}

export function Checkbox({ checked, indeterminate = false, onChange, label, disabled }: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  const state = indeterminate ? 'mixed' : checked;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state}
      aria-label={label}
      disabled={disabled}
      className={`checkbox${checked || indeterminate ? ' on' : ''}`}
      onClick={e => { e.stopPropagation(); onChange(); }}
    >
      <AnimatePresence initial={false}>
        {(checked || indeterminate) && (
          <motion.span key={indeterminate ? 'minus' : 'check'} style={{ display: 'grid' }}
            initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }}
            transition={{ duration: 0.12 }}>
            <Icon name={indeterminate ? 'minus' : 'check'} size={12} strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
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
