import type { Lead, LeadStatus } from '@/types/lead';
import { isBounced, isJobLead, pct, statusOf, type Sub, type View } from '@/lib/leadview';
import { STRONG_MATCH } from '@/lib/jobmatch';

interface Card { label: string; value: number; sub: string; view?: View; subView?: Sub; bad?: boolean }

// The numbers as cards. On the Jobs tab they are about jobs: to apply, applied, who got back, still waiting.
// Elsewhere they cover every lead, with who replied and who has not. A card with somewhere to go opens that list.
export function Funnel({ leads, view, onOpen }: { leads: Lead[]; view: View; onOpen: (view: View, sub?: Sub) => void }) {
  const count = (list: Lead[], ...s: LeadStatus[]) => list.filter(l => s.includes(statusOf(l))).length;
  let cards: Card[];

  if (view === 'jobs') {
    const jobs = leads.filter(isJobLead);
    const toApply = count(jobs, 'new');
    const applied = count(jobs, 'approved', 'replied', 'won', 'lost');
    const back = count(jobs, 'replied', 'won');
    const waiting = count(jobs, 'approved');
    const strong = jobs.filter(l => statusOf(l) === 'new' && (l.contactLinks?.match?.score ?? 0) >= STRONG_MATCH).length;
    cards = [
      { label: 'Jobs found', value: jobs.length, sub: 'all time' },
      { label: 'To apply', value: toApply, sub: `${strong} strong match${strong === 1 ? '' : 'es'}`, view: 'jobs' },
      { label: 'Applied', value: applied, sub: jobs.length ? `${pct(applied, jobs.length)} of found` : 'none yet' },
      { label: 'Got back', value: back, sub: applied ? `${pct(back, applied)} of applied` : 'none yet', view: 'replied' },
      { label: 'No reply yet', value: waiting, sub: applied ? `${pct(waiting, applied)} of applied` : 'none yet', view: 'approved' },
    ];
  } else {
    const contacted = count(leads, 'approved', 'replied', 'won', 'lost');
    const replied = count(leads, 'replied', 'won', 'lost');
    const waiting = count(leads, 'approved');
    const bounced = leads.filter(isBounced).length;
    const jobs = leads.filter(isJobLead);
    const toApply = count(jobs, 'new');
    cards = [
      { label: 'Found', value: leads.length, sub: 'all leads', view: 'all' },
      { label: 'Jobs', value: jobs.length, sub: `${toApply} to apply`, view: 'jobs' },
      { label: 'Contacted', value: contacted, sub: contacted && leads.length ? `${pct(contacted, leads.length)} of found` : 'none yet', view: 'approved' },
      { label: 'Replied', value: replied, sub: contacted ? `${pct(replied, contacted)} of contacted` : 'none yet', view: 'replied' },
      { label: 'No reply yet', value: waiting, sub: contacted ? `${pct(waiting, contacted)} of contacted` : 'none yet', view: 'approved' },
      { label: 'Won', value: count(leads, 'won'), sub: replied ? `${pct(count(leads, 'won'), replied)} of replies` : 'none yet', view: 'done', subView: 'won' },
      { label: 'Bounced', value: bounced, sub: contacted ? `${pct(bounced, contacted)} of contacted` : 'none yet', view: 'done', subView: 'lost', bad: bounced > 0 },
    ];
  }

  return (
    <div className="stats" style={{ '--n': cards.length } as React.CSSProperties} aria-label="Your progress">
      {cards.map(c => {
        const body = (
          <>
            <span className="stat-label">{c.label}</span>
            <span className="stat-value">{c.value}</span>
            <span className="stat-sub">{c.sub}</span>
          </>
        );
        return c.view
          ? <button key={c.label} className={`stat${c.bad ? ' bad' : ''}`} onClick={() => onOpen(c.view!, c.subView)}>{body}</button>
          : <div key={c.label} className="stat static">{body}</div>;
      })}
    </div>
  );
}
