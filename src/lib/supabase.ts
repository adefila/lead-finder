import { createClient as sb } from '@supabase/supabase-js';
import type { Lead, LeadStatus } from '@/types/lead';
import { humanize } from '@/lib/compose';

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return sb(url, key);
}

// Turn missing-column errors into a clear next step.
function explain(message: string): string {
  const col = message.match(/Could not find the '([a-z_]+)' column/)?.[1];
  return col ? 'Your database is missing the "' + col + '" column. Run the setup SQL in Supabase, then try again.' : message;
}

// ─── Legacy dedup (sent_jobs) ─────────────────────────────────────────────────

export async function getSentIds(days = 30): Promise<string[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await db().from('sent_jobs').select('id').gte('sent_at', since);
  return (data ?? []).map((r: { id: string }) => r.id);
}

export async function markSent(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await db().from('sent_jobs').upsert(ids.map(id => ({ id, sent_at: new Date().toISOString() })), { onConflict: 'id' });
}

// ─── Leads ───────────────────────────────────────────────────────────────────

export async function getExistingLeadIds(): Promise<string[]> {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data } = await db().from('leads').select('id').gte('created_at', since);
  return (data ?? []).map((r: { id: string }) => r.id);
}

export async function saveLeads(leads: Lead[]): Promise<void> {
  if (!leads.length) return;
  const rows = leads.map(l => ({
    id: l.id,
    source: l.source,
    title: l.title,
    company: l.company,
    url: l.url,
    description: l.description.slice(0, 600),
    posted_at: l.postedAt,
    score: l.score ?? 0,
    draft_email: l.proposal ?? '',
    status: 'new',
    contact_email: l.contactEmail ?? null,
    contact_name: l.contactName ?? null,
    contact_title: l.contactTitle ?? null,
    contact_phone: l.contactPhone ?? null,
    contact_links: l.contactLinks ?? null,
  }));
  const { error } = await db().from('leads').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
  if (error) console.error('[supabase] saveLeads:', error);
  else console.log(`[supabase] Saved ${leads.length} leads`);
}

// Leads saved before the title format changed read "Name — Outdated website".
const LEGACY_HEADLINE = /\s+[—–-]\s+(No website|Outdated website|Website broken)$/;

function rowToLead(r: Record<string, unknown>): Lead {
  let title = String(r.title ?? '');
  let description = String(r.description ?? '');
  const legacy = title.match(LEGACY_HEADLINE);
  if (legacy) {
    title = title.slice(0, legacy.index).trim();
    if (!description.startsWith(legacy[1])) description = `${legacy[1]}. ${description}`;
  }
  return {
    id: String(r.id),
    source: r.source as Lead['source'],
    title,
    company: String(r.company ?? ''),
    description,
    url: String(r.url ?? ''),
    postedAt: String(r.posted_at ?? ''),
    createdAt: r.created_at ? String(r.created_at) : undefined,
    score: Number(r.score ?? 0),
    proposal: humanize(String(r.draft_email ?? '')),
    status: r.status as Lead['status'],
    contactEmail: r.contact_email ? String(r.contact_email) : undefined,
    contactName: r.contact_name ? String(r.contact_name) : undefined,
    contactTitle: r.contact_title ? String(r.contact_title) : undefined,
    contactPhone: r.contact_phone ? String(r.contact_phone) : undefined,
    contactLinks: (r.contact_links as Lead['contactLinks']) ?? undefined,
    contactedAt: r.contacted_at ? String(r.contacted_at) : undefined,
    followUps: Number(r.follow_ups ?? 0),
    queuedAt: r.queued_at ? String(r.queued_at) : undefined,
    lastSentAt: r.last_sent_at ? String(r.last_sent_at) : undefined,
    sendSubject: r.send_subject ? String(r.send_subject) : undefined,
    lastMessageId: r.last_message_id ? String(r.last_message_id) : undefined,
    sendError: r.send_error ? String(r.send_error) : undefined,
    autoSequence: Boolean(r.auto_sequence),
    optedOut: Boolean(r.opted_out),
    noteOpenedAt: r.note_opened_at ? String(r.note_opened_at) : undefined,
    noteLastViewedAt: r.note_last_viewed_at ? String(r.note_last_viewed_at) : undefined,
    noteViews: Number(r.note_views ?? 0),
  };
}

export async function getLeads(limit = 1000): Promise<Lead[]> {
  const { data, error } = await db()
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('[supabase] getLeads:', error); return []; }
  return (data ?? []).map(rowToLead);
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const { data, error } = await db().from('leads').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return rowToLead(data);
}

export async function updateLeadStatus(id: string, status: LeadStatus): Promise<string | null> {
  const patch: Record<string, unknown> = { status };
  if (status === 'approved') Object.assign(patch, { contacted_at: new Date().toISOString(), follow_ups: 0 });
  if (status === 'new') Object.assign(patch, { contacted_at: null, follow_ups: 0, queued_at: null, auto_sequence: false, send_error: null });
  // Queued leads are sent by the outbox, which also runs their follow-ups.
  if (status === 'queued') Object.assign(patch, { queued_at: new Date().toISOString(), auto_sequence: true, send_error: null });
  const { error } = await db().from('leads').update(patch).eq('id', id);
  return error ? explain(error.message) : null;
}

// When the most recent email (first or follow-up) went out, for spacing sends apart.
// When the latest first email (not a follow-up) went out.
export async function lastFirstSentAt(): Promise<Date | null> {
  const { data, error } = await db().from('leads').select('first_sent_at').not('first_sent_at', 'is', null)
    .order('first_sent_at', { ascending: false }).limit(1).maybeSingle();
  if (error) return lastSentAt();
  return data?.first_sent_at ? new Date(String(data.first_sent_at)) : null;
}

export async function lastSentAt(): Promise<Date | null> {
  const { data } = await db().from('leads').select('last_sent_at').not('last_sent_at', 'is', null)
    .order('last_sent_at', { ascending: false }).limit(1).maybeSingle();
  return data?.last_sent_at ? new Date(String(data.last_sent_at)) : null;
}

// First emails only: follow-ups do not count towards the sending limits.
export async function countFirstSentSince(sinceIso: string): Promise<number> {
  const { count, error } = await db().from('leads').select('id', { count: 'exact', head: true }).gte('first_sent_at', sinceIso);
  if (!error) return count ?? 0;
  // Until the first_sent_at column exists: leads whose latest email was the first one.
  const fallback = await db().from('leads').select('id', { count: 'exact', head: true })
    .gte('last_sent_at', sinceIso).eq('follow_ups', 0);
  return fallback.count ?? 0;
}

export async function updateLead(id: string, patch: Record<string, unknown>): Promise<string | null> {
  const { error } = await db().from('leads').update(patch).eq('id', id);
  return error ? explain(error.message) : null;
}

export async function deleteLeads(ids: string[]): Promise<string | null> {
  const { error } = await db().from('leads').delete().in('id', ids);
  if (error) return explain(error.message);
  // Keep deleted leads out of future runs.
  await markSent(ids);
  return null;
}

export async function markFollowedUp(id: string): Promise<string | null> {
  const lead = await getLeadById(id);
  if (!lead) return 'Lead not found';
  const { error } = await db()
    .from('leads')
    .update({ follow_ups: (lead.followUps ?? 0) + 1, contacted_at: new Date().toISOString() })
    .eq('id', id);
  return error ? explain(error.message) : null;
}
