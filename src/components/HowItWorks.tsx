'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/ui';

const KEY = 'lf-how-it-works-hidden';

// Remembers per browser whether the strip was dismissed. Storage can be blocked, so fail open.
export function useHowItWorks() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { setOpen(localStorage.getItem(KEY) !== '1'); } catch { setOpen(true); }
  }, []);
  const hide = useCallback(() => {
    setOpen(false);
    try { localStorage.setItem(KEY, '1'); } catch { /* storage blocked */ }
  }, []);
  const show = useCallback(() => {
    setOpen(true);
    try { localStorage.removeItem(KEY); } catch { /* storage blocked */ }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  return { open, hide, show };
}

const STEPS = [
  {
    title: 'We find businesses',
    body: 'Every day we look for businesses with no website or a weak one, and check they are still open.',
  },
  {
    title: 'We write the message',
    body: 'Each lead gets a short, personal message ready to go. You can edit it or ask for a new version.',
  },
  {
    title: 'You approve, we send',
    body: 'Click Schedule email and it goes out from your inbox on a weekday morning, with polite follow-ups if they do not reply.',
  },
];

export function HowItWorks({ onClose }: { onClose: () => void }) {
  return (
    <section className="how" aria-label="How it works">
      <div className="how-head">
        <span className="section-title">How it works</span>
        <button className="icon-btn quiet" onClick={onClose} aria-label="Hide this" title="Hide this"><Icon name="x" size={14} /></button>
      </div>
      <ol className="how-steps">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <span className="how-num">{i + 1}</span>
            <div>
              <strong>{s.title}</strong>
              <p>{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
