'use client';

import { Icon } from '@/components/ui';

// Leads checked per request: small enough that the banner moves every few seconds.
export const HUNT_STEP = 4;

export interface EmailHunt {
  total: number;
  checked: number;
  found: number;
  skipped: number;
  // Businesses being checked right now.
  current: string[];
  // Latest results, newest first.
  recent: { name: string; email: string | null }[];
  done: boolean;
  error?: string;
}

export function EmailHuntBanner({ hunt, onStop, onClose, onShowSkipped }: {
  hunt: EmailHunt;
  onStop: () => void;
  onClose: () => void;
  onShowSkipped: () => void;
}) {
  const pct = hunt.total ? Math.round((hunt.checked / hunt.total) * 100) : 0;
  const stopped = hunt.done && hunt.checked < hunt.total;

  return (
    <div className={`banner hunt${hunt.error ? ' error' : ''}`} role="status" aria-live="polite">
      <div className="hunt-head">
        {!hunt.done && <span className="spinner" aria-hidden />}
        {hunt.done && !hunt.error && <Icon name="check" size={14} />}
        <span>
          {hunt.error ? hunt.error
            : !hunt.done ? <><strong>Finding emails</strong> · {hunt.checked} of {hunt.total} checked</>
            : <><strong>{stopped ? 'Stopped' : 'Done'}.</strong> Found {hunt.found} email{hunt.found === 1 ? '' : 's'}, {hunt.skipped} lead{hunt.skipped === 1 ? '' : 's'} without one moved to Skipped.</>}
        </span>
        <span className="hunt-counts">
          <span className="hunt-found">{hunt.found} found</span>
          <span>{hunt.skipped} skipped</span>
        </span>
      </div>

      <div className="hunt-bar" aria-hidden><i style={{ width: `${pct}%` }} /></div>

      {!hunt.done && hunt.current.length > 0 && (
        <div className="hunt-now"><span>Checking websites for</span> <span className="ellipsis">{hunt.current.join(', ')}</span></div>
      )}

      {hunt.recent.length > 0 && (
        <ul className="hunt-recent">
          {hunt.recent.map((r, i) => (
            <li key={`${r.name}-${i}`}>
              <span className="ellipsis">{r.name}</span>
              {r.email ? <span className="hunt-email ellipsis">{r.email}</span> : <span className="muted">No email, skipped</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="hunt-actions">
        {!hunt.done && <button className="link-btn plain" onClick={onStop}>Stop after this step</button>}
        {hunt.done && hunt.skipped > 0 && <button className="link-btn plain" onClick={onShowSkipped}>Show skipped</button>}
      </div>
      {hunt.done && <button className="banner-close" onClick={onClose} aria-label="Dismiss"><Icon name="x" size={12} /></button>}
    </div>
  );
}
