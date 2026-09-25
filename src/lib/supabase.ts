import { createClient as sb } from '@supabase/supabase-js';
import type { Lead, LeadStatus } from '@/types/lead';
import type { Post } from '@/types/post';
import { humanize } from '@/lib/compose';

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return sb(url, key);
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
  if (status === 'new') Object.assign(patch, { contacted_at: null, follow_ups: 0 });
  const { error } = await db().from('leads').update(patch).eq('id', id);
  return error ? error.message : null;
}

export async function updateLead(id: string, patch: Record<string, unknown>): Promise<string | null> {
  const { error } = await db().from('leads').update(patch).eq('id', id);
  return error ? error.message : null;
}

export async function getSetting(key: string): Promise<string | null> {
  const { data } = await db().from('app_settings').select('value').eq('key', key).maybeSingle();
  return (data as { value?: string } | null)?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const { error } = await db().from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new Error(`setSetting ${key}: ${error.message}`);
}

export async function deleteLeads(ids: string[]): Promise<string | null> {
  const { error } = await db().from('leads').delete().in('id', ids);
  if (error) return error.message;
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
  return error ? error.message : null;
}

// ─── Posts ───────────────────────────────────────────────────────────────────

export async function getExistingPostIds(): Promise<string[]> {
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const { data } = await db().from('posts').select('id').gte('created_at', since);
  return (data ?? []).map((r: { id: string }) => r.id);
}

export async function savePosts(posts: Post[]): Promise<void> {
  if (!posts.length) return;
  const rows = posts.map(p => ({
    id: p.id,
    platform: p.platform,
    url: p.url,
    title: p.title,
    snippet: p.snippet.slice(0, 600),
    author: p.author ?? '',
    score: p.score ?? 0,
    reply_draft: p.replyDraft ?? '',
    status: 'new',
  }));
  const { error } = await db().from('posts').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
  if (error) console.error('[supabase] savePosts:', error);
  else console.log(`[supabase] Saved ${posts.length} posts`);
}

export async function getPosts(limit = 100): Promise<Post[]> {
  const { data, error } = await db()
    .from('posts')
    .select('*')
    .not('status', 'eq', 'done')
    .order('score', { ascending: false })
    .limit(limit);
  if (error) { console.error('[supabase] getPosts:', error); return []; }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    platform: r.platform as Post['platform'],
    url: String(r.url ?? ''),
    title: String(r.title ?? ''),
    snippet: String(r.snippet ?? ''),
    author: String(r.author ?? ''),
    score: Number(r.score ?? 0),
    replyDraft: String(r.reply_draft ?? ''),
    status: r.status as Post['status'],
    createdAt: String(r.created_at ?? ''),
  }));
}

export async function updatePostStatus(id: string, status: Post['status']): Promise<void> {
  await db().from('posts').update({ status }).eq('id', id);
}
