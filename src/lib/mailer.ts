import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

// Gmail today, Zoho later: switch with MAIL_PROVIDER, MAIL_USER and MAIL_PASSWORD.
const PROVIDERS = {
  gmail: { smtp: 'smtp.gmail.com', imap: 'imap.gmail.com' },
  zoho: { smtp: 'smtp.zoho.com', imap: 'imap.zoho.com' },
} as const;

export interface MailConfig {
  user: string;
  pass: string;
  smtpHost: string;
  imapHost: string;
  fromName: string;
}

export function mailConfig(): MailConfig | null {
  const user = process.env.MAIL_USER ?? process.env.GMAIL_USER;
  const pass = (process.env.MAIL_PASSWORD ?? process.env.GMAIL_APP_PASSWORD)?.replace(/\s+/g, '');
  if (!user || !pass) return null;
  const provider = (process.env.MAIL_PROVIDER ?? 'gmail').toLowerCase() as keyof typeof PROVIDERS;
  const hosts = PROVIDERS[provider] ?? PROVIDERS.gmail;
  return { user, pass, smtpHost: hosts.smtp, imapHost: hosts.imap, fromName: process.env.MAIL_FROM_NAME ?? 'Samuel Adefila' };
}

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string;
}

export async function sendMail(cfg: MailConfig, mail: OutgoingMail): Promise<string> {
  const transport = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: 465,
    secure: true,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  const info = await transport.sendMail({
    from: { name: cfg.fromName, address: cfg.user },
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    ...(mail.inReplyTo ? { inReplyTo: mail.inReplyTo, references: [mail.inReplyTo] } : {}),
  });
  return info.messageId;
}

const OPT_OUT = /\b(unsubscribe|not interested|no thanks|no thank you|stop emailing|remove me|take me off|don'?t (contact|email) me|please stop)\b/i;

export interface ReplyCheck { email: string; since: Date }
export interface ReplyFound { replied: boolean; optedOut: boolean }

// One IMAP session for all leads: look for any message from each address since we first wrote.
export async function checkReplies(cfg: MailConfig, checks: ReplyCheck[]): Promise<Map<string, ReplyFound>> {
  const found = new Map<string, ReplyFound>();
  if (!checks.length) return found;

  const client = new ImapFlow({
    host: cfg.imapHost,
    port: 993,
    secure: true,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false,
  });
  await client.connect();
  const lock = await client.getMailboxLock('INBOX');
  try {
    for (const { email, since } of checks) {
      const uids = await client.search({ from: email, since }, { uid: true });
      if (!uids || !uids.length) continue;

      let optedOut = false;
      const latest = uids[uids.length - 1];
      const msg = await client.fetchOne(String(latest), { source: true }, { uid: true });
      if (msg && msg.source) {
        const parsed = await simpleParser(msg.source);
        const subject = parsed.subject ?? '';
        if (/automatic reply|out of office|auto-?reply|autoreply/i.test(subject)) continue;
        // Only the new part of the reply, not the quoted original.
        const fresh = (parsed.text ?? '').split(/\n>|\nOn .{5,80}wrote:/)[0].trim();
        optedOut = OPT_OUT.test(fresh) || /^no[.!]?$/i.test(fresh);
      }
      found.set(email.toLowerCase(), { replied: true, optedOut });
    }
  } finally {
    lock.release();
    await client.logout().catch(() => undefined);
  }
  return found;
}

// Proves both halves work: sends a note to yourself over SMTP, then opens the inbox over IMAP.
export async function testMailSetup(cfg: MailConfig): Promise<{ sent: boolean; inbox: boolean }> {
  await sendMail(cfg, {
    to: cfg.user,
    subject: 'Lead Finder test email',
    text: 'This is a test from Lead Finder. If you can read this, sending works.\n\nYou can delete this email.',
  });
  const client = new ImapFlow({ host: cfg.imapHost, port: 993, secure: true, auth: { user: cfg.user, pass: cfg.pass }, logger: false });
  await client.connect();
  await client.mailboxOpen('INBOX');
  await client.logout().catch(() => undefined);
  return { sent: true, inbox: true };
}
