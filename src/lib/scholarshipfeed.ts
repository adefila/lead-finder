import { getFeed, saveFeed } from '@/lib/supabase';

// Newly posted scholarships, read from a free public feed (scholars4dev.com). Only master's awards that are open to
// students from any developing country (or Nigeria) and to computing, engineering or any field are kept. The feed holds
// only the latest ten posts, so each daily run adds what is new to the ones already kept.

export interface FeedItem {
  title: string;
  link: string;
  posted: string;      // when the site published it
  foundAt: string;     // when this app first saw it
  region: string;      // e.g. "Europe" or "Italy"
  deadline: string;    // e.g. "April-June Deadline"
}

const FEED = 'https://www.scholars4dev.com/feed/';
const KEEP = 60;
const TTL_MS = 12 * 3600_000;
const REGIONS = ['Germany', 'Sweden', 'Hungary', 'Austria', 'Italy', 'Switzerland', 'Finland', 'Netherlands', 'France', 'Denmark', 'Norway', 'Poland', 'Czech Republic', 'Europe', 'UK', 'USA', 'Canada', 'Australia', 'Japan', 'Korea', 'Turkey', 'China'];

const decode = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&#8217;|&#039;|&rsquo;/g, "'").replace(/&#8211;|&ndash;/g, '-').replace(/&quot;/g, '"').trim();

export function parse(xml: string, now: string): FeedItem[] {
  const out: FeedItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const body = m[1];
    const title = decode(body.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '');
    const link = decode(body.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? '');
    const posted = decode(body.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? '');
    const cats = [...body.matchAll(/<category>([\s\S]*?)<\/category>/g)].map(c => decode(c[1]));
    if (!title || !link) continue;
    const has = (re: RegExp) => cats.some(c => re.test(c));
    if (!has(/^masters$/i) || has(/^closed$/i)) continue;
    if (!has(/any developing country|any country|scholarships for nigerians/i)) continue;
    if (!has(/any field|science and technology|engineering|computer|information tech|\bit\b/i)) continue;
    out.push({
      title, link, posted: posted ? new Date(posted).toISOString() : now, foundAt: now,
      region: cats.find(c => REGIONS.includes(c)) ?? 'International',
      deadline: cats.find(c => /deadline/i.test(c)) ?? '',
    });
  }
  return out;
}

// Pull the feed and add anything new. Safe to call often: it only fetches when the stored copy is over 12 hours old.
export async function refreshFeed(force = false): Promise<FeedItem[]> {
  const stored = await getFeed();
  if (!force && stored.updatedAt && Date.now() - new Date(stored.updatedAt).getTime() < TTL_MS) return stored.items;
  try {
    const res = await fetch(FEED, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadFinder/1.0)' }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const fresh = parse(await res.text(), new Date().toISOString());
    const known = new Set(stored.items.map(i => i.link));
    const merged = [...fresh.filter(i => !known.has(i.link)), ...stored.items].slice(0, KEEP);
    await saveFeed(merged);
    return merged;
  } catch (e) {
    console.error('[scholarships] feed failed:', e instanceof Error ? e.message : e);
    return stored.items;
  }
}
