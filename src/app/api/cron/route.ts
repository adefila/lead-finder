import { NextRequest, NextResponse } from 'next/server';
import { isAllowed } from '@/lib/session';
import { fetchPlacesLeads } from '@/lib/places';
import { fetchCompaniesHouseLeads } from '@/lib/companies';
import { fetchJobBoards, isNicheRole, savedJobStillWanted } from '@/lib/remote';
import { backfillJobContacts, findJobContacts } from '@/lib/jobcontacts';
import { generateColdEmails, MIN_FIT, MIN_FIT_BUSINESS, minFitFor, scoreJobs } from '@/lib/claude';
import { getSentIds, markSent, getExistingLeadIds, saveLeads, getLeads, updateLeadStatus, deleteLeads } from '@/lib/supabase';

// Marker (in sent_jobs) for the one-time return of businesses the old 65 bar had skipped.
const RESTORE_MARK = 'restore:business-fit-50';
import { followUpState, needsAttention } from '@/lib/followup';
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
    // OpenStreetMap is left out: both public servers time out on every run and it has yielded about 0 a day.
    const [jobs, placesLeads, companyLeads] = await Promise.all([
      fetchJobBoards(),
      fetchPlacesLeads(),
      fetchCompaniesHouseLeads(),
    ]);
    const allJobs = [...jobs, ...placesLeads, ...companyLeads];

    // 2. Dedup against Supabase
    const [sentIds, existingLeadIds] = await Promise.all([
      getSentIds(365),
      getExistingLeadIds(),
    ]);

    const knownLeads = new Set([...sentIds, ...existingLeadIds]);
    // The same business can come from Google, OpenStreetMap and Companies House: match on website and email.
    const existing = await getLeads();
    // Jobs already saved that are outside your niche, not full-time, remote but not open to you,
    // or abroad without relocation support move to Skipped (you can bring them back).
    const offNiche = existing.filter(l => isJobLead(l) && (l.status ?? 'new') === 'new'
      && (!isNicheRole(l.title, l.description) || !savedJobStillWanted(l)));
    for (const l of offNiche) await updateLeadStatus(l.id, 'skipped');
    // Only good fits stay in To contact (see minFitFor). Website enquiries and site visitors are kept: they came to you.
    const weakFit = existing.filter(l => (l.status ?? 'new') === 'new' && l.source !== 'website' && l.source !== 'visitor'
      && (l.score ?? 0) < minFitFor(l) && !offNiche.includes(l));
    for (const l of weakFit) await updateLeadStatus(l.id, 'skipped');
    if (weakFit.length) console.log(`[cron] moved ${weakFit.length} leads under their fit score to Skipped`);
    // Once: businesses the old bar (65 for everyone) moved to Skipped come back if they now pass.
    // Only ones never emailed, with an address, that didn't opt out.
    let restored = 0;
    if (!knownLeads.has(RESTORE_MARK)) {
      const back = existing.filter(l => l.status === 'skipped' && !isJobLead(l) && l.contactEmail && !l.optedOut && !l.contactedAt
        && (l.score ?? 0) >= MIN_FIT_BUSINESS && (l.score ?? 0) < MIN_FIT);
      for (const l of back) { await updateLeadStatus(l.id, 'new'); l.status = 'new'; }
      await markSent([RESTORE_MARK]);
      restored = back.length;
      console.log(`[cron] brought back ${restored} businesses scoring ${MIN_FIT_BUSINESS} to ${MIN_FIT - 1} from Skipped`);
    }
    // Followed up twice and still no reply after the last wait: remove them. deleteLeads also
    // records the ids so they never come back in a later search.
    const noReply = existing.filter(l => followUpState(l).exhausted);
    if (noReply.length) {
      const error = await deleteLeads(noReply.map(l => l.id));
      if (error) console.error('[cron] could not remove no-reply leads:', error);
      else console.log(`[cron] removed ${noReply.length} leads with no reply after 2 follow-ups`);
    }
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

    // 3. Score, keep only good fits (each lead's bar, see minFitFor), find who to pitch at the top jobs, then
    // draft for the top 40
    const scoredAll = await scoreJobs(freshJobs);
    const ranked = scoredAll.filter(l => (l.score ?? -1) >= minFitFor(l));
    console.log(`[cron] ${ranked.length} of ${scoredAll.length} passed their fit score and are kept`);
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
        removedNoReply: noReply.length,
        restoredFromSkipped: restored,
        weakFitSkipped: weakFit.length,
        bestFits: ranked.length,
        jobContacts: top.filter(l => l.source === 'job' && l.contactEmail).length,
        existingJobsSearched: backfill.searched,
        existingJobsWithEmail: backfill.emails,
        existingJobsLeft: backfill.left,
        localBusinesses: placesLeads.length,
        newUkCompanies: companyLeads.length,
        withEmail: [...placesLeads, ...companyLeads].filter(l => l.contactEmail).length,
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

