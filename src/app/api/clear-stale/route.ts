import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const isManual = req.headers.get('x-manual') === 'true';
  if (!isManual) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Missing env vars' }, { status: 500 });

  const db = createClient(url, key);

  // Wipe the entire leads table and sent_jobs dedup table so the next
  // cron run treats every Upwork/Freelancer/Apollo lead as fresh.
  const { count: leadsDeleted, error: e1 } = await db
    .from('leads')
    .delete({ count: 'exact' })
    .gte('created_at', '2000-01-01'); // matches all rows

  if (e1) return NextResponse.json({ error: String(e1) }, { status: 500 });

  const { count: sentDeleted, error: e2 } = await db
    .from('sent_jobs')
    .delete({ count: 'exact' })
    .gte('sent_at', '2000-01-01');

  if (e2) console.error('[clear-stale] sent_jobs error:', e2);

  console.log(`[clear-stale] Reset: ${leadsDeleted} leads, ${sentDeleted ?? 0} sent_jobs`);

  return NextResponse.json({
    success: true,
    leadsDeleted,
    sentJobsCleared: sentDeleted ?? 0,
  });
}
