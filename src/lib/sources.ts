import { parseStringPromise } from 'xml2js';
import type { Lead } from '@/types/lead';

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── Upwork RSS ───────────────────────────────────────────────────────────────
// Upwork = CLIENTS posting "I need someone to build my website"
// This is exactly the right type of lead: a person/company with a budget who
// needs a Framer / landing page / web design project done.

async function fetchUpworkQuery(query: string): Promise<Lead[]> {
  try {
    const url = `https://www.upwork.com/ab/feed/jobs/rss?q=${encodeURIComponent(query)}&sort=recency&paging=0%3B20`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) { console.log(`[upwork] ${query}: HTTP ${res.status}`); return []; }
    const text = await res.text();
    if (!text.includes('<item>') && !text.includes('<item/>')) { console.log(`[upwork] ${query}: no items in feed`); return []; }
    const parsed = await parseStringPromise(text, { explicitArray: false });
    const items = parsed?.rss?.channel?.item;
    if (!items) return [];
    const arr = Array.isArray(items) ? items : [items];
    return arr.map((item: Record<string, unknown>) => {
      // Upwork RSS sometimes puts the URL in <guid> instead of <link>
      const rawLink = String(item.link ?? '');
      const rawGuid = typeof item.guid === 'object' && item.guid !== null
        ? String((item.guid as Record<string, unknown>)._ ?? (item.guid as Record<string, unknown>)['#text'] ?? item.guid)
        : String(item.guid ?? '');
      const link = rawLink.startsWith('http') ? rawLink : rawGuid.startsWith('http') ? rawGuid : rawLink;
      return {
        id: link || `upwork-${slugify(String(item.title ?? ''))}`,
        title: String(item.title ?? 'Untitled'),
        company: 'Upwork Client',
        description: stripHtml(String(item.description ?? item['content:encoded'] ?? '')).slice(0, 700),
        url: link,
        source: 'upwork' as const,
        postedAt: String(item.pubDate ?? new Date().toISOString()),
      };
    });
  } catch (e) {
    console.error(`[upwork] ${query}:`, (e as Error).message);
    return [];
  }
}

async function fetchUpwork(): Promise<Lead[]> {
  // These queries target CLIENTS who need a website — not job seekers
  const queries = [
    'framer developer',
    'framer website',
    'figma to framer',
    'web designer landing page',
    'landing page designer',
    'marketing website design',
    'website redesign startup',
    'webflow framer',
    'figma web design',
    'startup website designer',
  ];

  const results = await Promise.allSettled(queries.map(fetchUpworkQuery));
  const all: Lead[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
    else console.error('[upwork] query failed:', r.reason);
  }

  const seen = new Set<string>();
  const deduped = all.filter(l => {
    if (!l.id || seen.has(l.id)) return false;
    seen.add(l.id);
    return true;
  });
  console.log(`[sources] Upwork: ${deduped.length} client projects`);
  return deduped;
}

// ─── Freelancer.com API ───────────────────────────────────────────────────────
// Freelancer = clients posting fixed-price or hourly projects for web design.
// Public endpoint, no auth required for basic project search.

async function fetchFreelancer(): Promise<Lead[]> {
  // Skill IDs: 9=Web Design, 121=User Interface/IA, 3=Graphic Design, 26=CSS, 20=HTML
  const skillSets = [
    [9, 121],   // Web Design + UI
    [9, 26, 20], // Web Design + CSS + HTML
  ];

  const all: Lead[] = [];
  for (const jobs of skillSets) {
    try {
      const jobParams = jobs.map(id => `jobs[]=${id}`).join('&');
      const url = `https://www.freelancer.com/api/projects/0.1/projects/active/?compact=true&limit=25&${jobParams}&sort_field=time_updated&reverse_sort=true`;
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json',
          'Freelancer-OAuth-V1': process.env.FREELANCER_API_KEY ?? '',
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) { console.log(`[freelancer] HTTP ${res.status}`); continue; }
      const data = await res.json() as { status?: string; result?: { projects?: Record<string, unknown>[] } };
      if (data.status !== 'success') continue;
      const projects = data.result?.projects ?? [];
      for (const p of projects) {
        const id = `freelancer-${String(p.id ?? '')}`;
        const title = String(p.title ?? 'Untitled');
        const desc = stripHtml(String(p.preview_description ?? p.description ?? '')).slice(0, 700);
        const seoUrl = String(p.seo_url ?? '');
        const budget = p.budget as { minimum?: number; maximum?: number } | undefined;
        const budgetStr = budget?.minimum ? ` (Budget: $${budget.minimum}–$${budget.maximum ?? '?'})` : '';
        all.push({
          id,
          title,
          company: 'Freelancer Client',
          description: desc + budgetStr,
          url: seoUrl || `https://www.freelancer.com/projects/${p.id}`,
          source: 'remotive' as const, // using closest bucket until we add freelancer source
          postedAt: p.time_submitted ? new Date(Number(p.time_submitted) * 1000).toISOString() : new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('[freelancer]', (e as Error).message);
    }
  }

  const seen = new Set<string>();
  const deduped = all.filter(l => { if (seen.has(l.id)) return false; seen.add(l.id); return true; });
  console.log(`[sources] Freelancer.com: ${deduped.length} client projects`);
  return deduped;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function fetchAllJobs(): Promise<Lead[]> {
  console.log('[sources] Fetching client projects (Upwork + Freelancer.com)...');

  const [upwork, freelancer] = await Promise.allSettled([
    fetchUpwork(),
    fetchFreelancer(),
  ]);

  const all: Lead[] = [];
  if (upwork.status === 'fulfilled') all.push(...upwork.value);
  else console.error('[sources] Upwork failed:', upwork.reason);
  if (freelancer.status === 'fulfilled') all.push(...freelancer.value);
  else console.error('[sources] Freelancer failed:', freelancer.reason);

  const seen = new Set<string>();
  const deduped = all.filter(l => {
    if (!l.id || seen.has(l.id)) return false;
    seen.add(l.id);
    return true;
  });

  console.log(`[sources] Total unique client projects: ${deduped.length}`);
  return deduped;
}
