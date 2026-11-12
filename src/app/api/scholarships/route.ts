import { NextResponse } from 'next/server';
import { getProfile, getSchool } from '@/lib/supabase';
import { COUNTRIES, SCHOLARSHIPS, matchScholarship, monthsUntil } from '@/lib/scholarships';

export const dynamic = 'force-dynamic';

// The scholarship list, each scored against your transcript (and the years of work on your CV).
export async function GET() {
  const [school, cv] = await Promise.all([getSchool(), getProfile()]);
  const list = SCHOLARSHIPS.map(s => ({ ...s, match: matchScholarship(s, school, cv?.years ?? null), monthsAway: monthsUntil(s.closeMonth) }))
    .sort((a, b) => b.match.score - a.match.score);
  return NextResponse.json({ list, countries: COUNTRIES, school, hasCv: !!cv });
}
