import { NextRequest, NextResponse } from 'next/server';
import { recordLeadVisit, NOT_A_PERSON } from '@/lib/inbound';
import { findLeadByCode } from '@/lib/leadlookup';
import { SITE_URL, siteDestination } from '@/lib/tracking';

export const dynamic = 'force-dynamic';

// The adefilasamuel.com link in your emails: record that this lead visited, then go to the site.
export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const code = key.slice(-12);
  let to = SITE_URL;
  // Scanners and crawlers are never counted, so they get the plain address without touching the database.
  const ua = req.headers.get('user-agent') ?? '';
  if (ua && !NOT_A_PERSON.test(ua) && /^[0-9a-f]{12}$/.test(code)) {
    const lead = await findLeadByCode('visit', code);
    if (lead) {
      // Decided when the link is clicked, so emails already sent or still scheduled follow it too
      to = siteDestination(lead);
      await recordLeadVisit(lead, ua);
    }
  }
  return NextResponse.redirect(to, 302);
}
