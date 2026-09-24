import { parseStringPromise } from 'xml2js';
import type { Lead } from '@/types/lead';

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchUpworkRSS(query: string): Promise<Lead[]> {
  const url = `https://www.upwork.com/ab/feed/jobs/rss?q=${encodeURIComponent(query)}&sort=recency`;
  const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0' } });
  const text = await res.text();
  const parsed = await parseStringPromise(text, { explicitArray: false });
  const items = parsed?.rss?.channel?.item;
  if (!items) return [];
  const arr = Array.isArray(items) ? items : [items];
  return arr.map((item: Record<string, string>) => {
    const link = item.link ?? '';
    return {
      id: link || `upwork-${slugify(item.title ?? '')}`,
      title: item.title ?? 'Untitled',
      company: 'Upwork Client',
      description: stripHtml(item.description ?? item['content:encoded'] ?? '').slice(0, 600),
      url: link,
      source: 'upwork' as const,
      postedAt: item.pubDate ?? new Date().toISOString(),
    };
  });
}

async function fetchUpwork(): Promise<Lead[]> {
  const queries = ['framer developer', 'figma to framer', 'web designer framer'];
  const results = await Promise.allSettled(queries.map(fetchUpworkRSS));
  const all: Lead[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }
  // deduplicate by id within this source
  const seen = new Set<string>();
  return all.filter(l => { if (seen.has(l.id)) return false; seen.add(l.id); return true; });
}

async function fetchRemoteOK(): Promise<Lead[]> {
  const url = 'https://remoteok.com/api?tags=design';
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
  });
  const json: unknown[] = await res.json();
  // First element is metadata, skip it
  const jobs = json.slice(1) as Record<string, unknown>[];
  const framerTerms = /framer|figma|web design|ui.?ux|webflow|no.?code|landing page|website/i;
  return jobs
    .filter(j => {
      const pos = String(j.position ?? '');
      const tags = Array.isArray(j.tags) ? (j.tags as string[]).join(' ') : '';
      return framerTerms.test(pos) || framerTerms.test(tags);
    })
    .map(j => ({
      id: String(j.id ?? j.url ?? `remoteok-${slugify(String(j.position ?? ''))}`),
      title: String(j.position ?? 'Untitled'),
      company: String(j.company ?? 'Unknown'),
      description: stripHtml(String(j.description ?? '')).slice(0, 600),
      url: String(j.url ?? ''),
      source: 'remoteok' as const,
      postedAt: j.date ? String(j.date) : new Date().toISOString(),
    }));
}

async function fetchRemotive(search: string): Promise<Lead[]> {
  const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(search)}`;
  const res = await fetch(url, { cache: 'no-store' });
  const json = await res.json() as { jobs?: Record<string, unknown>[] };
  const jobs = json.jobs ?? [];
  return jobs.map(j => ({
    id: String(j.id ?? `remotive-${slugify(String(j.title ?? ''))}`),
    title: String(j.title ?? 'Untitled'),
    company: String(j.company_name ?? 'Unknown'),
    description: stripHtml(String(j.description ?? '')).slice(0, 600),
    url: String(j.url ?? ''),
    source: 'remotive' as const,
    postedAt: String(j.publication_date ?? new Date().toISOString()),
  }));
}

async function fetchRemotiveAll(): Promise<Lead[]> {
  const searches = ['framer', 'web designer'];
  const results = await Promise.allSettled(searches.map(fetchRemotive));
  const all: Lead[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }
  const seen = new Set<string>();
  return all.filter(l => { if (seen.has(l.id)) return false; seen.add(l.id); return true; });
}

async function fetchWeWorkRemotely(): Promise<Lead[]> {
  const url = 'https://weworkremotely.com/categories/remote-design-jobs.rss';
  const res = await fetch(url, { cache: 'no-store' });
  const text = await res.text();
  const parsed = await parseStringPromise(text, { explicitArray: false });
  const items = parsed?.rss?.channel?.item;
  if (!items) return [];
  const arr = Array.isArray(items) ? items : [items];
  return arr.map((item: Record<string, string>) => {
    const link = item.link ?? item.guid ?? '';
    return {
      id: link || `wwr-${slugify(item.title ?? '')}`,
      title: item.title ?? 'Untitled',
      company: item['woe:company_name'] ?? 'Unknown',
      description: stripHtml(item.description ?? '').slice(0, 600),
      url: link,
      source: 'weworkremotely' as const,
      postedAt: item.pubDate ?? new Date().toISOString(),
    };
  });
}

export async function fetchAllJobs(): Promise<Lead[]> {
  console.log('[sources] Fetching from all sources...');

  const results = await Promise.allSettled([
    fetchUpwork(),
    fetchRemoteOK(),
    fetchRemotiveAll(),
    fetchWeWorkRemotely(),
  ]);

  const all: Lead[] = [];
  const sourceNames = ['Upwork', 'RemoteOK', 'Remotive', 'WeWorkRemotely'];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') {
      console.log(`[sources] ${sourceNames[i]}: ${r.value.length} jobs`);
      all.push(...r.value);
    } else {
      console.error(`[sources] ${sourceNames[i]} failed:`, r.reason);
    }
  }

  // Global dedup by id
  const seen = new Set<string>();
  const deduped = all.filter(l => {
    if (!l.id || seen.has(l.id)) return false;
    seen.add(l.id);
    return true;
  });

  console.log(`[sources] Total unique jobs fetched: ${deduped.length}`);
  return deduped;
}
