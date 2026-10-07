import type { Lead } from '@/types/lead';
import { findSiteEmails, platformOf } from '@/lib/enrich';
import { emailDomainAccepts } from '@/lib/verify';
import { displayName, needsEmail } from '@/lib/leadview';
import { getLeads, updateLead } from '@/lib/supabase';

// Goes through every lead you could email but have no address for. It reads their website
// (homepage, about and contact pages), or looks the business up on Google Maps to find the
// website first. A lead that still has no working email is moved to Skipped.

const BUDGET_MS = 230_000;
const BATCH = 6;

export interface FindEmailsResult {
  checked: number;
  found: number;
  skipped: number;
  lookups: number;
  remaining: number;
  // What happened to each lead, so the dashboard can show it as it goes.
  results: { id: string; name: string; email: string | null }[];
}

const words = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
  .filter(w => w.length > 2 && !['ltd', 'limited', 'the', 'and', 'llc', 'inc', 'company', 'services'].includes(w));

// Google Maps search for the business name and town. Only trusts a result whose name shares a
// real word with the lead, so a different business with a website is never picked up.
async function websiteFromMaps(l: Lead, apiKey: string): Promise<string | null> {
  const name = displayName(l);
  const place = l.company.split(' · ').slice(1).join(' ').replace(/closes .*$/, '');
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'places.displayName,places.websiteUri' },
      body: JSON.stringify({ textQuery: `${name} ${place}`.trim(), pageSize: 3 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { places?: { displayName?: { text?: string }; websiteUri?: string }[] };
    const want = new Set(words(name));
    const hit = (data.places ?? []).find(p => p.websiteUri && words(p.displayName?.text ?? '').some(w => want.has(w)));
    return hit?.websiteUri && !platformOf(hit.websiteUri) ? hit.websiteUri : null;
  } catch {
    return null;
  }
}

function siteOf(l: Lead): string | null {
  const site = l.contactLinks?.website ?? (/^https?:/.test(l.url) && !/google\.|openstreetmap|find-and-update\.company-information/.test(l.url) ? l.url : null);
  return site && !platformOf(site) ? site : null;
}

async function resolve(l: Lead, apiKey: string | undefined, canLookUp: () => boolean): Promise<{ email: string | null; website: string | null; lookedUp: boolean }> {
  let website = siteOf(l);
  let lookedUp = false;
  if (!website && apiKey && canLookUp()) {
    lookedUp = true;
    website = await websiteFromMaps(l, apiKey);
  }
  if (!website) return { email: null, website: null, lookedUp };
  const { emails } = await findSiteEmails(website);
  for (const e of emails) if (await emailDomainAccepts(e)) return { email: e, website, lookedUp };
  return { email: null, website, lookedUp };
}

// maxLookups caps paid Google Maps searches for this call (the free monthly allowance is shared
// with the twice-daily lead search). ids limits the call to those leads: the dashboard sends a
// few at a time so it can show progress.
export async function findMissingEmails(maxLookups: number, ids?: string[]): Promise<FindEmailsResult> {
  const started = Date.now();
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  // Leads with a website first: they need no paid lookup.
  const wanted = ids ? new Set(ids) : null;
  const todo = (await getLeads(5000)).filter(l => needsEmail(l) && (!wanted || wanted.has(l.id)))
    .sort((a, b) => Number(!siteOf(a)) - Number(!siteOf(b)));
  const result: FindEmailsResult = { checked: 0, found: 0, skipped: 0, lookups: 0, remaining: todo.length, results: [] };
  let lookupsLeft = maxLookups;
  const canLookUp = () => (lookupsLeft > 0 ? (lookupsLeft--, true) : false);

  for (let i = 0; i < todo.length; i += BATCH) {
    if (Date.now() - started > BUDGET_MS) break;
    await Promise.all(todo.slice(i, i + BATCH).map(async l => {
      const r = await resolve(l, apiKey, canLookUp);
      if (r.lookedUp) result.lookups++;
      if (r.email) {
        await updateLead(l.id, {
          contact_email: r.email,
          contact_links: { ...(l.contactLinks ?? {}), ...(r.website ? { website: r.website } : {}) },
        });
        result.found++;
      } else {
        await updateLead(l.id, { status: 'skipped' });
        result.skipped++;
      }
      result.checked++;
      result.results.push({ id: l.id, name: displayName(l), email: r.email });
    }));
  }
  result.remaining = todo.length - result.checked;
  console.log(`[find-emails] checked ${result.checked}, found ${result.found}, skipped ${result.skipped}, ${result.lookups} Maps lookups, ${result.remaining} left`);
  return result;
}
