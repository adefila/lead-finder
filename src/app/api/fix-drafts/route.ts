import { NextResponse } from 'next/server';
import { getLeads, updateLead } from '@/lib/supabase';
import { ensureGreeting, fixCurrency } from '@/lib/greeting';
import { leadLanguage } from '@/lib/leadview';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Fixes two things in the drafts waiting to be sent without calling the model: a missing greeting line gets a plain one
// in the lead's language, and "10.000 euro" for BookedEZ becomes "$10,000". Only scheduled business emails are touched.
// ?dry=1 only reports.
export async function POST(req: Request) {
  const dry = new URL(req.url).searchParams.get('dry') === '1';
  const leads = (await getLeads()).filter(l => l.status === 'queued' && l.proposal && l.contactEmail && ['places', 'osm', 'companies_house'].includes(l.source));
  let changed = 0, greeting = 0, currency = 0, failed = 0;
  for (const l of leads) {
    const before = l.proposal!;
    const afterCurrency = fixCurrency(before);
    const after = ensureGreeting(afterCurrency, leadLanguage(l));
    if (after === before) continue;
    changed++;
    if (afterCurrency !== before) currency++;
    if (after !== afterCurrency) greeting++;
    if (dry) continue;
    const error = await updateLead(l.id, { draft_email: after });
    if (error) failed++;
  }
  return NextResponse.json({ dry, checked: leads.length, changed, greeting, currency, failed });
}
