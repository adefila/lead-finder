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

  // Delete all leads from old employee job boards that are now irrelevant.
  // Keep: upwork, apollo. Remove: remotive, remoteok, weworkremotely.
  const { count: leadsDeleted, error: e1 } = await db
    .from('leads')
    .delete({ count: 'exact' })
    .in('source', ['remotive', 'remoteok', 'weworkremotely']);

  if (e1) return NextResponse.json({ error: String(e1) }, { status: 500 });

  // Also clear posts older than 30 days
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
  const { count: postsDeleted, error: e2 } = await db
    .from('posts')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff);

  if (e2) console.error('[clear-stale] posts error:', e2);

  console.log(`[clear-stale] Removed ${leadsDeleted} stale leads, ${postsDeleted ?? 0} old posts`);

  return NextResponse.json({
    success: true,
    leadsDeleted,
    postsDeleted: postsDeleted ?? 0,
  });
}
