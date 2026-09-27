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
  // In pipeline order, like HubSpot or Pipedrive: each lead moves left to right.
  { id: 'all', label: 'All', hint: 'Every lead, whatever stage it is at.' },
  { id: 'new', label: 'To contact', hint: 'New leads you have not reached out to yet. Best fit first.' },
  { id: 'queued', label: 'Scheduled', hint: 'Emails that go out on their own, a few each weekday morning.' },
  { id: 'approved', label: 'Waiting for reply', hint: 'You have been in touch. Follow-ups go out on their own until they reply.' },
  { id: 'replied', label: 'Replied', hint: 'They wrote back. Reply quickly, this is where deals are won.' },
  { id: 'done', label: 'Done', hint: 'Leads you won, lost or skipped.' },
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

// Each finding in three voices: for you (about), for the owner (you/your), and the fix you would offer.
interface Finding { about: string; owner: string; fix: string }
const PROBLEMS: [RegExp, (m: RegExpMatchArray) => Finding][] = [
  [/no website listed on Google/i, () => ({
    about: 'They have no website. People who find them on Google have nowhere to click through to.',
    owner: 'Your Google listing has no website, so people who find you there have nowhere to click through to.',
    fix: 'A simple, fast website with your services, opening hours, reviews and an easy way to call or book.' })],
  [/no website found for this new company/i, () => ({
    about: 'They are a brand-new company with no website yet.',
    owner: 'Your company is new and does not have a website yet, so people searching your name will not find you.',
    fix: 'A launch website that tells people what you do and how to reach you, ready in about a week.' })],
  [/links to an? (.+?) page instead of their own website/i, m => ({
    about: `Their Google listing sends people to a ${m[1]} page, not a website they own.`,
    owner: `Your Google listing sends people to a ${m[1]} page rather than a website you own.`,
    fix: `Your own website that still links to ${m[1]}, so your listing points to something you control.` })],
  [/uses an? (.+?) booking page instead of their own website/i, m => ({
    about: `They take bookings through ${m[1]} instead of a website of their own.`,
    owner: `You take bookings through ${m[1]}, but there is no website of your own to show who you are.`,
    fix: `Your own website with your story, prices and photos, with a button through to your ${m[1]} bookings.` })],
  [/no HTTPS/i, () => ({
    about: 'Browsers warn visitors that the site is "Not secure".',
    owner: 'Browsers show a "Not secure" warning when people open your site.',
    fix: 'A secure address (the padlock) so visitors are not warned away.' })],
  [/not mobile-friendly/i, () => ({
    about: 'The site is hard to use on a phone.',
    owner: 'Your site is hard to read on a phone, which is where most people look you up.',
    fix: 'A layout built for phones first, with your phone number and directions one tap away.' })],
  [/footer copyright says (\d{4})/i, m => ({
    about: `The site looks like it has not been updated since ${m[1]}.`,
    owner: `Your site says ${m[1]} at the bottom, which makes it look like it has not been looked after since then.`,
    fix: 'A refreshed design with up-to-date information that you can edit yourself.' })],
  [/very old HTML/i, () => ({
    about: 'The site is built with very old technology.',
    owner: 'Your site is built with very old technology, so it looks dated and loads slowly.',
    fix: 'A modern, fast site that looks right on every screen.' })],
  [/free builder subdomain/i, () => ({
    about: 'The site sits on a free builder address instead of its own domain name.',
    owner: 'Your site is on a free builder address rather than your own domain name.',
    fix: 'Your own domain name, such as yourbusiness.co.uk, with a matching email address.' })],
  [/under construction|coming soon/i, () => ({
    about: 'The site still says "coming soon".',
    owner: 'Your site still says "coming soon", so visitors leave without getting in touch.',
    fix: 'A real homepage that explains what you offer and brings in enquiries.' })],
  [/almost no content/i, () => ({
    about: 'The homepage has almost nothing on it.',
    owner: 'Your homepage has very little on it, so visitors cannot tell what you offer.',
    fix: 'Clear pages for your services, prices and contact details.' })],
  [/down or broken/i, () => ({
    about: 'Their website does not load.',
    owner: 'Your website did not load when I tried it, so anyone clicking through from Google hits a dead end.',
    fix: 'Get a working site back online quickly, on reliable hosting.' })],
];

