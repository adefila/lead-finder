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
  html?: string;
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
    ...(mail.html ? { html: mail.html } : {}),
    ...(mail.inReplyTo ? { inReplyTo: mail.inReplyTo, references: [mail.inReplyTo] } : {}),
  });
  return info.messageId;
}

const OPT_OUT = /\b(unsubscribe|not interested|no thanks|no thank you|stop emailing|remove me|take me off|don'?t (contact|email) me|please stop)\b/i;

export interface ReplyCheck { email: string; since: Date }
export interface ReplyFound { replied: boolean; optedOut: boolean }
export interface InboxCheck { replies: Map<string, ReplyFound>; bounced: Set<string> }

// One IMAP session for all leads: look for any message from each address since we first wrote.
// What a bounce message means for the lead. Only a dead address ("dead") says anything about the lead.
// Sender-side failures (5.7.x authentication or policy blocks, full mailbox, temporary errors) are "other".
export type BounceKind = 'dead' | 'other';
export function classifyBounce(message: string): BounceKind {
  const text = message.toLowerCase();
  // 5.4.1 "Recipient address rejected" is how Microsoft 365 answers for a mailbox that does not exist.
  const deadAddress = /\b5\.1\.[0-6]\b|\b5\.4\.1\b|recipient address rejected|address not found|couldn'?t be found|does not exist|no such user|user unknown|unknown user/.test(text);
  return deadAddress && !/\b5\.7\.\d+\b/.test(text) ? 'dead' : 'other';
}

export async function checkReplies(cfg: MailConfig, checks: ReplyCheck[]): Promise<InboxCheck> {
  const found = new Map<string, ReplyFound>();
  const bounced = new Set<string>();
  if (!checks.length) return { replies: found, bounced };

  const client = new ImapFlow({
    host: cfg.imapHost,
    port: 993,
    secure: true,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false,
    // A slow mail server must never hold up the whole run.
    connectionTimeout: 10_000,
    greetingTimeout: 8_000,
    socketTimeout: 15_000,
  });
  await client.connect();
  const lock = await client.getMailboxLock('INBOX');
  try {
    // Only messages from the leads we're watching. On Gmail the server finds them with its own
    // search (a few "from:" queries), which stays fast however full the inbox gets. Reading the
    // sender of every inbox message since the oldest lead took longer than the 12 seconds the
    // run allows once the inbox grew, so most runs skipped the check. Other servers fall back
    // to that one pass over the inbox.
    const earliest = new Date(Math.min(...checks.map(ch => ch.since.getTime())));
    const sinceFor = new Map(checks.map(ch => [ch.email.toLowerCase(), ch.since.getTime()]));
    const latestFrom = new Map<string, number>();
    let range: { since: Date } | number[] = { since: earliest };
    if (/gmail\.com$/i.test(cfg.imapHost)) {
      // A day early: Gmail reads "after:" in its own time zone. Exact times are checked below.
      const from = new Date(earliest.getTime() - 86_400_000);
      const after = `${from.getUTCFullYear()}/${from.getUTCMonth() + 1}/${from.getUTCDate()}`;
      const addresses = [...sinceFor.keys()];
      const uids = new Set<number>();
      for (let i = 0; i < addresses.length; i += 40) {
        const query = `from:(${addresses.slice(i, i + 40).join(' OR ')}) after:${after}`;
        for (const uid of (await client.search({ gmraw: query }, { uid: true })) || []) uids.add(uid);
      }
      range = [...uids];
    }
    const messages = Array.isArray(range) && !range.length ? [] : client.fetch(range, { uid: true, envelope: true, internalDate: true }, { uid: true });
    for await (const m of messages) {
      const from = m.envelope?.from?.[0]?.address?.toLowerCase();
      if (!from || !sinceFor.has(from)) continue;
      const at = m.internalDate ? new Date(m.internalDate).getTime() : Date.now();
      if (at < (sinceFor.get(from) ?? 0)) continue;
      if ((latestFrom.get(from) ?? -1) < m.uid) latestFrom.set(from, m.uid);
    }

    for (const [email, latest] of latestFrom) {
      let optedOut = false;
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

    // Delivery failures ("Mail Delivery Subsystem") name the address that bounced.
    const since = new Date(Math.min(...checks.map(ch => ch.since.getTime())));
    const failures = await client.search({ or: [{ from: 'mailer-daemon' }, { from: 'postmaster' }], since }, { uid: true });
    const watched = checks.map(ch => ch.email.toLowerCase());
    // One pass over the newest messages (a fetch per message took long enough to time out the whole check)
    const recent = (failures || []).slice(-40);
    for await (const msg of recent.length ? client.fetch(recent, { uid: true, source: true }, { uid: true }) : []) {
      if (!msg.source) continue;
      const text = msg.source.toString('utf8').toLowerCase();
      // Only a dead address counts: sender-side failures say nothing about the lead (see classifyBounce)
      if (classifyBounce(text) !== 'dead') continue;
      for (const email of watched) if (text.includes(email)) bounced.add(email);
    }
  } finally {
    lock.release();
    await client.logout().catch(() => undefined);
  }
  return { replies: found, bounced };
}


// For leads marked as bounced: what did their bounce messages actually say? An address with any dead-address
// bounce is "dead"; one that only ever had other failures (e.g. your domain was down) is "other".
export async function bounceKinds(cfg: MailConfig, emails: string[], since: Date): Promise<Map<string, BounceKind>> {
  const out = new Map<string, BounceKind>();
  if (!emails.length) return out;
  const client = new ImapFlow({
    host: cfg.imapHost, port: 993, secure: true, auth: { user: cfg.user, pass: cfg.pass }, logger: false,
    connectionTimeout: 15_000, greetingTimeout: 10_000, socketTimeout: 40_000,
  });
  await client.connect();
  const lock = await client.getMailboxLock('INBOX');
  try {
    const uids = await client.search({ or: [{ from: 'mailer-daemon' }, { from: 'postmaster' }], since }, { uid: true });
    const watched = emails.map(e => e.toLowerCase());
    const recent = (uids || []).slice(-400);
    for await (const msg of recent.length ? client.fetch(recent, { uid: true, source: true }, { uid: true }) : []) {
      if (!msg.source) continue;
      const text = msg.source.toString('utf8');
      const kind = classifyBounce(text);
      const lower = text.toLowerCase();
      for (const email of watched) {
        if (!lower.includes(email)) continue;
        out.set(email, out.get(email) === 'dead' || kind === 'dead' ? 'dead' : 'other');
      }
    }
  } finally {
    lock.release();
    await client.logout().catch(() => undefined);
  }
  return out;
}

// Every message in the Sent folder since a moment, with who it went to (for the outbox audit).
export async function sentFolderSince(cfg: MailConfig, since: Date): Promise<{ at: string; to: string; subject: string }[]> {
  const client = new ImapFlow({
    host: cfg.imapHost, port: 993, secure: true, auth: { user: cfg.user, pass: cfg.pass }, logger: false,
    connectionTimeout: 10_000, greetingTimeout: 8_000, socketTimeout: 20_000,
  });
  await client.connect();
  try {
    const folders = await client.list();
    const sent = folders.find(f => f.specialUse === '\\Sent') ?? folders.find(f => /sent/i.test(f.path));
    if (!sent) throw new Error('No Sent folder found');
    const lock = await client.getMailboxLock(sent.path);
    try {
      // IMAP SINCE is by date only, so fetch from the day before and filter by the exact time.
      const uids = await client.search({ since: new Date(since.getTime() - 86_400_000) }, { uid: true });
      const out: { at: string; to: string; subject: string }[] = [];
      if (uids && uids.length) {
        for await (const msg of client.fetch(uids, { envelope: true, internalDate: true }, { uid: true })) {
          const at = new Date(msg.internalDate ?? msg.envelope?.date ?? 0);
          if (at < since) continue;
          out.push({ at: at.toISOString(), to: msg.envelope?.to?.[0]?.address ?? '', subject: msg.envelope?.subject ?? '' });
        }
      }
      return out.sort((a, b) => a.at.localeCompare(b.at));
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}
