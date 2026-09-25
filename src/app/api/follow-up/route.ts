import { NextRequest, NextResponse } from 'next/server';
import { getLeadById } from '@/lib/supabase';
import { draftFollowUp } from '@/lib/claude';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { id } = await req.json() as { id?: string };
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const lead = await getLeadById(id);
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  try {
    const message = await draftFollowUp(lead);
    return NextResponse.json({ message });
  } catch (e) {
    console.error('[follow-up]', e);
    return NextResponse.json({ error: 'Could not draft the follow-up' }, { status: 500 });
  }
}
