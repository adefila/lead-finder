import { NextRequest, NextResponse } from 'next/server';
import { isAllowed } from '@/lib/session';
import { fetchPlacesLeads } from '@/lib/places';
import { fetchOsmLeads } from '@/lib/osm';
import { fetchCompaniesHouseLeads } from '@/lib/companies';
import { fetchJobBoards, isNicheRole, savedJobOpenToAll } from '@/lib/remote';
import { backfillJobContacts, findJobContacts } from '@/lib/jobcontacts';
import { generateColdEmails, scoreJobs } from '@/lib/claude';
import { getSentIds, markSent, getExistingLeadIds, saveLeads, getLeads, updateLeadStatus } from '@/lib/supabase';
import { needsAttention } from '@/lib/followup';
import { sendLeadsEmail } from '@/lib/email';
import { isJobLead } from '@/lib/leadview';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await isAllowed(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const start = Date.now();
  console.log('[cron] Run started');

  try {
    // 1. Fetch client project leads in parallel
    const [jobs, placesLeads, osmLeads, companyLeads] = await Promise.all([
      fetchJobBoards(),
      fetchPlacesLeads(),
      fetchOsmLeads(),
      fetchCompaniesHouseLeads(),
    ]);
    const allJobs = [...jobs, ...placesLeads, ...osmLeads, ...companyLeads];

    // 2. Dedup against Supabase
    const [sentIds, existingLeadIds] = await Promise.all([
      getSentIds(30),
      getExistingLeadIds(),
    ]);

    const knownLeads = new Set([...sentIds, ...existingLeadIds]);
    // The same business can come from Google, OpenStreetMap and Companies House: match on website and email.
    const existing = await getLeads();
    // Jobs already saved that are outside your niche, or not open to anyone anywhere, move to
    // Skipped (you can bring them back).
    const offNiche = existing.filter(l => isJobLead(l) && (l.status ?? 'new') === 'new'
      && (!isNicheRole(l.title, l.description) || !savedJobOpenToAll(l)));
    for (const l of offNiche) await updateLeadStatus(l.id, 'skipped');
    const seenHosts = new Set(existing.map(l => hostOf(l.contactLinks?.website)).filter(Boolean) as string[]);
    const seenEmails = new Set(existing.map(l => l.contactEmail?.toLowerCase()).filter(Boolean) as string[]);
    const freshJobs = allJobs.filter(j => {
      if (knownLeads.has(j.id)) return false;
      // Businesses are only worth keeping when we found an email to write to.
      if (!isJobLead(j) && !j.contactEmail) return false;
      const host = hostOf(j.contactLinks?.website);
      const email = j.contactEmail?.toLowerCase();
      if ((host && seenHosts.has(host)) || (email && seenEmails.has(email))) return false;
      if (host) seenHosts.add(host);
      if (email) seenEmails.add(email);
      return true;
    });

    console.log(`[cron] ${allJobs.length} total, ${freshJobs.length} fresh`);

    // 3. Rank (no filtering), find who to pitch at the top jobs, then draft for the top 40
    const ranked = await scoreJobs(freshJobs);
    // One pitch per company: a second job at the same company (or one already emailed) keeps only its job post.
    const top = (await findJobContacts(ranked.slice(0, 40))).map(l => {
      if (l.source !== 'job' || !l.contactEmail) return l;
      const email = l.contactEmail.toLowerCase();
      if (seenEmails.has(email)) return { ...l, contactEmail: undefined };
      seenEmails.add(email);
      return l;
    });
    const jobsWithEmails = await generateColdEmails(top);

    // 4. Save + send digest
    await saveLeads(jobsWithEmails);
    const followUpsDue = (await getLeads()).filter(needsAttention).length;
    if (jobsWithEmails.length > 0 || followUpsDue > 0) {
      await sendLeadsEmail(jobsWithEmails, followUpsDue);
      await markSent(jobsWithEmails.map(j => j.id));
    }

    // 5. Jobs already in the dashboard get the same contact search, with whatever time is left.
    const backfill = await backfillJobContacts(Math.min(60_000, 250_000 - (Date.now() - start)));

    const durationMs = Date.now() - start;
    console.log(`[cron] Done in ${(durationMs / 1000).toFixed(1)}s — ${jobsWithEmails.length} leads saved`);

    return NextResponse.json({
      success: true,
      stats: {
        jobs: jobs.length,
        offNicheJobsSkipped: offNiche.length,
        jobContacts: top.filter(l => l.source === 'job' && l.contactEmail).length,
        existingJobsSearched: backfill.searched,
        existingJobsWithEmail: backfill.emails,
        existingJobsLeft: backfill.left,
        localBusinesses: placesLeads.length,
        openStreetMap: osmLeads.length,
        newUkCompanies: companyLeads.length,
        withEmail: [...placesLeads, ...osmLeads, ...companyLeads].filter(l => l.contactEmail).length,
        fresh: freshJobs.length,
        drafted: jobsWithEmails.length,
        followUpsDue,
      },
      durationMs,
    });
  } catch (err) {
    console.error('[cron] Error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

function hostOf(url?: string): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; }
}

