import { NextRequest, NextResponse, after } from 'next/server';
import { hasTimerSecret, isAllowed } from '@/lib/session';
import { runOutbox } from '@/lib/outbox';
import { buildMissingDemos } from '@/lib/demoauto';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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
// The next few queued leads get their website demo built in the background on every tick, so they are ready when their turn comes.
const prebuild = () => buildMissingDemos(240_000).then(r => { if (r.tried) console.log(`[outbox] demos built: ${r.built}/${r.tried}`); }).catch(e => console.error('[outbox] demos failed:', e));

export async function GET(req: NextRequest) {
  if (!(await isAllowed(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  after(prebuild);

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
