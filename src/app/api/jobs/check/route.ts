import { NextResponse } from 'next/server';
import { getExistingLeadIds, getLeads, getProfile, getSentIds, markSent, saveLeads, updateLead } from '@/lib/supabase';
import { isJobLead } from '@/lib/leadview';
import { isNicheRole, savedJobStillWanted, fetchJobBoards } from '@/lib/remote';
import { matchJob, STRONG_MATCH, strongMatches } from '@/lib/jobmatch';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Find jobs for you: search the job boards now, score every job against your profile, add the strong new ones,
// and bring back skipped jobs that fit. Rules only, so no AI and no cost.
export async function POST() {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: 'Upload your CV or portfolio first' }, { status: 400 });

  const [existing, fresh, sentIds, existingIds] = await Promise.all([
    getLeads(),
    fetchJobBoards().catch(e => { console.error('[jobs/check] job boards failed:', e); return []; }),
    getSentIds(365),
    getExistingLeadIds(),
  ]);
  const jobs = existing.filter(isJobLead);

  let strong = 0, restored = 0, failed = 0;
  for (let i = 0; i < jobs.length; i += 10) {
    await Promise.all(jobs.slice(i, i + 10).map(async l => {
      const match = matchJob(l, profile);
      if (match.score >= STRONG_MATCH) strong++;
      const bringBack = l.status === 'skipped' && match.score >= STRONG_MATCH && !l.contactedAt && !l.optedOut
        && !l.contactLinks?.matchRestored && isNicheRole(l.title, l.description) && savedJobStillWanted(l);
      const links = { ...l.contactLinks, match, ...(bringBack ? { matchRestored: true as const } : {}) };
      const error = await updateLead(l.id, bringBack ? { status: 'new', score: Math.max(l.score ?? 0, match.score), contact_links: links } : { contact_links: links });
      if (error) failed++; else if (bringBack) restored++;
    }));
  }

  const known = new Set([...sentIds, ...existingIds]);
  const added = strongMatches(fresh.filter(j => isJobLead(j) && !known.has(j.id)), profile);
  if (added.length) {
    await saveLeads(added);
    await markSent(added.map(j => j.id));
  }
  return NextResponse.json({ checked: jobs.length, strong, failed, added: added.length, restored, searched: fresh.length });
}
