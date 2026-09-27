import type { Lead } from '@/types/lead';
import { platformOf } from '@/lib/enrich';
import { emailDomainAccepts } from '@/lib/verify';

// Hunter.io finds email addresses that are published or follow a company's pattern.
// Free plan: 25 searches a month. Every call below that costs a search is counted by Hunter,
// and we check what is left before spending any.
const API = 'https://api.hunter.io/v2';
// The lead search runs twice a day. 2 per run, with 5 always kept back for the
// "Find their email" button, fits the free plan. Raise HUNTER_PER_RUN on a paid plan.
const PER_RUN = Number(process.env.HUNTER_PER_RUN ?? 2);
const KEEP_FOR_BUTTON = 5;

const apiKey = () => process.env.HUNTER_API_KEY?.trim();
export const hunterConfigured = () => !!apiKey();

async function get<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const key = apiKey();
  if (!key) return null;
  const q = new URLSearchParams({ ...params, api_key: key });
  try {
    const res = await fetch(`${API}${path}?${q}`, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) {
      console.error(`[hunter] ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.error(`[hunter] ${path}:`, (e as Error).message);
    return null;
  }
}

// Searches left this month. Checking this is free.
export async function searchesLeft(): Promise<number> {
  const acc = await get<{ data?: { requests?: { searches?: { used?: number; available?: number } } } }>('/account', {});
  const s = acc?.data?.requests?.searches;
  return s ? Math.max(0, (s.available ?? 0) - (s.used ?? 0)) : 0;
}

// Their own website's domain. Instagram, Treatwell and the like are not theirs.
export function domainOf(l: Lead): string | null {
  const site = l.contactLinks?.website;
  if (!site || platformOf(site)) return null;
  try { return new URL(site.startsWith('http') ? site : `https://${site}`).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; }
}

export interface FoundEmail { email: string; name?: string; title?: string; confidence: number }

const OWNER = /owner|founder|director|principal|partner|ceo|managing|proprietor|manager/i;

// One Hunter search. With a known person we look for their address; otherwise we take the
// best-scored address on the domain, preferring the owner or manager.
export async function findEmailFor(l: Lead): Promise<FoundEmail | null> {
  const domain = domainOf(l);
  if (!domain) return null;

  const [first, ...rest] = (l.contactName ?? '').replace(/^(dr|mr|mrs|ms)\.?\s+/i, '').trim().split(/\s+/);
  let found: FoundEmail | null = null;

  if (first && rest.length) {
    const r = await get<{ data?: { email?: string; score?: number; position?: string } }>('/email-finder', {
      domain, first_name: first, last_name: rest[rest.length - 1],
    });
    if (r?.data?.email && (r.data.score ?? 0) >= 60) {
      found = { email: r.data.email, name: l.contactName, title: r.data.position ?? undefined, confidence: r.data.score ?? 0 };
    }
  } else {
    type E = { value: string; confidence?: number; first_name?: string | null; last_name?: string | null; position?: string | null };
    const r = await get<{ data?: { emails?: E[] } }>('/domain-search', { domain, limit: '10' });
    const emails = (r?.data?.emails ?? []).filter(e => (e.confidence ?? 0) >= 50);
    emails.sort((a, b) =>
      Number(OWNER.test(b.position ?? '')) - Number(OWNER.test(a.position ?? ''))
      || (b.confidence ?? 0) - (a.confidence ?? 0));
    const best = emails[0];
    if (best) {
      const name = [best.first_name, best.last_name].filter(Boolean).join(' ');
      found = { email: best.value, name: name || undefined, title: best.position ?? undefined, confidence: best.confidence ?? 0 };
    }
  }

  if (!found) return null;
  found.email = found.email.toLowerCase();
  return (await emailDomainAccepts(found.email)) ? found : null;
}

// Used by the daily run: fill in emails for the best-fit leads that have a website but no email.
export async function addEmails(leads: Lead[]): Promise<number> {
  if (!hunterConfigured()) return 0;
  const wanting = leads
    .filter(l => !l.contactEmail && domainOf(l))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  if (!wanting.length) return 0;

  const budget = Math.max(0, Math.min(PER_RUN, (await searchesLeft()) - KEEP_FOR_BUTTON));
  let added = 0;
  for (const l of wanting.slice(0, budget)) {
    const f = await findEmailFor(l);
    if (!f) continue;
    l.contactEmail = f.email;
    if (!l.contactName && f.name) { l.contactName = f.name; l.contactTitle = f.title; }
    added++;
  }
  console.log(`[hunter] ${added} of ${Math.min(budget, wanting.length)} searches found an email (${wanting.length} leads had a website but no email)`);
  return added;
}
