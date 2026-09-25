import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { authUrl, gmailConfigured } from '@/lib/gmail';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!gmailConfigured()) {
    return NextResponse.json({ error: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel first' }, { status: 500 });
  }
  const state = crypto.randomBytes(16).toString('hex');
  const res = NextResponse.redirect(authUrl(`${req.nextUrl.origin}/api/gmail/callback`, state));
  res.cookies.set('gmail_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' });
  return res;
}
