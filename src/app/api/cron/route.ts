import { NextRequest, NextResponse } from 'next/server';
import { fetchAllJobs } from '@/lib/sources';
import { fetchApolloLeads } from '@/lib/apollo';
import { fetchPlacesLeads } from '@/lib/places';
import { generateColdEmails, scoreJobs } from '@/lib/claude';
import { getSentIds, markSent, getExistingLeadIds, saveLeads, getLeads } from '@/lib/supabase';
import { needsAttention } from '@/lib/followup';
import { syncGmail } from '@/lib/gmail';
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
    // 1. Fetch client project leads in parallel
    const [boardJobs, placesLeads, apolloLeads] = await Promise.all([
      fetchAllJobs(),
      fetchPlacesLeads(),
      fetchApolloLeads(),
    ]);
    const allJobs = [...boardJobs, ...placesLeads, ...apolloLeads];

    // 2. Dedup against Supabase
    const [sentIds, existingLeadIds] = await Promise.all([
      getSentIds(30),
      getExistingLeadIds(),
    ]);

    const knownLeads = new Set([...sentIds, ...existingLeadIds]);
    const freshJobs = allJobs.filter(j => !knownLeads.has(j.id));

    console.log(`[cron] ${allJobs.length} total, ${freshJobs.length} fresh`);

    // 3. Rank (no filtering), then draft for the top 40
    const ranked = await scoreJobs(freshJobs);
    const jobsWithEmails = await generateColdEmails(ranked.slice(0, 40));

    // 4. Save + send digest
    await saveLeads(jobsWithEmails);
    const gmail = await syncGmail();
    const followUpsDue = (await getLeads()).filter(needsAttention).length;
    if (jobsWithEmails.length > 0 || followUpsDue > 0) {
      await sendLeadsEmail(jobsWithEmails, followUpsDue);
      await markSent(jobsWithEmails.map(j => j.id));
    }

    const durationMs = Date.now() - start;
    console.log(`[cron] Done in ${(durationMs / 1000).toFixed(1)}s — ${jobsWithEmails.length} leads saved`);

    return NextResponse.json({
      success: true,
      stats: {
        freelancerProjects: boardJobs.length,
        localBusinesses: placesLeads.length,
        withEmail: placesLeads.filter(l => l.contactEmail).length,
        apolloContacts: apolloLeads.length,
        fresh: freshJobs.length,
        drafted: jobsWithEmails.length,
        followUpsDue,
        ...(gmail.connected ? { gmailContacted: gmail.contacted, gmailReplies: gmail.replied } : {}),
      },
      durationMs,
    });
  } catch (err) {
    console.error('[cron] Error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
