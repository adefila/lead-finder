import { NextRequest, NextResponse } from 'next/server';
import { getLeads, updateLeadStatus } from '@/lib/supabase';
import type { Lead } from '@/types/lead';

export const dynamic = 'force-dynamic';

export async function GET() {
  const leads = await getLeads();
  return NextResponse.json(leads);
}

export async function PATCH(req: NextRequest) {
  const { id, status } = await req.json() as { id: string; status: Lead['status'] };
  await updateLeadStatus(id, status);
  return NextResponse.json({ ok: true });
}