function finding(raw: string): Finding {
  for (const [re, say] of PROBLEMS) {
    const m = raw.match(re);
    if (m) return say(m);
  }
  const t = raw.trim();
  const sentence = t.charAt(0).toUpperCase() + t.slice(1) + (/[.!?]$/.test(t) ? '' : '.');
  return { about: sentence, owner: sentence, fix: '' };
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
  // The same problems addressed to the owner, and what you would change. Used on the check page.
  ownerProblems: string[];
  fixes: string[];
  other: string[];
}

export function leadStory(l: Lead): LeadStory {
  if (l.source === 'freelancer') return { headline: null, stillOpen: null, problems: [], ownerProblems: [], fixes: [], other: [l.description] };
  const headline = headlineOf(l);
  // Sentences end with ". " then a capital or digit, so "4.8 stars" stays whole.
  const sentences = l.description.replace(/\.$/, '').split(/\.\s+(?=[A-Z0-9])/).map(s => s.trim()).filter(Boolean);
  let stillOpen: string | null = null;
  let found: Finding[] = [];
  const other: string[] = [];
  for (const s of sentences) {
    if (s === headline) continue;
    if (/^Verified active:/i.test(s)) stillOpen = plainActivity(s.replace(/^Verified active:\s*/i, ''));
    else if (/^Issues found:/i.test(s)) found = s.replace(/^Issues found:\s*/i, '').split(/;\s*/).filter(Boolean).map(finding);
    else if (!/^Director:/i.test(s)) other.push(s.endsWith('.') ? s : `${s}.`);
  }
  return {
    headline,
    stillOpen,
    problems: found.map(f => f.about),
    ownerProblems: found.map(f => f.owner),
    fixes: [...new Set(found.map(f => f.fix).filter(Boolean))],
    other,
  };
}

export function whyText(l: Lead): string {
  const s = leadStory(l);
  return [...s.problems, s.stillOpen ?? '', ...s.other].filter(Boolean).join(' ');
}

// ─── Systems to offer, by trade ──────────────────────────────────────────────
// Not every business needs a new website. Most need something that saves time or wins
// customers. These are offered first; website fixes come second.

const REVIEW_ASK = 'An automatic thank-you message after each visit that asks happy customers for a Google review.';

const SYSTEMS: [RegExp, string[]][] = [
  [/law|solicit|legal|litigat|barrister|notary|immigration/i, [
    'An enquiry form that asks the right questions up front, so you only spend time on cases you can take.',
    'Online booking for a first consultation, linked to your calendar.',
    'Secure document upload, so clients stop emailing files back and forth.',
  ]],
  [/account|tax|bookkeep|consult|advis|financ|insurance|mortgage|architect|survey|engineer/i, [
    'An enquiry form that asks the right questions up front, so every call is with a good-fit client.',
    'Online booking for a first meeting, linked to your calendar.',
    'Secure document upload and automatic reminders for clients who owe you paperwork.',
  ]],
  [/estate|letting|property|real estate|realt/i, [
    'Instant alerts to buyers and renters when a new property matches what they want.',
    'Online viewing booking that fills your diary without phone tag.',
    'Automatic follow-up after each viewing, so interested people hear from you first.',
  ]],
  [/\bdent|orthodont|clinic|medical|doctor|physio|chiro|osteo|skin|spa|salon|hair|beauty|barber|nail|massage|therap|veterin|\bvet\b|animal|optic|gym|fitness|yoga|pilates/i, [
    'Online booking with automatic text and email reminders, so fewer people forget their appointment.',
    REVIEW_ASK,
    'A short form new clients fill in before they arrive, so the first visit starts on time.',
  ]],
  [/restaurant|cafe|café|coffee|bakery|food|bar\b|pub|takeaway|catering|pizza|grill|kitchen/i, [
    'Table bookings or pre-orders online, without paying commission to a big platform.',
    'A simple list of regulars you can message with an offer on quiet days.',
    REVIEW_ASK,
  ]],
  [/shop|store|retail|boutique|florist|jewel|gift/i, [
    'Click-and-collect ordering, so people can buy before they visit.',
    'A customer list you can message about new stock and offers.',
    REVIEW_ASK,
  ]],
  [/roof|plumb|electric|build|contract|construct|landscap|garden|clean|removal|hvac|heating|handyman|joiner|carpent|paint|decorat|glaz|fenc|\bpav(ing|ers)?\b|\btree/i, [
    'A quote request form that sends each job straight to your phone, with photos from the customer.',
    'Automatic follow-up on quotes that have gone quiet, so fewer jobs slip away.',
    'Review requests sent automatically when a job is finished.',
  ]],
];

