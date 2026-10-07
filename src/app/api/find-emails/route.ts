import { NextRequest, NextResponse } from 'next/server';
import { isAllowed } from '@/lib/session';
import { findMissingEmails } from '@/lib/findemails';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// One pass over leads with no email (about four minutes of work). The dashboard calls it again
// while leads remain, passing how many Google Maps lookups it may still use.
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAllowed(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { maxLookups?: number };
  const maxLookups = Math.max(0, Math.min(300, Number(body.maxLookups ?? 100)));
  try {
    return NextResponse.json(await findMissingEmails(maxLookups));
  } catch (e) {
    console.error('[find-emails]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
