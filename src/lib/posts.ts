import type { Post } from '@/types/post';
import crypto from 'crypto';
import { parseStringPromise } from 'xml2js';

function postId(platform: string, key: string): string {
  return crypto.createHash('md5').update(`${platform}:${key}`).digest('hex').slice(0, 16);
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── Reddit (public JSON, best-effort) ───────────────────────────────────────
// Reddit has been blocking cloud IPs since 2023. We target high-signal subs
// with specific post titles to get the most relevant results when it works.

async function fetchRedditFeed(url: string): Promise<Post[]> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'LeadFinderBot/1.0 (+https://adefilasamuel.com; contact adefilasamuel929@gmail.com)',
        'Accept': 'application/json',
      },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = await res.json() as {
      data?: { children?: Array<{ data: { id: string; title: string; selftext: string; permalink: string; author: string; created_utc: number; link_flair_text?: string } }> };
    };
    const children = data?.data?.children ?? [];
    const posts: Post[] = [];
    for (const { data: p } of children) {
      posts.push({
        id: postId('reddit', p.id),
        platform: 'reddit',
        url: `https://reddit.com${p.permalink}`,
        title: p.title,
        snippet: (p.selftext || p.title).slice(0, 500),
        author: p.author,
        createdAt: new Date(p.created_utc * 1000).toISOString(),
      });
    }
    return posts;
  } catch { return []; }
}

async function fetchRedditPosts(): Promise<Post[]> {
  // r/forhire [Hiring] posts are the highest signal — people actively looking to pay
  const feeds = [
    'https://www.reddit.com/r/forhire/search.json?q=flair%3AHiring+web+design&sort=new&t=week&limit=50&restrict_sr=1',
    'https://www.reddit.com/r/forhire/search.json?q=flair%3AHiring+framer&sort=new&t=week&limit=50&restrict_sr=1',
    'https://www.reddit.com/r/forhire/search.json?q=flair%3AHiring+landing+page&sort=new&t=week&limit=50&restrict_sr=1',
    'https://www.reddit.com/r/forhire/search.json?q=flair%3AHiring+figma&sort=new&t=week&limit=50&restrict_sr=1',
    'https://www.reddit.com/r/forhire/search.json?q=flair%3AHiring+website+designer&sort=new&t=week&limit=50&restrict_sr=1',
    'https://www.reddit.com/r/entrepreneur/search.json?q=need+website+designer&sort=new&t=week&limit=30',
    'https://www.reddit.com/r/startups/search.json?q=landing+page+help&sort=new&t=week&limit=30',
  ];

  const allPosts: Post[] = [];
  for (const feed of feeds) {
    const posts = await fetchRedditFeed(feed);
    allPosts.push(...posts);
  }
  return allPosts;
}

// ─── Hacker News (Algolia API, very reliable) ─────────────────────────────────

async function fetchHNPosts(): Promise<Post[]> {
  const since = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
  // Mix story + comment searches — comments often have "I need X" context
  const queries = [
    'framer developer',
    'web designer landing page',
    'need designer website',
    'figma framer site',
    'hire web designer',
    'startup needs website',
    'looking for designer',
  ];
  const posts: Post[] = [];

  for (const q of queries) {
    try {
      const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}&tags=(story,comment)&hitsPerPage=30&numericFilters=created_at_i>${since}`;
      const res = await fetch(url, { next: { revalidate: 0 } });
      if (!res.ok) continue;
      const data = await res.json() as {
        hits: Array<{ objectID: string; title?: string; story_title?: string; comment_text?: string; author: string; created_at: string }>;
      };
      for (const hit of data.hits) {
        const title = hit.title || hit.story_title || 'HN Post';
        const snippet = stripHtml(hit.comment_text || title);
        posts.push({
          id: postId('hackernews', hit.objectID),
          platform: 'hackernews',
          url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
          title: title.slice(0, 120),
          snippet: snippet.slice(0, 500),
          author: hit.author,
          createdAt: hit.created_at,
        });
      }
    } catch { /* skip */ }
  }
  return posts;
}

// ─── Product Hunt RSS (free, no auth, ~50 launches/day) ──────────────────────
// New launches = founders who just shipped and likely need a polished site

async function fetchProductHuntPosts(): Promise<Post[]> {
  try {
    const res = await fetch('https://www.producthunt.com/feed', {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 LeadFinderBot', 'Accept': 'application/rss+xml, application/xml' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const text = await res.text();
    const parsed = await parseStringPromise(text, { explicitArray: false });
    const items = parsed?.rss?.channel?.item;
    if (!items) return [];
    const arr = Array.isArray(items) ? items : [items];
    const posts: Post[] = [];
    for (const item of arr as Record<string, unknown>[]) {
      const title = String(item.title ?? '');
      const desc = stripHtml(String(item.description ?? '')).slice(0, 500);
      const link = String(item.link ?? '');
      const id = postId('producthunt', link || title);
      posts.push({
        id,
        platform: 'reddit', // using reddit as closest bucket, displayed as "Product Hunt"
        url: link,
        title: `[Product Hunt] ${title}`.slice(0, 120),
        snippet: desc,
        author: 'Product Hunt',
        createdAt: String(item.pubDate ?? new Date().toISOString()),
      });
    }
    return posts;
  } catch { return []; }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function fetchAllPosts(): Promise<Post[]> {
  console.log('[posts] Fetching from Reddit + HN + Product Hunt...');
  const [reddit, hn, ph] = await Promise.all([
    fetchRedditPosts(),
    fetchHNPosts(),
    fetchProductHuntPosts(),
  ]);

  const seen = new Set<string>();
  const deduped = [...reddit, ...hn, ...ph].filter(p => {
    if (!p.id || seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  console.log(`[posts] ${deduped.length} unique posts (${reddit.length} Reddit, ${hn.length} HN, ${ph.length} PH)`);
  return deduped;
}
