import { NextRequest, NextResponse } from 'next/server';
import { fetchAllJobs } from '@/lib/sources';
import { fetchAllPosts } from '@/lib/posts';
import { scoreJobs, generateColdEmails, scoreAndDraftPosts } from '@/lib/claude';
import { getSentIds, markSent, getExistingLeadIds, saveLeads, getExistingPostIds, savePosts } from '@/lib/supabase';
import { sendLeadsEmail } from '@/lib/email';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const isManual = req.headers.get('x-manual') === 'true';
  if (!isManual) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const start = Date.now();
  console.log('[cron] Run started');

  try {
    // 1. Fetch everything in parallel
    const [allJobs, allPosts] = await Promise.all([fetchAllJobs(), fetchAllPosts()]);

    // 2. Dedup against Supabase
    const [sentIds, existingLeadIds, existingPostIds] = await Promise.all([
      getSentIds(30),
      getExistingLeadIds(),
      getExistingPostIds(),
    ]);

    const knownLeads = new Set([...sentIds, ...existingLeadIds]);
    const knownPosts = new Set(existingPostIds);

    const freshJobs = allJobs.filter(j => !knownLeads.has(j.id));
    const freshPosts = allPosts.filter(p => !knownPosts.has(p.id));

    console.log(`[cron] Fresh: ${freshJobs.length} jobs, ${freshPosts.length} posts`);

    // 3. Score + draft in parallel
    const [scoredJobs, scoredPosts] = await Promise.all([
      scoreJobs(freshJobs),
      scoreAndDraftPosts(freshPosts),
    ]);

    const jobsWithEmails = await generateColdEmails(scoredJobs);

    // 4. Save to Supabase
    await Promise.all([saveLeads(jobsWithEmails), savePosts(scoredPosts)]);

    // 5. Send email digest + mark sent
    if (jobsWithEmails.length > 0) {
      await sendLeadsEmail(jobsWithEmails);
      await markSent(jobsWithEmails.map(j => j.id));
    }

    const durationMs = Date.now() - start;
    console.log(`[cron] Done in ${(durationMs / 1000).toFixed(1)}s`);

    return NextResponse.json({
      success: true,
      stats: {
        fetched: allJobs.length,
        fresh: freshJobs.length,
        scored: scoredJobs.length,
        sent: jobsWithEmails.length,
        postsFetched: allPosts.length,
        freshPosts: freshPosts.length,
        postsSaved: scoredPosts.length,
      },
      durationMs,
    });
  } catch (err) {
    console.error('[cron] Error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
