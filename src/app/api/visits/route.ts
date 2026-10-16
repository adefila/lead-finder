import { NextResponse } from 'next/server';
import { getLeads, recentVisitEvents } from '@/lib/supabase';
import { decode } from '@/lib/visitlog';

export const dynamic = 'force-dynamic';

// Recent clicks on tracked links (last 7 days, newest first), behind the dashboard login:
// who clicked, when, from where and with which browser. Handy for telling people from scanners.
export async function GET() {
  const [rows, leads] = await Promise.all([recentVisitEvents(new Date(Date.now() - 7 * 86_400_000).toISOString()), getLeads()]);
  const names = new Map(leads.map(l => [l.id, l.title]));
  const visits = rows.map(decode).filter(Boolean).map(e => ({
    at: new Date(e!.at).toISOString(), kind: e!.kind, lead: names.get(e!.leadId) ?? e!.leadId, from: e!.where, network: e!.net, browser: e!.ua,
  })).reverse();
  return NextResponse.json({ count: visits.length, visits });
}
