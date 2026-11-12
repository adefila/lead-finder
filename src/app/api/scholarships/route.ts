import { NextResponse } from 'next/server';
import { getProfile, getSchool } from '@/lib/supabase';
import { COUNTRIES, SCHOLARSHIPS, matchScholarship, monthsUntil } from '@/lib/scholarships';
import { refreshFeed } from '@/lib/scholarshipfeed';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// The scholarship list, each scored against your transcript (and the years of work on your CV), plus the newly posted ones.
export async function GET() {
  const [school, cv, feed] = await Promise.all([getSchool(), getProfile(), refreshFeed().catch(() => [])]);
  const list = SCHOLARSHIPS.map(s => ({ ...s, match: matchScholarship(s, school, cv?.years ?? null), monthsAway: monthsUntil(s.closeMonth) }))
    .sort((a, b) => b.match.score - a.match.score);
  return NextResponse.json({ list, countries: COUNTRIES, school, hasCv: !!cv, feed: feed.slice(0, 12) });
}
