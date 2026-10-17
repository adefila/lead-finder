import { NextResponse } from 'next/server';
import { mailConfig, sendMail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Sends ONE clearly labelled email through the same Workspace mailbox and SMTP login the outreach uses, to your
// own test address (MAIL_TEST_TO, your personal Gmail). No lead is touched. Open the message in Gmail and choose
// "Show original": DKIM, SPF and DMARC should all say PASS.
export async function POST() {
  const cfg = mailConfig();
  if (!cfg) return NextResponse.json({ error: 'Mail is not set up: the email login is missing in Vercel' }, { status: 400 });
  const to = process.env.MAIL_TEST_TO?.trim() || 'adefilasamuel929@gmail.com';
  const started = Date.now();
  try {
    const messageId = await sendMail(cfg, {
      to,
      subject: 'Lead Finder sending test',
      text: [
        'This is a test from Lead Finder. No lead received it.',
        '',
        'It was sent with the same mailbox and login as your outreach emails.',
        'Check the sending is healthy: in Gmail open this message, choose the three dots, then "Show original".',
        'DKIM, SPF and DMARC should all say PASS for adefilasamuel.com.',
      ].join('\n'),
    });
    return NextResponse.json({ ok: true, from: cfg.user, to, ms: Date.now() - started, messageId });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message, from: cfg.user }, { status: 500 });
  }
}
