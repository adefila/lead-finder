import { NextRequest, NextResponse } from 'next/server';
import { mailConfig, testMailSetup } from '@/lib/mailer';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Sends one email to your own address only, so it is safe to run any time.
export async function POST(req: NextRequest) {
  if (req.headers.get('x-manual') !== 'true') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const cfg = mailConfig();
  if (!cfg) return NextResponse.json({ error: 'Add GMAIL_USER and GMAIL_APP_PASSWORD in Vercel, then redeploy' }, { status: 400 });
  try {
    await testMailSetup(cfg);
    return NextResponse.json({ ok: true, to: cfg.user });
  } catch (e) {
    const message = (e as Error).message;
    const hint = /535|Invalid login|Username and Password|AUTHENTICATIONFAILED/i.test(message)
      ? 'Gmail rejected the login. Check GMAIL_USER is your full address and GMAIL_APP_PASSWORD is the 16-character app password, not your normal password.'
      : message;
    return NextResponse.json({ error: hint }, { status: 502 });
  }
}
