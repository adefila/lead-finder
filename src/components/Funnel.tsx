import type { Lead, LeadStatus } from '@/types/lead';
import { pct, statusOf } from '@/lib/leadview';

// One sentence-like line: found → contacted → replied → won.
export function Funnel({ leads }: { leads: Lead[] }) {
  const count = (...s: LeadStatus[]) => leads.filter(l => s.includes(statusOf(l))).length;
  const contacted = count('approved', 'replied', 'won', 'lost');
  const replied = count('replied', 'won', 'lost');
  const stages = [
    { label: 'found', value: leads.length },
    { label: 'contacted', value: contacted },
    { label: 'replied', value: replied },
    { label: 'won', value: count('won') },
  ];

  return (
    <p className="pipeline" aria-label="Your progress">
      {stages.map((s, i) => (
        <span key={s.label} className="pipeline-step">
          {i > 0 && <span className="pipeline-arrow" aria-hidden>→</span>}
          <strong>{s.value}</strong> {s.label}
        </span>
      ))}
      {contacted > 0 && <span className="pipeline-note">{pct(replied, contacted)} of people you contacted replied</span>}
    </p>
  );
}
