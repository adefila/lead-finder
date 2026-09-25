import { getLeads, getSetting, setSetting, updateLead } from '@/lib/supabase';
import type { Lead } from '@/types/lead';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const LOOKBACK_DAYS = 90;

export const ALLOWED_GMAIL = (process.env.GMAIL_ADDRESS ?? 'adefilasamuel929@gmail.com').toLowerCase();

export function gmailConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function authUrl(redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    login_hint: ALLOWED_GMAIL,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function tokenRequest(params: Record<string, string>): Promise<{ access_token: string; refresh_token?: string }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      ...params,
    }),
  });
  const data = await res.json() as { access_token?: string; refresh_token?: string; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) throw new Error(data.error_description ?? data.error ?? `Token request failed (${res.status})`);
  return { access_token: data.access_token, refresh_token: data.refresh_token };
}

export function exchangeCode(code: string, redirectUri: string) {
  return tokenRequest({ code, redirect_uri: redirectUri, grant_type: 'authorization_code' });
}

async function gmailGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!res.ok) throw new Error(`Gmail ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

export async function profileEmail(token: string): Promise<string> {
  const p = await gmailGet<{ emailAddress: string }>('/profile', token);
  return p.emailAddress.toLowerCase();
}

type MessageList = { messages?: { id: string }[] };

async function search(token: string, q: string, max: number): Promise<string[]> {
  const data = await gmailGet<MessageList>(`/messages?maxResults=${max}&q=${encodeURIComponent(q)}`, token);
  return (data.messages ?? []).map(m => m.id);
}

async function messageDate(token: string, id: string): Promise<string> {
  const m = await gmailGet<{ internalDate: string }>(`/messages/${id}?format=minimal`, token);
  return new Date(Number(m.internalDate)).toISOString();
}

export interface SyncResult {
  connected: boolean;
  checked: number;
  contacted: number;
  followUps: number;
  replied: number;
  error?: string;
}

async function syncLead(lead: Lead, token: string): Promise<'contacted' | 'followUp' | 'replied' | null> {
  const email = (lead.contactEmail ?? '').replace(/[^a-z0-9@._+-]/gi, '');
  if (!email.includes('@')) return null;
  const since = Math.floor(new Date(lead.createdAt ?? Date.now() - LOOKBACK_DAYS * 86400000).getTime() / 1000);

  const [replies, sent] = await Promise.all([
    search(token, `from:${email} after:${since} -subject:("automatic reply" OR "out of office" OR "auto-reply" OR "autoreply")`, 1),
    search(token, `in:sent to:${email} after:${since}`, 10),
  ]);

  if (replies.length) {
    const patch: Record<string, unknown> = { status: 'replied' };
    if (sent.length) patch.contacted_at = await messageDate(token, sent[0]);
    await updateLead(lead.id, patch);
    return 'replied';
  }
  if (!sent.length) return null;

  // Gmail lists newest first: sent[0] is the latest touch, the rest are earlier messages.
  const latest = await messageDate(token, sent[0]);
  const followUps = sent.length - 1;

  if ((lead.status ?? 'new') === 'new') {
    await updateLead(lead.id, { status: 'approved', contacted_at: latest, follow_ups: followUps });
    return 'contacted';
  }
  if (followUps > (lead.followUps ?? 0)) {
    await updateLead(lead.id, { contacted_at: latest, follow_ups: followUps });
    return 'followUp';
  }
  return null;
}

export async function syncGmail(): Promise<SyncResult> {
  const result: SyncResult = { connected: false, checked: 0, contacted: 0, followUps: 0, replied: 0 };
  const refresh = gmailConfigured() ? await getSetting('gmail_refresh_token') : null;
  if (!refresh) return result;
  result.connected = true;

  try {
    const { access_token } = await tokenRequest({ refresh_token: refresh, grant_type: 'refresh_token' });
    const cutoff = Date.now() - LOOKBACK_DAYS * 86400000;
    const candidates = (await getLeads()).filter(l =>
      l.contactEmail
      && ['new', 'approved'].includes(l.status ?? 'new')
      && new Date(l.createdAt ?? 0).getTime() > cutoff);
    result.checked = candidates.length;

    const CONCURRENCY = 5;
    for (let i = 0; i < candidates.length; i += CONCURRENCY) {
      const outcomes = await Promise.all(candidates.slice(i, i + CONCURRENCY).map(l =>
        syncLead(l, access_token).catch(e => { console.error(`[gmail] ${l.id}:`, (e as Error).message); return null; })));
      for (const o of outcomes) {
        if (o === 'contacted') result.contacted++;
        if (o === 'followUp') result.followUps++;
        if (o === 'replied') result.replied++;
      }
    }
    await setSetting('gmail_last_sync', new Date().toISOString());
  } catch (e) {
    result.error = (e as Error).message;
    console.error('[gmail] sync failed:', result.error);
  }

  console.log(`[gmail] checked ${result.checked}: ${result.contacted} contacted, ${result.followUps} follow-ups, ${result.replied} replied`);
  return result;
}
