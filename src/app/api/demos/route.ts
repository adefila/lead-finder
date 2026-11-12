import { NextRequest, NextResponse } from 'next/server';
import { isAllowed } from '@/lib/session';
import { buildMissingDemos } from '@/lib/demoauto';
import { getLeads } from '@/lib/supabase';
import { wantsDemo } from '@/lib/demoauto';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Builds the next batch of website demos for queued leads (no email is sent). Each call takes up to about four minutes.
export async function POST(req: NextRequest) {
  if (!(await isAllowed(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await buildMissingDemos(270_000, 12, 6);
  const left = (await getLeads()).filter(l => l.status === 'queued' && !l.lastSentAt && !l.optedOut && wantsDemo(l)).length;
  return NextResponse.json({ ...result, left });
}
