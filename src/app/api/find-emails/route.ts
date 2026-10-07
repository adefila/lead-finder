import { NextRequest, NextResponse } from 'next/server';
import { isAllowed } from '@/lib/session';
import { findMissingEmails } from '@/lib/findemails';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// The dashboard sends a few leads at a time (ids) and shows each result as it comes back,
// passing how many Google Maps lookups it may still use.
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAllowed(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { maxLookups?: number; ids?: string[] };
  const maxLookups = Math.max(0, Math.min(300, Number(body.maxLookups ?? 100)));
  const ids = Array.isArray(body.ids) ? body.ids.slice(0, 20).map(String) : undefined;
  try {
    return NextResponse.json(await findMissingEmails(maxLookups, ids));
  } catch (e) {
    console.error('[find-emails]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// Vercel's daily timer (12:00 UTC): works through existing leads without an email on its own.
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await isAllowed(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await findMissingEmails(150));
  } catch (e) {
    console.error('[find-emails]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
