import { NextRequest, NextResponse } from 'next/server';
import { getLeads, markFollowedUp, updateLeadStatus } from '@/lib/supabase';
import { LEAD_STATUSES, type LeadStatus } from '@/types/lead';

export const dynamic = 'force-dynamic';

export async function GET() {
  const leads = await getLeads();
  return NextResponse.json(leads);
}

export async function PATCH(req: NextRequest) {
  const { id, status, action } = await req.json() as { id?: string; status?: string; action?: string };
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  let error: string | null;
  if (action === 'followed_up') {
    error = await markFollowedUp(id);
  } else if (LEAD_STATUSES.includes(status as LeadStatus)) {
    error = await updateLeadStatus(id, status as LeadStatus);
  } else {
    return NextResponse.json({ error: 'Invalid status or action' }, { status: 400 });
  }

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
