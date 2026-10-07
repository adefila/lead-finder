'use client';

import { useEffect, useRef } from 'react';
import { Icon } from '@/components/ui';

// Leads checked per request: small enough that the progress moves every few seconds.
export const HUNT_STEP = 4;

export interface EmailHunt {
  total: number;
  checked: number;
  found: number;
  skipped: number;
  // Businesses being worked on right now.
  current: string[];
  // Latest results, newest first.
  recent: { name: string; email: string | null; note?: string }[];
  done: boolean;
  error?: string;
  // 'find' looks for addresses; 'write' turns old DM-style messages into emails.
  phase?: 'find' | 'write';
  writeTotal?: number;
  written?: number;
  rewritten?: number;
}

export function huntProgress(h: EmailHunt) {
  const steps = h.total + (h.writeTotal ?? 0);
  const doneSteps = h.checked + (h.written ?? 0);
  const pct = h.done && !h.error && doneSteps >= steps ? 100 : steps ? Math.round((doneSteps / steps) * 100) : 0;
  const stopped = h.done && doneSteps < steps;
  return { pct, stopped, writing: h.phase === 'write' };
}

// Circular progress: a ring that fills with the percentage. Before the first result comes back
// a short arc spins, so it never looks stuck at 0%.
export function ProgressRing({ pct, size, stroke, state }: {
  pct: number; size: number; stroke: number; state: 'running' | 'done' | 'error';
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const waiting = state === 'running' && pct === 0;
  return (
    <svg className={`ring ring-${state}${waiting ? ' ring-waiting' : ''}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
      <circle
        className="ring-fill" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={waiting ? c * 0.78 : c * (1 - pct / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export function EmailHuntModal({ hunt, onHide, onStop, onShowSkipped }: {
  hunt: EmailHunt;
  onHide: () => void;
  onStop: () => void;
  onShowSkipped: () => void;
}) {
  const { pct, stopped, writing } = huntProgress(hunt);
  const state = hunt.error ? 'error' : hunt.done ? 'done' : 'running';
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onHide(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); before?.focus?.(); };
  }, [onHide]);

  const title = hunt.error ? 'Stopped'
    : !hunt.done ? (writing ? 'Rewriting messages as emails' : 'Finding emails')
    : stopped ? 'Stopped' : 'All done';
  const progressLine = writing
    ? `${hunt.written ?? 0} of ${hunt.writeTotal} messages`
    : `${hunt.checked} of ${hunt.total} leads checked`;
  const summary = [
    hunt.total > 0 ? `Found ${hunt.found} email${hunt.found === 1 ? '' : 's'}. ${hunt.skipped} lead${hunt.skipped === 1 ? '' : 's'} without one moved to Skipped.` : '',
    hunt.rewritten ? `Rewrote ${hunt.rewritten} message${hunt.rewritten === 1 ? '' : 's'} as email${hunt.rewritten === 1 ? '' : 's'}.` : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="hm-overlay">
      <div className="hm-scrim" onClick={onHide} aria-hidden />
      <section className="hm" role="dialog" aria-modal="true" aria-labelledby="hm-title" tabIndex={-1} ref={dialogRef}>
        <button className="hm-close" onClick={onHide} aria-label={hunt.done ? 'Close' : 'Hide, it keeps running'}>
          <Icon name="x" size={14} />
        </button>

        <div className="hm-hero" aria-live="polite">
          <div className="hm-ring">
            <ProgressRing pct={pct} size={128} stroke={8} state={state} />
            <div className="hm-ring-label">
              {state === 'done' && !stopped ? <span className="hm-check"><Icon name="check" size={30} /></span>
                : <><strong>{pct}</strong><span>%</span></>}
            </div>
          </div>
          <h2 id="hm-title" className="hm-title">{title}</h2>
          <p className="hm-sub">
            {hunt.error ? hunt.error : hunt.done ? summary || 'Nothing needed changing.' : progressLine}
          </p>
          {(hunt.writeTotal ?? 0) > 0 && hunt.total > 0 && (
            <ol className="hm-steps" aria-label="Steps">
              <li className={writing || hunt.done ? 'done' : 'on'}>Find emails</li>
              <li className={hunt.done && !stopped ? 'done' : writing ? 'on' : ''}>Rewrite messages</li>
            </ol>
          )}
        </div>

        <div className="hm-stats">
          {hunt.total > 0 && <div className="hm-stat good"><strong>{hunt.found}</strong><span>found</span></div>}
          {hunt.total > 0 && <div className="hm-stat"><strong>{hunt.skipped}</strong><span>skipped</span></div>}
          {(hunt.writeTotal ?? 0) > 0 && <div className="hm-stat"><strong>{hunt.rewritten ?? 0}</strong><span>rewritten</span></div>}
        </div>

        {!hunt.done && hunt.current.length > 0 && (
          <div className="hm-now">
            <span className="hm-pulse" aria-hidden />
            <span className="hm-now-label">{writing ? 'Writing emails for' : 'Checking'}</span>
            <span className="ellipsis">{hunt.current.join(', ')}</span>
          </div>
        )}

        {hunt.recent.length > 0 && (
          <ul className="hm-list">
            {hunt.recent.map((r, i) => (
              <li key={`${r.name}-${hunt.checked + (hunt.written ?? 0)}-${i}`}>
                <span className={`hm-dot${r.email ? ' good' : ''}`} aria-hidden>
                  <Icon name={r.email ? 'check' : 'x'} size={11} />
                </span>
                <span className="ellipsis hm-name">{r.name}</span>
                <span className={`ellipsis ${r.email ? 'hm-email' : 'muted'}`}>{r.email ?? r.note ?? 'No email, skipped'}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="hm-foot">
          {!hunt.done ? (
            <>
              <span className="hm-hint">You can hide this and keep working.</span>
              <button className="btn btn-sm btn-quiet" onClick={onStop}>Stop</button>
              <button className="btn btn-sm btn-primary" onClick={onHide}>Hide</button>
            </>
          ) : (
            <>
              <span className="hm-hint" />
              {hunt.skipped > 0 && <button className="btn btn-sm" onClick={onShowSkipped}>Show skipped</button>}
              <button className="btn btn-sm btn-primary" onClick={onHide}>Close</button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

// Shown in the corner while the pop-up is hidden. Click to open it again.
export function EmailHuntDock({ hunt, onOpen }: { hunt: EmailHunt; onOpen: () => void }) {
  const { pct, stopped, writing } = huntProgress(hunt);
  const state = hunt.error ? 'error' : hunt.done ? 'done' : 'running';
  const label = hunt.error ? 'Email search stopped'
    : hunt.done ? (stopped ? 'Email search stopped' : 'Emails done')
    : writing ? 'Rewriting messages' : 'Finding emails';
  return (
    <button className={`hm-dock hm-dock-${state}`} onClick={onOpen} aria-label={`${label}, ${pct}%. Open progress`}>
      <span className="hm-dock-ring">
        <ProgressRing pct={pct} size={44} stroke={4} state={state} />
        <span className="hm-dock-pct">
          {state === 'done' && !stopped ? <Icon name="check" size={16} /> : state === 'error' ? '!' : `${pct}%`}
        </span>
      </span>
      <span className="hm-dock-text">
        <strong>{label}</strong>
        <span>{hunt.done ? 'Click to see results' : writing ? `${hunt.written ?? 0} of ${hunt.writeTotal}` : `${hunt.checked} of ${hunt.total}`}</span>
      </span>
    </button>
  );
}
