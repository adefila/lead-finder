import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { mailConfig, sendMail } from '@/lib/mailer';
import { getLeads } from '@/lib/supabase';
import { splitDraft, toHtml, withSignature } from '@/lib/compose';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Checks the Baton mailbox login without sending anything: signs in to the sending (SMTP) and reading (IMAP) servers and says what each answered.
// Never returns the password. Behind the dashboard login like every other page.
export async function GET() {
  const cfg = mailConfig('baton');
  if (!cfg) return NextResponse.json({ connected: false, error: 'BATON_MAIL_USER or BATON_MAIL_PASSWORD is not set' });
  const out: Record<string, unknown> = { connected: true, login: cfg.user, sender: `${cfg.fromName} <${cfg.fromAddress ?? cfg.user}>`, smtpHost: cfg.smtpHost, imapHost: cfg.imapHost };

  try {
    await nodemailer.createTransport({ host: cfg.smtpHost, port: 465, secure: true, auth: { user: cfg.user, pass: cfg.pass }, connectionTimeout: 15_000 }).verify();
    out.smtp = 'ok';
  } catch (e) { out.smtp = `failed: ${(e as Error).message.slice(0, 200)}`; }

  const client = new ImapFlow({ host: cfg.imapHost, port: 993, secure: true, auth: { user: cfg.user, pass: cfg.pass }, logger: false, connectionTimeout: 15_000, greetingTimeout: 10_000, socketTimeout: 20_000 });
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    out.imap = 'ok';
    lock.release();
  } catch (e) {
    const x = e as Error & { responseText?: string };
    out.imap = `failed: ${(x.responseText || x.message).slice(0, 200)}`;
  } finally {
    await client.logout().catch(() => undefined);
  }
  return NextResponse.json(out);
}

// Sends ONE test email from the Baton mailbox to the address given ({ "to": "you@example.com" }), using a real Baton draft so the sender name,
// address, subject and signature are exactly what a prospect would see. Nothing is sent to any lead and no lead changes.
export async function POST(req: NextRequest) {
  const cfg = mailConfig('baton');
  if (!cfg) return NextResponse.json({ error: 'The Baton mailbox is not set up' }, { status: 400 });
  const { to } = await req.json().catch(() => ({})) as { to?: unknown };
  const address = typeof to === 'string' ? to.trim() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) return NextResponse.json({ error: 'Send { "to": "an email address" }' }, { status: 400 });

  const sample = (await getLeads()).find(l => l.contactLinks?.segment === 'baton' && l.proposal);
  if (!sample) return NextResponse.json({ error: 'No Baton draft to use as the sample' }, { status: 400 });
  const { subject, body } = splitDraft(sample.proposal ?? '');
  const text = withSignature(body);
  try {
    const id = await sendMail(cfg, { to: address, subject: `[Test] ${subject}`, text, html: toHtml(text) });
    return NextResponse.json({ sent: true, to: address, from: `${cfg.fromName} <${cfg.fromAddress ?? cfg.user}>`, subject: `[Test] ${subject}`, sampleLead: sample.title, messageId: id });
  } catch (e) {
    return NextResponse.json({ sent: false, error: (e as Error).message.slice(0, 300) }, { status: 502 });
  }
}
