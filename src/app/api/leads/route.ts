import { NextRequest, NextResponse } from 'next/server';
import { getLeads, updateLeadStatus } from '@/lib/supabase';
import { LEAD_STATUSES, type LeadStatus } from '@/types/lead';

export const dynamic = 'force-dynamic';

export async function GET() {
  const leads = await getLeads();
  return NextResponse.json(leads);
}

export async function PATCH(req: NextRequest) {
  const { id, status } = await req.json() as { id?: string; status?: string };
  if (!id || !LEAD_STATUSES.includes(status as LeadStatus)) {
    return NextResponse.json({ error: 'Invalid id or status' }, { status: 400 });
  }
  const error = await updateLeadStatus(id, status as LeadStatus);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
