import type { Lead, LeadStatus } from '@/types/lead';
import { followUpState, needsAttention, MAX_FOLLOW_UPS } from '@/lib/followup';

// Where the lead came from, in words a non-technical person would use.
export const SOURCE_LABEL: Record<Lead['source'], string> = {
  freelancer: 'Job post',
  places: 'Google Maps',
  osm: 'Local map',
  companies_house: 'Company register',
};

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'To contact',
  queued: 'Scheduled',
  approved: 'Waiting for reply',
  replied: 'Replied',
  won: 'Won',
  lost: 'Lost',
  skipped: 'Skipped',
};

// Dot colour next to each status. Green only means good news.
export const STATUS_TONE: Record<LeadStatus, string> = {
  new: '',
  queued: 'dark',
  approved: '',
  replied: 'green',
  won: 'green',
  lost: 'faded',
  skipped: 'faded',
};

export type View = 'all' | 'new' | 'queued' | 'approved' | 'replied' | 'done';
export type Sub = 'all' | 'followup' | 'won' | 'lost' | 'skipped';

export const VIEWS: { id: View; label: string; hint: string }[] = [
  { id: 'all', label: 'All', hint: 'Every lead' },
  { id: 'new', label: 'To contact', hint: 'New leads you have not reached out to yet' },
  { id: 'queued', label: 'Scheduled', hint: 'Emails that will go out on their own, a few each weekday' },
  { id: 'approved', label: 'Waiting for reply', hint: 'You have contacted them and are waiting to hear back' },
  { id: 'replied', label: 'Replied', hint: 'They wrote back' },
  { id: 'done', label: 'Done', hint: 'Won, lost or skipped' },
];

export const SUBS: Partial<Record<View, { id: Sub; label: string }[]>> = {
  approved: [{ id: 'all', label: 'All' }, { id: 'followup', label: 'Needs a follow-up' }],
  done: [{ id: 'all', label: 'All' }, { id: 'won', label: 'Won' }, { id: 'lost', label: 'Lost' }, { id: 'skipped', label: 'Skipped' }],
};

export const HEADLINES = ['No website', 'No own website', 'No website yet', 'Outdated website', 'Website broken'];

export const statusOf = (l: Lead): LeadStatus => l.status ?? 'new';

export function inView(l: Lead, view: View, sub: Sub = 'all'): boolean {
  const s = statusOf(l);
  if (view === 'all') return true;
  if (view === 'done') return sub === 'all' ? ['won', 'lost', 'skipped'].includes(s) : s === sub;
  if (view === 'approved' && sub === 'followup') return needsAttention(l);
  return s === view;
}

export function headlineOf(l: Lead): string | null {
  if (!['places', 'osm', 'companies_house'].includes(l.source)) return null;
  const first = l.description.split('. ')[0];
  return HEADLINES.includes(first) ? first : null;
}

// ─── Plain-English story behind a lead ───────────────────────────────────────

const PROBLEMS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/no website listed on Google/i, () => 'They have no website. People who find them on Google have nowhere to click through to.'],
  [/no website found for this new company/i, () => 'They are a brand-new company with no website yet.'],
  [/links to an? (.+?) page instead of their own website/i, m => `Their Google listing sends people to a ${m[1]} page, not a website they own.`],
  [/uses an? (.+?) booking page instead of their own website/i, m => `They take bookings through ${m[1]} instead of a website of their own.`],
  [/no HTTPS/i, () => 'Browsers warn visitors that the site is "Not secure".'],
  [/not mobile-friendly/i, () => 'The site is hard to use on a phone.'],
  [/footer copyright says (\d{4})/i, m => `The site looks like it has not been updated since ${m[1]}.`],
  [/very old HTML/i, () => 'The site is built with very old technology.'],
  [/free builder subdomain/i, () => 'The site sits on a free builder address instead of its own domain name.'],
  [/under construction|coming soon/i, () => 'The site still says "coming soon".'],
  [/almost no content/i, () => 'The homepage has almost nothing on it.'],
  [/down or broken/i, () => 'Their website does not load.'],
];

function plainProblem(raw: string): string {
  for (const [re, say] of PROBLEMS) {
    const m = raw.match(re);
    if (m) return say(m);
  }
  const t = raw.trim();
  return t.charAt(0).toUpperCase() + t.slice(1) + (/[.!?]$/.test(t) ? '' : '.');
}

