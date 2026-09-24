import { NextRequest, NextResponse } from 'next/server';
import { fetchAllJobs } from '@/lib/sources';
import { fetchAllPosts } from '@/lib/posts';
import { fetchApolloLeads } from '@/lib/apollo';
import { generateColdEmails, scoreAndDraftPosts } from '@/lib/claude';
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
    const [boardJobs, apolloLeads, allPosts] = await Promise.all([
      fetchAllJobs(),
      fetchApolloLeads(),
      fetchAllPosts(),
    ]);
    const allJobs = [...boardJobs, ...apolloLeads];

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

    // 3. Job board leads: skip pre-scoring — draft emails for ALL fresh leads (cap 40).
    //    Claude scoring was filtering out legit design jobs because Framer-specific
    //    roles are rare. Let the user review and skip from the dashboard instead.
    //    Apollo leads are always included as-is (already targeted at founder profile).
    const jobsToProcess = freshJobs.slice(0, 40);

    // 4. Draft emails + score posts in parallel
    const [jobsWithEmails, scoredPosts] = await Promise.all([
      generateColdEmails(jobsToProcess),
      scoreAndDraftPosts(freshPosts),
    ]);

    // 5. Save to Supabase
    await Promise.all([saveLeads(jobsWithEmails), savePosts(scoredPosts)]);

    // 6. Send email digest + mark sent
    if (jobsWithEmails.length > 0) {
      await sendLeadsEmail(jobsWithEmails);
      await markSent(jobsWithEmails.map(j => j.id));
    }

    const durationMs = Date.now() - start;
    console.log(`[cron] Done in ${(durationMs / 1000).toFixed(1)}s — ${jobsWithEmails.length} leads, ${scoredPosts.length} posts`);

    return NextResponse.json({
      success: true,
      stats: {
        boardJobs: boardJobs.length,
        apolloContacts: apolloLeads.length,
        fresh: freshJobs.length,
        drafted: jobsWithEmails.length,
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
