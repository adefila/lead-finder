import type { InboxCheck, ReplyCheck } from '@/lib/mailer';
import { OPT_OUT, classifyBounce } from '@/lib/mailer';

// The Baton mailbox over Zoho's web API (HTTPS). Zoho blocks mail-port (SMTP/IMAP) connections from Cloudflare's addresses, so Baton mail is sent
// and read through the API instead. Set up once with scripts/zoho-setup.mjs, which stores ZOHO_DC, ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET,
// ZOHO_REFRESH_TOKEN and ZOHO_ACCOUNT_ID as Worker secrets.

const env = () => ({
  dc: process.env.ZOHO_DC?.trim() || 'com',
  id: process.env.ZOHO_CLIENT_ID?.trim(),
  secret: process.env.ZOHO_CLIENT_SECRET?.trim(),
  refresh: process.env.ZOHO_REFRESH_TOKEN?.trim(),
  account: process.env.ZOHO_ACCOUNT_ID?.trim(),
});

export const zohoApiConfigured = () => { const e = env(); return !!(e.id && e.secret && e.refresh && e.account); };

let cached: { token: string; until: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && Date.now() < cached.until) return cached.token;
  const e = env();
  const res = await fetch(`https://accounts.zoho.${e.dc}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: e.refresh!, client_id: e.id!, client_secret: e.secret! }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({})) as { access_token?: string; expires_in?: number; error?: string };
  if (!body.access_token) throw new Error(`Zoho sign-in failed (${res.status}): ${body.error ?? 'no token'}`);
  cached = { token: body.access_token, until: Date.now() + Math.max(60, (body.expires_in ?? 3600) - 300) * 1000 };
  return body.access_token;
}

async function zoho<T>(path: string, init: RequestInit = {}): Promise<T> {
  const e = env();
  const res = await fetch(`https://mail.zoho.${e.dc}/api/accounts/${e.account}${path}`, {
    ...init,
    headers: { Authorization: `Zoho-oauthtoken ${await accessToken()}`, Accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}), ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(25_000),
  });
  const text = await res.text();
  let body: { data?: unknown; status?: { code?: number; description?: string } } = {};
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok || (body.status?.code && body.status.code >= 400)) {
    throw new Error(`Zoho Mail ${path.split('?')[0]} failed (${res.status}): ${(body.status?.description ?? text).slice(0, 200)}`);
  }
  return body.data as T;
}

export async function sendViaZoho(mail: { fromAddress: string; fromName: string; to: string; subject: string; text: string }): Promise<string> {
  const data = await zoho<{ messageId?: string }>('/messages', {
    method: 'POST',
    body: JSON.stringify({
      fromAddress: `"${mail.fromName.replace(/"/g, '')}" <${mail.fromAddress}>`,
      toAddress: mail.to,
      subject: mail.subject,
      content: mail.text,
      mailFormat: 'plaintext',
      askReceipt: 'no',
    }),
  });
  return String(data?.messageId ?? `zoho-${Date.now()}`);
}

interface ZohoMessage { messageId?: string; fromAddress?: string; sender?: string; subject?: string; summary?: string; receivedTime?: string | number }
const plain = (s?: string) => (s ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
const addressOf = (s?: string) => (plain(s).match(/[A-Z0-9._%+'-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? '').toLowerCase();

async function inboxMessages(): Promise<ZohoMessage[]> {
  const folders = await zoho<{ folderId: string; folderType?: string; folderName?: string }[]>('/folders');
  const inbox = folders.find(f => /^inbox$/i.test(f.folderType ?? '') || /^inbox$/i.test(f.folderName ?? ''));
  if (!inbox) throw new Error('Zoho Mail: no Inbox folder found');
  return await zoho<ZohoMessage[]>(`/messages/view?folderId=${inbox.folderId}&start=1&limit=200&sortBy=date&sortorder=false`) ?? [];
}

// The newest 200 inbox messages are enough: a reply or a bounce shows up within hours, and this runs every 15 minutes.
export async function checkRepliesZoho(checks: ReplyCheck[]): Promise<InboxCheck> {
  const found = new Map<string, { replied: boolean; optedOut: boolean }>();
  const bounced = new Set<string>();
  if (!checks.length) return { replies: found, bounced };
  const sinceFor = new Map(checks.map(c => [c.email.toLowerCase(), c.since.getTime()]));
  for (const m of await inboxMessages()) {
    const from = addressOf(m.fromAddress);
    const at = Number(m.receivedTime) || Date.now();
    const summary = `${m.subject ?? ''} ${m.summary ?? ''}`;
    if (/mailer-daemon|postmaster/i.test(from) || /^(undeliverable|delivery status|mail delivery)/i.test(m.subject ?? '')) {
      if (classifyBounce(summary.toLowerCase()) === 'dead') for (const email of sinceFor.keys()) if (summary.toLowerCase().includes(email)) bounced.add(email);
      continue;
    }
    const since = sinceFor.get(from);
    if (since === undefined || at < since) continue;
    if (/automatic reply|out of office|auto-?reply|autoreply/i.test(m.subject ?? '')) continue;
    const fresh = plain(m.summary).split(/\n>|\nOn .{5,80}wrote:/)[0].trim();
    found.set(from, { replied: true, optedOut: OPT_OUT.test(fresh) || /^no[.!]?$/i.test(fresh) || found.get(from)?.optedOut === true });
  }
  return { replies: found, bounced };
}

// For the dashboard's mailbox test: signs in and counts what it can see, without sending.
export async function testZoho(): Promise<{ signedIn: true; inboxMessages: number }> {
  return { signedIn: true, inboxMessages: (await inboxMessages()).length };
}
