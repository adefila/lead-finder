import { NextRequest, NextResponse } from 'next/server';
import { getLeadById, updateLead } from '@/lib/supabase';
import { domainOf, findEmailFor, hunterConfigured, searchesLeft } from '@/lib/hunter';

export const dynamic = 'force-dynamic';

// "Find their email" in the lead page: one Hunter search for this lead.
export async function POST(req: NextRequest) {
  const { id } = await req.json().catch(() => ({})) as { id?: string };
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  if (!hunterConfigured()) return NextResponse.json({ error: 'Add HUNTER_API_KEY in Vercel to turn on email finding' }, { status: 400 });

  const lead = await getLeadById(id);
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  if (lead.contactEmail) return NextResponse.json({ email: lead.contactEmail });
  if (!domainOf(lead)) return NextResponse.json({ error: 'They have no website of their own to search' }, { status: 400 });
  if ((await searchesLeft()) < 1) return NextResponse.json({ error: 'No Hunter searches left this month' }, { status: 429 });

  const found = await findEmailFor(lead);
  if (!found) return NextResponse.json({ error: 'Hunter could not find a working email for them' }, { status: 404 });

  const patch: Record<string, unknown> = { contact_email: found.email, send_error: null };
  if (!lead.contactName && found.name) { patch.contact_name = found.name; patch.contact_title = found.title ?? null; }
  const error = await updateLead(id, patch);
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({
    email: found.email,
    contactName: patch.contact_name as string | undefined,
    contactTitle: (patch.contact_title as string | null | undefined) ?? undefined,
  });
}
