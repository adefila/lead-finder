import { parseStringPromise } from 'xml2js';
import type { Lead } from '@/types/lead';

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── Remotive (free JSON API, reliable from servers) ─────────────────────────

async function fetchRemotive(search: string): Promise<Lead[]> {
  const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(search)}&limit=50`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return [];
  const json = await res.json() as { jobs?: Record<string, unknown>[] };
  return (json.jobs ?? []).map(j => ({
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
  const queries = ['framer', 'figma', 'web designer', 'landing page', 'webflow', 'no-code', 'frontend designer'];
  const results = await Promise.allSettled(queries.map(fetchRemotive));
  const all: Lead[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }
  const seen = new Set<string>();
  return all.filter(l => { if (seen.has(l.id)) return false; seen.add(l.id); return true; });
}

// ─── WeWorkRemotely RSS (reliable public RSS) ─────────────────────────────────

async function fetchWeWorkRemotely(): Promise<Lead[]> {
  const feeds = [
    'https://weworkremotely.com/categories/remote-design-jobs.rss',
    'https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss',
  ];
  const all: Lead[] = [];
  for (const feedUrl of feeds) {
    try {
      const res = await fetch(feedUrl, { cache: 'no-store' });
      if (!res.ok) continue;
      const text = await res.text();
      const parsed = await parseStringPromise(text, { explicitArray: false });
      const items = parsed?.rss?.channel?.item;
      if (!items) continue;
      const arr = Array.isArray(items) ? items : [items];
      for (const item of arr as Record<string, string>[]) {
        const link = item.link ?? item.guid ?? '';
        all.push({
          id: link || `wwr-${slugify(item.title ?? '')}`,
          title: item.title ?? 'Untitled',
          company: item['woe:company_name'] ?? 'Unknown',
          description: stripHtml(item.description ?? '').slice(0, 600),
          url: link,
          source: 'weworkremotely' as const,
          postedAt: item.pubDate ?? new Date().toISOString(),
        });
      }
    } catch { /* skip */ }
  }
  return all;
}

// ─── Working Nomads (free JSON API, works from Vercel) ───────────────────────

async function fetchWorkingNomads(): Promise<Lead[]> {
  const categories = ['design', 'front-end'];
  const all: Lead[] = [];
  for (const cat of categories) {
    try {
      const res = await fetch(
        `https://www.workingnomads.com/api/exposed_jobs/?category=${cat}&limit=100`,
        { cache: 'no-store', headers: { 'Accept': 'application/json' } }
      );
      if (!res.ok) continue;
      const jobs = await res.json() as Record<string, unknown>[];
      const framerTerms = /framer|figma|web design|ui.?ux|webflow|no.?code|landing page|website|portfolio/i;
      for (const j of jobs) {
        const title = String(j.title ?? '');
        const desc = String(j.description ?? '');
        if (!framerTerms.test(title) && !framerTerms.test(desc.slice(0, 200))) continue;
        all.push({
          id: `nomads-${String(j.id ?? slugify(title))}`,
          title,
          company: String(j.company ?? 'Unknown'),
          description: stripHtml(desc).slice(0, 600),
          url: String(j.url ?? j.apply_url ?? ''),
          source: 'remotive' as const, // closest bucket
          postedAt: String(j.pub_date ?? new Date().toISOString()),
        });
      }
    } catch { /* skip */ }
  }
  return all;
}

// ─── RemoteOK (JSON API) ─────────────────────────────────────────────────────

async function fetchRemoteOK(): Promise<Lead[]> {
  try {
    const res = await fetch('https://remoteok.com/api?tags=design,framer,figma', {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 LeadFinderBot' },
    });
    if (!res.ok) return [];
    const json: unknown[] = await res.json();
    const jobs = json.slice(1) as Record<string, unknown>[];
    const framerTerms = /framer|figma|web design|ui.?ux|webflow|no.?code|landing page|website/i;
    return jobs
      .filter(j => {
        const pos = String(j.position ?? '');
        const tags = Array.isArray(j.tags) ? (j.tags as string[]).join(' ') : '';
        const desc = String(j.description ?? '');
        return framerTerms.test(pos) || framerTerms.test(tags) || framerTerms.test(desc.slice(0, 200));
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
  } catch { return []; }
}

// ─── Upwork RSS (best-effort — sometimes blocked from cloud IPs) ──────────────

async function fetchUpworkRSS(query: string): Promise<Lead[]> {
  try {
    const url = `https://www.upwork.com/ab/feed/jobs/rss?q=${encodeURIComponent(query)}&sort=recency&paging=0%3B20`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const text = await res.text();
    if (!text.includes('<item>')) return [];
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
  } catch { return []; }
}

async function fetchUpwork(): Promise<Lead[]> {
  const queries = [
    'framer developer',
    'figma to framer',
    'web designer framer',
    'landing page designer',
    'framer website',
    'figma web design',
  ];
  const results = await Promise.allSettled(queries.map(fetchUpworkRSS));
  const all: Lead[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }
  const seen = new Set<string>();
  return all.filter(l => { if (seen.has(l.id)) return false; seen.add(l.id); return true; });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function fetchAllJobs(): Promise<Lead[]> {
  console.log('[sources] Fetching from all sources...');

  const results = await Promise.allSettled([
    fetchUpwork(),
    fetchRemoteOK(),
    fetchRemotiveAll(),
    fetchWeWorkRemotely(),
    fetchWorkingNomads(),
  ]);

  const sourceNames = ['Upwork', 'RemoteOK', 'Remotive', 'WeWorkRemotely', 'WorkingNomads'];
  const all: Lead[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') {
      console.log(`[sources] ${sourceNames[i]}: ${r.value.length} jobs`);
      all.push(...r.value);
    } else {
      console.error(`[sources] ${sourceNames[i]} failed:`, r.reason);
    }
  }

  const seen = new Set<string>();
  const deduped = all.filter(l => {
    if (!l.id || seen.has(l.id)) return false;
    seen.add(l.id);
    return true;
  });

  console.log(`[sources] Total unique jobs: ${deduped.length}`);
  return deduped;
}
