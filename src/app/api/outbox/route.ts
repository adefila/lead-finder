import { NextRequest, NextResponse, after } from 'next/server';
import { hasTimerSecret, isAllowed } from '@/lib/session';
import { runOutbox } from '@/lib/outbox';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function run() {
  try {
    const result = await runOutbox();
    console.log('[outbox]', JSON.stringify(result));
    return result;
  } catch (e) {
    console.error('[outbox] failed:', e);
    return { error: (e as Error).message };
  }
}

// Called every ~15 minutes by an external timer (Authorization: Bearer CRON_SECRET),
// or by the dashboard's "Send the next email now" button.
export async function GET(req: NextRequest) {
  if (!(await isAllowed(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // The timer gives up after 30 seconds, so answer it straight away and do the work
  // after the response. A slow Gmail can then never make the timer report a failure.
  if (hasTimerSecret(req.headers.get('authorization'))) {
    after(run);
    return NextResponse.json({ accepted: true }, { status: 202 });
  }

  // The dashboard button waits for the real result so it can say what happened.
  const result = await run();
  return NextResponse.json(result, { status: 'error' in result ? 500 : 200 });
}
