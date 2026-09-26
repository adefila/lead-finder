import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, safeEqual, sessionToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return NextResponse.json({ error: 'Set DASHBOARD_PASSWORD in Vercel first' }, { status: 500 });

  const { password } = await req.json().catch(() => ({})) as { password?: unknown };
  const given = typeof password === 'string' ? password : '';

  if (!safeEqual(await sessionToken(given), await sessionToken(expected))) {
    await new Promise(r => setTimeout(r, 1000));
    return NextResponse.json({ error: "That password isn't right" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await sessionToken(expected), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