function plainActivity(raw: string): string | null {
  const parts = raw.split(/,\s*/).map(p => p.trim()).flatMap(p => {
    if (/^open on Google$/i.test(p)) return ['listed as open on Google'];
    const review = p.match(/^last review (.+)$/i);
    if (review) return [`a customer left a review ${review[1]}`];
    const reg = p.match(/^registered on Companies House (.+)$/i);
    if (reg) return [`registered as a company ${reg[1]}`];
    const booking = p.match(/^taking bookings on (.+)$/i);
    if (booking) return [`taking bookings on ${booking[1]}`];
    if (/^website online$/i.test(p)) return ['their website is online'];
    if (/^opening hours listed$/i.test(p)) return ['opening hours are posted'];
    return [];
  });
  if (!parts.length) return null;
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return text.charAt(0).toUpperCase() + text.slice(1) + '.';
}

export interface LeadStory {
  headline: string | null;
  stillOpen: string | null;
  problems: string[];
  other: string[];
}

export function leadStory(l: Lead): LeadStory {
  if (l.source === 'freelancer') return { headline: null, stillOpen: null, problems: [], other: [l.description] };
  const headline = headlineOf(l);
  // Sentences end with ". " then a capital or digit, so "4.8 stars" stays whole.
  const sentences = l.description.replace(/\.$/, '').split(/\.\s+(?=[A-Z0-9])/).map(s => s.trim()).filter(Boolean);
  let stillOpen: string | null = null;
  let problems: string[] = [];
  const other: string[] = [];
  for (const s of sentences) {
    if (s === headline) continue;
    if (/^Verified active:/i.test(s)) stillOpen = plainActivity(s.replace(/^Verified active:\s*/i, ''));
    else if (/^Issues found:/i.test(s)) problems = s.replace(/^Issues found:\s*/i, '').split(/;\s*/).filter(Boolean).map(plainProblem);
    else if (!/^Director:/i.test(s)) other.push(s.endsWith('.') ? s : `${s}.`);
  }
  return { headline, stillOpen, problems, other };
}

export function whyText(l: Lead): string {
  const s = leadStory(l);
  return [...s.problems, s.stillOpen ?? '', ...s.other].filter(Boolean).join(' ');
}

// ─── Fit ─────────────────────────────────────────────────────────────────────

export const FIT_HINT = 'How likely they are to need a website and pay for one';

export function fitOf(score?: number): { label: string; tone: string } {
  const s = score ?? 0;
  if (s >= 75) return { label: 'Strong', tone: 'strong' };
  if (s >= 55) return { label: 'Good', tone: 'good' };
  return { label: 'Weak', tone: 'weak' };
}

// ─── Small helpers ───────────────────────────────────────────────────────────

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

export function pct(part: number, whole: number): string {
  return whole ? `${Math.round((part / whole) * 100)}%` : '0%';
}

// What to do next, as a short instruction.
export function nextStep(l: Lead): { text: string; urgent: boolean } {
  const s = statusOf(l);
  if (s === 'new') {
    if (l.source === 'freelancer') return { text: 'Send a proposal', urgent: false };
    if (l.contactEmail) return { text: 'Email them', urgent: false };
    if (l.source === 'companies_house') return { text: 'Message on LinkedIn', urgent: false };
    return { text: 'Call or message', urgent: false };
  }
  if (s === 'approved') {
    const fu = followUpState(l);
    if (fu.exhausted) return { text: 'No reply, close it', urgent: true };
    if (fu.due) return l.autoSequence
      ? { text: 'Follow-up going out', urgent: false }
      : { text: 'Send a follow-up', urgent: true };
    if (fu.sent >= MAX_FOLLOW_UPS) return { text: 'Waiting', urgent: false };
    return { text: `Follow up ${shortDate(fu.dueAt)}`, urgent: false };
  }
  if (s === 'queued') return { text: l.sendError ? 'Could not send' : 'Goes out on its own', urgent: !!l.sendError };
  if (s === 'replied') return { text: 'Reply to them', urgent: false };
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
  if (view === 'approved') return { key: 'next', dir: 1 };
  return { key: 'added', dir: -1 };
}
