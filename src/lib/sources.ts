import type { Lead } from '@/types/lead';

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const QUERIES = [
  'website',
  'landing page',
  'website redesign',
  'framer',
  'webflow',
  'wordpress website',
  'figma to website',
  'business website',
];

const WEB_CATEGORIES = new Set([
  'web-design', 'website-design', 'web-development', 'wordpress', 'shopify-development', 'shopify',
  'html', 'css', 'html5', 'landing-pages', 'framer', 'webflow', 'wix', 'squarespace', 'figma',
  'ui-design', 'user-interface-ia', 'php', 'ecommerce', 'woocommerce', 'website-development',
]);
const WANT = /\b(website|web site|landing page|web design|homepage|framer|webflow|wordpress|squarespace|wix|shopify (site|store|website)|redesign|portfolio site|e-?commerce site)\b/i;
const REJECT = /\b(seo|backlink|ads|advertis|media buyer|scrap(e|er|ing)|data entry|leads|mobile app|android|ios|flutter|react native|videos?|3d|animat|logo|social media|instagram|tiktok|translat|proofread|copywrit|telecaller|calling|business development|bde|qa|testing|milestone|recruit)\b/i;

const MAX_AGE_DAYS = 7;
const MAX_BIDS = 80;

interface FlProject {
  id: number;
  title?: string;
  seo_url?: string;
  preview_description?: string;
  description?: string;
  time_submitted?: number;
  budget?: { minimum?: number; maximum?: number };
  currency?: { code?: string };
  bid_stats?: { bid_count?: number };
  type?: string;
}

async function searchFreelancer(query: string): Promise<FlProject[]> {
  const url = `https://www.freelancer.com/api/projects/0.1/projects/active/?compact=true&limit=50&full_description=true&sort_field=time_submitted&query=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) { console.log(`[freelancer] ${query}: HTTP ${res.status}`); return []; }
    const data = await res.json() as { status?: string; result?: { projects?: FlProject[] } };
    return data.result?.projects ?? [];
  } catch (e) {
    console.error(`[freelancer] ${query}:`, (e as Error).message);
    return [];
  }
}

export async function fetchAllJobs(): Promise<Lead[]> {
  const results = await Promise.all(QUERIES.map(searchFreelancer));
  const cutoff = Date.now() / 1000 - MAX_AGE_DAYS * 86400;
  const seen = new Set<number>();
  const leads: Lead[] = [];
  let raw = 0;

  for (const p of results.flat()) {
    raw++;
    if (seen.has(p.id)) continue;
    seen.add(p.id);

    const title = p.title ?? '';
    const desc = stripHtml(p.description ?? p.preview_description ?? '');
    const text = `${title} ${desc}`;
    const bids = p.bid_stats?.bid_count ?? 0;

    if ((p.time_submitted ?? 0) < cutoff) continue;
    if (bids > MAX_BIDS) continue;
    const category = (p.seo_url ?? '').split('/')[0].toLowerCase();
    if (REJECT.test(title)) continue;
    if (!WEB_CATEGORIES.has(category) && !WANT.test(title)) continue;
    if (!WANT.test(text)) continue;

    const cur = p.currency?.code ?? 'USD';
    const budget = p.budget?.minimum
      ? `${cur} ${p.budget.minimum}-${p.budget.maximum ?? '?'}${p.type === 'hourly' ? '/hr' : ''}`
      : 'Budget not set';

    leads.push({
      id: `freelancer-${p.id}`,
      title,
      company: `${budget} · ${bids} bids so far`,
      description: desc.slice(0, 1200),
      url: `https://www.freelancer.com/projects/${p.seo_url ?? p.id}`,
      source: 'freelancer',
      postedAt: new Date((p.time_submitted ?? 0) * 1000).toISOString(),
    });
  }

  console.log(`[sources] Freelancer: ${raw} raw, ${leads.length} website projects after filtering`);
  return leads;
}
