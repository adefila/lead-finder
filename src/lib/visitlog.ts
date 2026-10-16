import { createHash } from 'crypto';
import { headers } from 'next/headers';
import type { Lead } from '@/types/lead';
import { getLeadById, logVisitEvent, recentVisitEvents, updateLead } from '@/lib/supabase';

// Every counted click on a tracked link (the adefilasamuel.com link and the one-page note) is
// written to a small log: when, which lead, from what network and browser. Email security tools
// and link checkers open many links one after another, so a run of different leads clicking
// within a few minutes is treated as a scanner, not as interest, and those clicks are undone.

export type VisitKind = 'site' | 'note';
export interface VisitEvent { at: number; kind: VisitKind; leadId: string; net: string; where: string; ua: string }

const BURST_WINDOW_MS = 5 * 60_000;
const BURST_LEADS = 3; // this many different leads within the window = a scanner

const clean = (s: string, max: number) => s.replace(/[|\s]+/g, ' ').trim().slice(0, max);

// What we keep about the visitor: a short hash of the address (so repeat visitors can be matched
// without storing the address), the country and city from the host, and the browser string.
export async function visitContext(): Promise<{ net: string; where: string; ua: string }> {
  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || '';
  const net = ip ? createHash('sha256').update(`${ip}:${process.env.CRON_SECRET ?? ''}`).digest('hex').slice(0, 8) : '-';
  const city = decodeURIComponent(h.get('x-vercel-ip-city') ?? '');
  const where = clean([city, h.get('x-vercel-ip-country') ?? ''].filter(Boolean).join(' '), 40) || '-';
  return { net, where, ua: h.get('user-agent') ?? '' };
}

const encode = (e: VisitEvent) => `visit|${e.at}|${e.kind}|${e.leadId}|${e.net}|${e.where}|${clean(e.ua, 90)}`.slice(0, 250);

export function decode(id: string): VisitEvent | null {
  const [tag, at, kind, leadId, net, where, ...ua] = id.split('|');
  if (tag !== 'visit' || !Number(at) || !leadId) return null;
  return { at: Number(at), kind: kind === 'note' ? 'note' : 'site', leadId, net: net ?? '-', where: where ?? '-', ua: ua.join('|') };
}

// A burst: this click plus clicks from other leads inside the window reach BURST_LEADS.
export function burstLeads(events: VisitEvent[], leadId: string, now: number): string[] {
  const others = new Set(events.filter(e => now - e.at <= BURST_WINDOW_MS && e.leadId !== leadId).map(e => e.leadId));
  return others.size + 1 >= BURST_LEADS ? [...others] : [];
}

// Call when a click would count. Logs it, and returns true when it belongs to a burst (so the
// caller must not count it). Clicks already counted for the other leads in the burst are undone.
export async function logVisitAndCheckBurst(lead: Lead, kind: VisitKind, ctx?: { net: string; where: string; ua: string }): Promise<boolean> {
  const now = Date.now();
  const c = ctx ?? await visitContext().catch(() => ({ net: '-', where: '-', ua: '' }));
  const event: VisitEvent = { at: now, kind, leadId: lead.id, ...c };
  const earlier = (await recentVisitEvents(new Date(now - BURST_WINDOW_MS).toISOString()).catch(() => [])).map(decode).filter((e): e is VisitEvent => !!e);
  await logVisitEvent(encode(event), new Date(now)).catch(() => undefined);
  console.log(`[visit-log] ${kind} ${lead.title} from ${c.where} net ${c.net} ua ${clean(c.ua, 60)}`);

  const others = burstLeads(earlier, lead.id, now);
  if (!others.length) return false;
  console.log(`[visit-log] burst: ${others.length + 1} different leads clicked within 5 minutes, treated as a scanner`);
  for (const id of others) {
    const other = await getLeadById(id).catch(() => null);
    if (other) await undoSingleVisit(other, earlier.filter(e => e.leadId === id).map(e => e.kind));
  }
  return true;
}

// Takes back a click that only exists because of the burst: a lead with exactly one counted
// visit goes back to "not visited"; one with several keeps them (a person came back later).
async function undoSingleVisit(lead: Lead, kinds: VisitKind[]): Promise<void> {
  if (kinds.includes('site') && (lead.contactLinks?.siteVisits ?? 0) <= 1 && lead.contactLinks?.siteVisitedAt) {
    const { siteVisitedAt: _a, siteVisits: _b, sitePages: _c, ...rest } = lead.contactLinks;
    void _a; void _b; void _c;
    await updateLead(lead.id, { contact_links: rest });
  }
  if (kinds.includes('note') && (lead.noteViews ?? 0) <= 1 && lead.noteOpenedAt) {
    await updateLead(lead.id, { note_opened_at: null, note_last_viewed_at: null, note_views: 0 });
  }
}
