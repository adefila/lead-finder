import type { Lead, LeadStatus } from '@/types/lead';
import { followUpState, needsAttention, MAX_FOLLOW_UPS } from '@/lib/followup';

export const SOURCE_LABEL: Record<Lead['source'], string> = {
  upwork: 'Upwork',
  remoteok: 'RemoteOK',
  remotive: 'Remotive',
  weworkremotely: 'We Work Remotely',
  apollo: 'Apollo',
  freelancer: 'Freelancer',
  places: 'Local business',
};

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'To contact',
  approved: 'Contacted',
  replied: 'Replied',
  won: 'Won',
  lost: 'Lost',
  skipped: 'Skipped',
};

export const STATUS_TONE: Record<LeadStatus, string> = {
  new: 'blue',
  approved: '',
  replied: 'purple',
  won: 'green',
  lost: 'red',
  skipped: 'muted',
};

export type View = 'all' | 'new' | 'approved' | 'followup' | 'replied' | 'won' | 'lost' | 'skipped';

export const VIEWS: { id: View; label: string }[] = [
  { id: 'new', label: 'To contact' },
  { id: 'approved', label: 'Contacted' },
  { id: 'followup', label: 'Follow up' },
  { id: 'replied', label: 'Replied' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
  { id: 'skipped', label: 'Skipped' },
  { id: 'all', label: 'All' },
];

export const HEADLINES = ['No website', 'Outdated website', 'Website broken'];

export const statusOf = (l: Lead): LeadStatus => l.status ?? 'new';

export function inView(l: Lead, view: View): boolean {
  if (view === 'all') return true;
  if (view === 'followup') return needsAttention(l);
  return statusOf(l) === view;
}

export function headlineOf(l: Lead): string | null {
  if (l.source !== 'places') return null;
  const first = l.description.split('. ')[0];
  return HEADLINES.includes(first) ? first : null;
}

export function whyText(l: Lead): string {
  const h = headlineOf(l);
  return h ? l.description.slice(h.length + 2) : l.description;
}

export function personOf(l: Lead): string {
  return l.contactName && l.contactName !== l.title ? l.contactName : '';
}

export function shortDate(value?: string | Date | null): string {
  if (!value) return '';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function relativeTime(iso?: string | null): string {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function dayKey(iso?: string): string {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : 'unknown';
}

export function scoreClass(s: number): string {
  if (s >= 75) return 'score hi';
  if (s >= 55) return 'score mid';
  return 'score';
}

export function pct(part: number, whole: number): string {
  return whole ? `${Math.round((part / whole) * 100)}%` : '0%';
}

export function nextStep(l: Lead): { text: string; urgent: boolean } {
  const s = statusOf(l);
  if (s === 'new') return { text: l.source === 'freelancer' ? 'Send bid' : l.contactEmail ? 'Send email' : 'Call or DM', urgent: false };
  if (s === 'approved') {
    const fu = followUpState(l);
    if (fu.exhausted) return { text: 'Close or mark reply', urgent: true };
    if (fu.due) return { text: `Follow-up ${fu.sent + 1} due`, urgent: true };
    if (fu.sent >= MAX_FOLLOW_UPS) return { text: 'Waiting for reply', urgent: false };
    return { text: `Follow up ${shortDate(fu.dueAt)}`, urgent: false };
  }
  if (s === 'replied') return { text: 'Close the deal', urgent: false };
  return { text: '', urgent: false };
}

export function matchesSearch(l: Lead, q: string): boolean {
  if (!q) return true;
  const hay = `${l.title} ${l.company} ${l.contactName ?? ''} ${l.contactEmail ?? ''} ${l.contactPhone ?? ''}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).every(t => hay.includes(t));
}

export type SortKey = 'score' | 'name' | 'added' | 'next';

export function sortLeads(list: Lead[], key: SortKey, dir: 1 | -1): Lead[] {
  const val = (l: Lead): number | string => {
    if (key === 'score') return l.score ?? 0;
    if (key === 'name') return l.title.toLowerCase();
    if (key === 'added') return l.createdAt ?? '';
    return followUpState(l).dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  };
  return [...list].sort((a, b) => {
    const x = val(a), y = val(b);
    return (x < y ? -1 : x > y ? 1 : 0) * dir;
  });
}

export function defaultSort(view: View): { key: SortKey; dir: 1 | -1 } {
  if (view === 'new') return { key: 'score', dir: -1 };
  if (view === 'followup') return { key: 'next', dir: 1 };
  return { key: 'added', dir: -1 };
}
