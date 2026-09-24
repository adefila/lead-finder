import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createSupabaseClient(url, key);
}

export async function getSentIds(days = 30): Promise<string[]> {
  const supabase = createClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('sent_jobs')
    .select('id')
    .gte('sent_at', since);

  if (error) {
    console.error('[supabase] getSentIds error:', error);
    return [];
  }

  return (data ?? []).map((row: { id: string }) => row.id);
}

export async function markSent(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = createClient();
  const rows = ids.map(id => ({ id, sent_at: new Date().toISOString() }));

  const { error } = await supabase
    .from('sent_jobs')
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    console.error('[supabase] markSent error:', error);
  } else {
    console.log(`[supabase] Marked ${ids.length} jobs as sent`);
  }
}
