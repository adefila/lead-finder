import { NextResponse } from 'next/server';
import { getLeads, getProfile, updateLead } from '@/lib/supabase';
import { isJobLead } from '@/lib/leadview';
import { matchJob, STRONG_MATCH } from '@/lib/jobmatch';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Score every job in the dashboard against your profile. Rules only, so it is instant and free.
export async function POST() {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: 'Upload your CV or portfolio first' }, { status: 400 });

  const jobs = (await getLeads()).filter(isJobLead);
  let strong = 0;
  let failed = 0;
  for (let i = 0; i < jobs.length; i += 10) {
    await Promise.all(jobs.slice(i, i + 10).map(async l => {
      const match = matchJob(l, profile);
      if (match.score >= STRONG_MATCH) strong++;
      const error = await updateLead(l.id, { contact_links: { ...l.contactLinks, match } });
      if (error) failed++;
    }));
  }
  return NextResponse.json({ checked: jobs.length, strong, failed });
}
