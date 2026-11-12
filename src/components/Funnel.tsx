import type { Lead, LeadStatus } from '@/types/lead';
import { isBounced, pct, statusOf, type Sub, type View } from '@/lib/leadview';

// The numbers as cards: found, contacted, replied, won, bounced. Each opens the matching list.
export function Funnel({ leads, onOpen }: { leads: Lead[]; onOpen: (view: View, sub?: Sub) => void }) {
  const count = (...s: LeadStatus[]) => leads.filter(l => s.includes(statusOf(l))).length;
  const contacted = count('approved', 'replied', 'won', 'lost');
  const replied = count('replied', 'won', 'lost');
  const bounced = leads.filter(isBounced).length;

  const cards: { label: string; value: number; sub: string; view: View; subView?: Sub; bad?: boolean }[] = [
    { label: 'Found', value: leads.length, sub: 'all leads', view: 'all' },
    { label: 'Contacted', value: contacted, sub: contacted && leads.length ? `${pct(contacted, leads.length)} of found` : 'none yet', view: 'approved' },
    { label: 'Replied', value: replied, sub: contacted ? `${pct(replied, contacted)} of contacted` : 'none yet', view: 'replied' },
    { label: 'Won', value: count('won'), sub: replied ? `${pct(count('won'), replied)} of replies` : 'none yet', view: 'done', subView: 'won' },
    { label: 'Bounced', value: bounced, sub: contacted ? `${pct(bounced, contacted)} of contacted` : 'none yet', view: 'done', subView: 'lost', bad: bounced > 0 },
  ];

  return (
    <div className="stats" aria-label="Your progress">
      {cards.map(c => (
        <button key={c.label} className={`stat${c.bad ? ' bad' : ''}`} onClick={() => onOpen(c.view, c.subView)}>
          <span className="stat-label">{c.label}</span>
          <span className="stat-value">{c.value}</span>
          <span className="stat-sub">{c.sub}</span>
        </button>
      ))}
    </div>
  );
}
