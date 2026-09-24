import { NextRequest, NextResponse } from 'next/server';
import { fetchAllJobs } from '@/lib/sources';
import { scoreJobs, generateAllProposals } from '@/lib/claude';
import { getSentIds, markSent } from '@/lib/supabase';
import { sendLeadsEmail } from '@/lib/email';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Verify cron secret unless it's a manual trigger (x-manual header)
  const isManual = req.headers.get('x-manual') === 'true';
  if (!isManual) {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[cron] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log('[cron] Starting lead finder run...');
  const startTime = Date.now();

  try {
    // Step 1: Fetch all jobs
    const allJobs = await fetchAllJobs();
    console.log(`[cron] Fetched ${allJobs.length} total jobs`);

    // Step 2: Get already-sent IDs and filter out
    const sentIds = new Set(await getSentIds(30));
    console.log(`[cron] ${sentIds.size} jobs already sent in last 30 days`);
    const freshJobs = allJobs.filter(j => !sentIds.has(j.id));
    console.log(`[cron] ${freshJobs.length} fresh (unsent) jobs`);

    if (freshJobs.length === 0) {
      console.log('[cron] No fresh jobs to process');
      return NextResponse.json({
        success: true,
        message: 'No fresh jobs found',
        stats: { fetched: allJobs.length, fresh: 0, scored: 0, sent: 0 },
        durationMs: Date.now() - startTime,
      });
    }

    // Step 3: Score jobs with Claude, keep top 50 with score >= 40
    const scoredJobs = await scoreJobs(freshJobs);
    console.log(`[cron] ${scoredJobs.length} jobs scored and filtered`);

    if (scoredJobs.length === 0) {
      console.log('[cron] No jobs passed relevance threshold');
      return NextResponse.json({
        success: true,
        message: 'No relevant jobs found',
        stats: { fetched: allJobs.length, fresh: freshJobs.length, scored: 0, sent: 0 },
        durationMs: Date.now() - startTime,
      });
    }

    // Step 4: Generate proposals for all scored jobs
    const jobsWithProposals = await generateAllProposals(scoredJobs);
    console.log(`[cron] Proposals generated for ${jobsWithProposals.length} jobs`);

    // Step 5: Send email digest
    await sendLeadsEmail(jobsWithProposals);
    console.log('[cron] Email sent successfully');

    // Step 6: Mark jobs as sent in Supabase
    const sentNow = jobsWithProposals.map(j => j.id);
    await markSent(sentNow);

    const durationMs = Date.now() - startTime;
    console.log(`[cron] Run complete in ${durationMs}ms`);

    return NextResponse.json({
      success: true,
      stats: {
        fetched: allJobs.length,
        fresh: freshJobs.length,
        scored: scoredJobs.length,
        sent: jobsWithProposals.length,
      },
      durationMs,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[cron] Fatal error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
