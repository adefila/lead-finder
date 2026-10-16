import { NextRequest, NextResponse } from 'next/server';
import { getLeads } from '@/lib/supabase';
import { recordLeadVisit } from '@/lib/inbound';
import { SITE_URL, siteDestination, visitKeyMatches } from '@/lib/tracking';

export const dynamic = 'force-dynamic';

// The adefilasamuel.com link in your emails: record that this lead visited, then go to the site.
export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const code = key.slice(-12);
  let to = SITE_URL;
  if (/^[0-9a-f]{12}$/.test(code)) {
    const lead = (await getLeads()).find(l => visitKeyMatches(l.id, code));
    if (lead) {
      // Decided when the link is clicked, so emails already sent or still scheduled follow it too
      to = siteDestination(lead);
      await recordLeadVisit(lead, req.headers.get('user-agent') ?? '');
    }
  }
  return NextResponse.redirect(to, 302);
}
