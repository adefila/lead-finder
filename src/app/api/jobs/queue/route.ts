import { NextRequest, NextResponse } from 'next/server';
import { getLeads, updateLeadStatus } from '@/lib/supabase';
import { isJobLead } from '@/lib/leadview';

export const dynamic = 'force-dynamic';

// Jobs waiting to be applied for on the post, best match first. ?min=85 sets the lowest match.
export async function GET(req: NextRequest) {
  const min = Number(req.nextUrl.searchParams.get('min') ?? 85);
  const jobs = (await getLeads()).filter(l => isJobLead(l) && (l.status ?? 'new') === 'new' && !l.contactEmail && (l.contactLinks?.match?.score ?? 0) >= min)
    .sort((a, b) => (b.contactLinks?.match?.score ?? 0) - (a.contactLinks?.match?.score ?? 0))
    .map(l => ({ id: l.id, title: l.title, company: l.company, url: l.url, match: l.contactLinks?.match?.score ?? 0, description: l.description }));
  return NextResponse.json({ jobs });
}

// Mark one or more as applied (moves it to Waiting for reply).
export async function POST(req: NextRequest) {
  const body = await req.json() as { id?: string; ids?: string[] };
  const ids = body.ids ?? (body.id ? [body.id] : []);
  if (!ids.length) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  let failed = 0;
  for (const id of ids.slice(0, 200)) if (await updateLeadStatus(id, 'approved')) failed++;
  return failed ? NextResponse.json({ error: `${failed} could not be updated` }, { status: 500 }) : NextResponse.json({ ok: true, marked: ids.length });
}
