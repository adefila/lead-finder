import { NextRequest, NextResponse } from 'next/server';
import { isAllowed } from '@/lib/session';
import { runOutbox } from '@/lib/outbox';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Called every ~15 minutes by an external timer (Authorization: Bearer CRON_SECRET),
// or by the dashboard's "Send next now" button.
export async function GET(req: NextRequest) {
  if (!(await isAllowed(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const result = await runOutbox();
    console.log('[outbox]', JSON.stringify(result));
    return NextResponse.json(result);
  } catch (e) {
    console.error('[outbox] failed:', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
