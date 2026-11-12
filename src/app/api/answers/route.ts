import { NextRequest, NextResponse } from 'next/server';
import { getAnswers, getProfile, saveAnswers } from '@/lib/supabase';
import { ANSWER_FIELDS, EMPTY_ANSWERS, answersFromCv, type Answers } from '@/lib/answers';

export const dynamic = 'force-dynamic';

// What you have saved, with blanks filled from your CV where it says the same thing.
export async function GET() {
  const [saved, cv] = await Promise.all([getAnswers(), getProfile()]);
  const fromCv = cv ? answersFromCv(cv.text, cv.years) : {};
  const answers: Answers = { ...EMPTY_ANSWERS, country: 'Nigeria', timezone: 'GMT+1 (WAT)', portfolio: 'https://adefilasamuel.com', ...fromCv };
  for (const f of ANSWER_FIELDS) if (saved?.[f.key]) answers[f.key] = saved[f.key];
  return NextResponse.json({ answers, saved: !!saved });
}

export async function PUT(req: NextRequest) {
  const body = await req.json() as Partial<Answers>;
  const clean = { ...EMPTY_ANSWERS };
  for (const f of ANSWER_FIELDS) clean[f.key] = String(body[f.key] ?? '').trim().slice(0, f.long ? 1500 : 300);
  const error = await saveAnswers(clean);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ answers: clean, saved: true });
}
