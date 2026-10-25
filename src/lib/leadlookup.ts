import type { Lead } from '@/types/lead';
import { getLeadById, getLeadIds } from '@/lib/supabase';
import { noteCode, visitCode } from '@/lib/tracking';

// Tracked links carry a signed code, not the lead id, so finding the lead means checking the code
// against every id. Reading the whole leads table for that on every click (scanners included) was the
// biggest CPU cost, so the code-to-id maps are kept in memory and refreshed every few minutes.
const TTL_MS = 5 * 60_000;
// A code that is not in the map may belong to a lead added a moment ago. Look again, but at most
// this often, so junk codes cannot make every request re-read the table.
const RETRY_MS = 30_000;

type Kind = 'visit' | 'note';
const codeOf: Record<Kind, (id: string) => string> = { visit: visitCode, note: noteCode };
const maps = new Map<Kind, { at: number; byCode: Map<string, string> }>();
const loading = new Map<Kind, Promise<void>>();

function refresh(kind: Kind): Promise<void> {
  let p = loading.get(kind);
  if (!p) {
    p = getLeadIds().then(ids => {
      maps.set(kind, { at: Date.now(), byCode: new Map(ids.map(id => [codeOf[kind](id), id])) });
    }).finally(() => loading.delete(kind));
    loading.set(kind, p);
  }
  return p;
}

// The lead behind a tracked-link code, or null.
export async function findLeadByCode(kind: Kind, code: string): Promise<Lead | null> {
  let entry = maps.get(kind);
  if (!entry || Date.now() - entry.at > TTL_MS) { await refresh(kind); entry = maps.get(kind); }
  let id = entry?.byCode.get(code);
  if (!id && entry && Date.now() - entry.at > RETRY_MS) { await refresh(kind); id = maps.get(kind)?.byCode.get(code); }
  return id ? getLeadById(id) : null;
}
