import { NextResponse } from 'next/server';
import { getLeads, recentVisitEvents, updateLead } from '@/lib/supabase';
import { cloudMismatch, decode, DOUBLE_CLICK_MS, type VisitEvent } from '@/lib/visitlog';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Goes back over the last 30 days of clicks and takes back the visits that only scanners made: clicks within 3 seconds
// of each other on one lead, or from a cloud town in another country. A lead that also has a person-like click keeps
// its visit. Behind the dashboard login. ?dry=1 only reports.
export async function POST(req: Request) {
  const dry = new URL(req.url).searchParams.get('dry') === '1';
  const [rows, leads] = await Promise.all([recentVisitEvents(new Date(Date.now() - 30 * 86_400_000).toISOString()), getLeads()]);
  const byId = new Map(leads.map(l => [l.id, l]));
  const events = rows.map(decode).filter((e): e is VisitEvent => !!e).sort((a, b) => a.at - b.at);

  // Clicks that belong together: same lead, same address, within a minute
  const groups: { leadId: string; events: VisitEvent[] }[] = [];
  for (const e of events) {
    const g = groups.find(x => x.leadId === e.leadId && x.events[0].net === e.net && e.at - x.events[x.events.length - 1].at <= 60_000);
    if (g) g.events.push(e); else groups.push({ leadId: e.leadId, events: [e] });
  }
  const isBot = (g: { leadId: string; events: VisitEvent[] }) => {
    const lead = byId.get(g.leadId);
    const quick = g.events.length >= 2 && g.events[g.events.length - 1].at - g.events[0].at <= DOUBLE_CLICK_MS;
    return quick || (!!lead && cloudMismatch(g.events[0].where, lead));
  };

  const botIds = new Set(groups.filter(isBot).map(g => g.leadId));
  const personIds = new Set(groups.filter(g => !isBot(g)).map(g => g.leadId));
  const undo = [...botIds].filter(id => !personIds.has(id));
  const names: string[] = [];
  for (const id of undo) {
    const lead = byId.get(id);
    if (!lead) continue;
    names.push(lead.title);
    if (dry) continue;
    const { siteVisitedAt: _a, siteVisits: _b, sitePages: _c, ...rest } = lead.contactLinks ?? {};
    void _a; void _b; void _c;
    await updateLead(id, { contact_links: Object.keys(rest).length ? rest : null, note_opened_at: null, note_last_viewed_at: null, note_views: 0 });
  }
  return NextResponse.json({ dry, scannerOnly: names, keptBecauseAPersonClicked: [...botIds].filter(id => personIds.has(id)).map(id => byId.get(id)?.title ?? id) });
}
