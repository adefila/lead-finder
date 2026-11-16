import { NextResponse } from 'next/server';
import { getLeads, updateLead } from '@/lib/supabase';
import { dedupeGreeting, ensureGreeting, fixCurrency, softenAbsolutes, softenOptOut } from '@/lib/greeting';
import { leadLanguage } from '@/lib/leadview';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Fixes three things in the drafts waiting to be sent without calling the model: a missing greeting line gets a plain one
// in the lead's language, "10.000 euro" for BookedEZ becomes "$10,000", and "I'll leave you alone" becomes "just say so" (English and Dutch).
// Queued and approved business emails are touched.
// ?dry=1 only reports.
export async function POST(req: Request) {
  const dry = new URL(req.url).searchParams.get('dry') === '1';
  const leads = (await getLeads()).filter(l => (l.status === 'queued' || l.status === 'approved' || l.status === 'new') && l.proposal && l.contactEmail && ['places', 'osm', 'companies_house'].includes(l.source));
  let changed = 0, greeting = 0, currency = 0, failed = 0, b2bOpenCount = 0, b2bSegment = 0, absolutes = 0;
  for (const l of leads) {
    const before = l.proposal!;
    const b2bOpen = l.contactLinks?.segment === 'b2b' && !l.lastSentAt && leadLanguage(l) === 'en';
    if (l.contactLinks?.segment === 'b2b') b2bSegment++;
    if (b2bOpen) { b2bOpenCount++; if (/there(?:'s| is) no|has no way to/.test(before)) absolutes++; }
    const afterCurrency = dedupeGreeting(softenOptOut(fixCurrency(b2bOpen ? softenAbsolutes(before) : before)));
    const after = dedupeGreeting(ensureGreeting(afterCurrency, leadLanguage(l)));
    if (after === before) continue;
    changed++;
    if (afterCurrency !== before) currency++;
    if (after !== afterCurrency) greeting++;
    if (dry) continue;
    const error = await updateLead(l.id, { draft_email: after });
    if (error) failed++;
  }
  return NextResponse.json({ dry, checked: leads.length, changed, greeting, currency, failed, b2bSegment, b2bOpenCount, absolutes });
}
