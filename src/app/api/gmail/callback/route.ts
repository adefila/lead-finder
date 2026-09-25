import { NextRequest, NextResponse } from 'next/server';
import { ALLOWED_GMAIL, exchangeCode, profileEmail } from '@/lib/gmail';
import { setSetting } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const home = new URL('/', req.nextUrl.origin);
  const fail = (reason: string) => {
    home.searchParams.set('gmail', 'error');
    home.searchParams.set('reason', reason);
    return NextResponse.redirect(home);
  };

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  if (req.nextUrl.searchParams.get('error')) return fail('Google sign-in was cancelled');
  if (!code || !state || state !== req.cookies.get('gmail_oauth_state')?.value) return fail('Sign-in expired, try again');

  try {
    const tokens = await exchangeCode(code, `${req.nextUrl.origin}/api/gmail/callback`);
    const email = await profileEmail(tokens.access_token);
    if (email !== ALLOWED_GMAIL) return fail(`Connect ${ALLOWED_GMAIL}, not ${email}`);
    if (!tokens.refresh_token) return fail('Google did not return a refresh token, try again');

    await setSetting('gmail_refresh_token', tokens.refresh_token);
    await setSetting('gmail_email', email);
  } catch (e) {
    console.error('[gmail] callback:', e);
    return fail((e as Error).message.slice(0, 120));
  }

  home.searchParams.set('gmail', 'connected');
  const res = NextResponse.redirect(home);
  res.cookies.delete('gmail_oauth_state');
  return res;
}