const DEFAULT_SYSTEMS = [
  'A simple way for customers to enquire or book online, sent straight to your phone.',
  'Automatic review requests after each job or visit.',
  'One place that collects enquiries from your website, email and social media, so nothing gets missed.',
];

export function systemsFor(l: Lead): string[] {
  if (l.source === 'freelancer') return [];
  const trade = `${l.company} ${l.title}`;
  return SYSTEMS.find(([re]) => re.test(trade))?.[1] ?? DEFAULT_SYSTEMS;
}

// Local businesses and new companies get a one-page note with ideas; job posts do not.
export function hasCheck(l: Lead): boolean {
  return systemsFor(l).length > 0;
}

const lcFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// A short script for leads you can only phone. The aim of the call is permission to send the check.
export function callScript(l: Lead): string {
  const s = leadStory(l);
  const name = displayName(l);
  const problem = (s.ownerProblems[0] ?? 'your website could be bringing you more customers.')
    .replace(/^Your /, 'your ').replace(/^You /, 'you ');
  return [
    `Hi, could I speak to the owner or manager? ... Thanks. My name is Samuel, I help small businesses save time and win more customers online.`,
    `I was looking at ${name} online and noticed ${problem.replace(/\.$/, '')}.`,
    `I have written up a short one-page note with a few ideas, like ${lcFirst(systemsFor(l)[0] ?? 'getting more enquiries online.').replace(/\.$/, '')}. It is free, no strings. What is the best email to send it to?`,
    `(If they are busy: "No problem, when is a better time to call back?")`,
  ].join('\n\n');
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

// Google names often carry extra words ("Vanguard Studio | Austin Architect"), and the
// company register is ALL CAPS. Show the short, clean name; the full one is on hover.
export function displayName(l: Lead): string {
  let name = l.title.trim();
  if (l.source !== 'freelancer') {
    const short = name.split(/\s+[|–—-]\s+|\s*[|•]\s*/)[0].trim();
    if (short.length >= 3) name = short;
  }
  if (name.length > 6 && name === name.toUpperCase() && /[A-Z]/.test(name)) {
    name = name.toLowerCase()
      .replace(/(^|[\s&(/-])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase())
      .replace(/\b(Ltd|Llp|Plc|Uk|Nz|Llc|Cic)\b/g, w => (w === 'Ltd' ? 'Ltd' : w.toUpperCase()));
  }
  return name;
}

// LinkedIn's own people search needs you logged in and often shows "page not found",
// so we search Google for their LinkedIn profile instead. This always opens.
export function linkedInSearchUrl(person: string, company: string): string {
  const q = `"${person}" "${company.replace(/\s+(ltd|limited|llp|plc)\.?$/i, '')}" site:linkedin.com/in`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

// A ready-made Google search for a business's email address.
export function findEmailUrl(l: Lead): string {
  const city = l.company.split(' · ')[1]?.split(',')[0] ?? '';
  return `https://www.google.com/search?q=${encodeURIComponent(`"${displayName(l)}" ${city} email`.trim())}`;
}

// Older leads saved a LinkedIn people-search link; swap it for the Google search.
export function withWorkingLinks(l: Lead): Lead {
  const li = l.contactLinks?.linkedin;
  if (!li || !li.includes('linkedin.com/search/results')) return l;
  const person = l.contactName || new URL(li).searchParams.get('keywords') || '';
  return { ...l, contactLinks: { ...l.contactLinks, linkedin: linkedInSearchUrl(person, displayName(l)) } };
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
