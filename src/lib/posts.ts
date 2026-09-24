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
// Targeting people who are LOOKING TO HIRE a web designer — not general discussion.
// r/forhire [Hiring] = people paying for freelance work (highest signal)
// r/entrepreneur / r/smallbusiness = founders asking "I need a website"

async function fetchRedditFeed(url: string): Promise<Post[]> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'LeadFinderBot/1.0 (+https://adefilasamuel.com; contact adefilasamuel929@gmail.com)',
        'Accept': 'application/json',
      },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) { console.log(`[reddit] HTTP ${res.status} for ${url.slice(0, 80)}`); return []; }
    const data = await res.json() as {
      data?: {
        children?: Array<{
          data: {
            id: string; title: string; selftext: string;
            permalink: string; author: string; created_utc: number;
            link_flair_text?: string;
          };
        }>;
      };
    };
    const children = data?.data?.children ?? [];
    return children.map(({ data: p }) => ({
      id: postId('reddit', p.id),
      platform: 'reddit' as const,
      url: `https://reddit.com${p.permalink}`,
      title: p.title,
      snippet: (p.selftext || p.title).slice(0, 500),
      author: p.author,
      createdAt: new Date(p.created_utc * 1000).toISOString(),
    }));
  } catch (e) {
    console.log(`[reddit] error: ${(e as Error).message}`);
    return [];
  }
}

async function fetchRedditPosts(): Promise<Post[]> {
  const feeds = [
    // r/forhire [Hiring] — people actively paying for web work RIGHT NOW
    'https://www.reddit.com/r/forhire/search.json?q=flair%3AHiring+web+design&sort=new&t=week&limit=50&restrict_sr=1',
    'https://www.reddit.com/r/forhire/search.json?q=flair%3AHiring+framer&sort=new&t=week&limit=50&restrict_sr=1',
    'https://www.reddit.com/r/forhire/search.json?q=flair%3AHiring+landing+page&sort=new&t=week&limit=50&restrict_sr=1',
    'https://www.reddit.com/r/forhire/search.json?q=flair%3AHiring+website&sort=new&t=week&limit=50&restrict_sr=1',
    'https://www.reddit.com/r/forhire/search.json?q=flair%3AHiring+figma&sort=new&t=week&limit=50&restrict_sr=1',
    'https://www.reddit.com/r/forhire/search.json?q=flair%3AHiring+webflow&sort=new&t=week&limit=50&restrict_sr=1',
    // r/forhire general new posts about web design (without flair filter to catch more)
    'https://www.reddit.com/r/forhire/search.json?q=need+web+designer&sort=new&t=week&limit=25&restrict_sr=1',
    'https://www.reddit.com/r/forhire/search.json?q=hire+website+designer&sort=new&t=week&limit=25&restrict_sr=1',
    // r/entrepreneur — founders who need a website for their startup
    'https://www.reddit.com/r/entrepreneur/search.json?q=need+website+designer&sort=new&t=week&limit=25',
    'https://www.reddit.com/r/entrepreneur/search.json?q=landing+page+help&sort=new&t=week&limit=25',
    'https://www.reddit.com/r/entrepreneur/search.json?q=website+recommendations+designer&sort=new&t=week&limit=25',
    // r/smallbusiness — small business owners who need a website
    'https://www.reddit.com/r/smallbusiness/search.json?q=need+website+designer&sort=new&t=week&limit=25',
    'https://www.reddit.com/r/smallbusiness/search.json?q=website+help+design&sort=new&t=week&limit=25',
    // r/startups — early-stage companies that need landing pages
    'https://www.reddit.com/r/startups/search.json?q=landing+page+designer&sort=new&t=week&limit=20',
    'https://www.reddit.com/r/startups/search.json?q=need+web+designer+framer&sort=new&t=week&limit=20',
  ];

  const allPosts: Post[] = [];
  for (const feed of feeds) {
    const posts = await fetchRedditFeed(feed);
    allPosts.push(...posts);
  }
  console.log(`[posts] Reddit: ${allPosts.length} raw posts`);
  return allPosts;
}

// ─── Hacker News (Algolia API) ────────────────────────────────────────────────
// Focus ONLY on the monthly "Ask HN: Freelancer?" threads AND direct hiring asks.
// These threads contain "HIRING: looking for a web designer" comments — pure signal.
// General HN tech discussion is NOT useful — we skip it entirely.

async function fetchHNFreelancerThreads(): Promise<Post[]> {
  const posts: Post[] = [];
  try {
    // Fetch the most recent "Ask HN: Freelancer?" monthly thread
    const searchUrl = `https://hn.algolia.com/api/v1/search?query=Ask+HN+Freelancer+Seeking+work+or+hiring&tags=story&hitsPerPage=5`;
    const res = await fetch(searchUrl, { next: { revalidate: 0 } });
    if (!res.ok) return [];
    const data = await res.json() as {
      hits: Array<{ objectID: string; title?: string; author: string; created_at: string }>;
    };

    for (const thread of data.hits.slice(0, 2)) {
      // Fetch comments on this thread — look for "HIRING" comments
      const commentsUrl = `https://hn.algolia.com/api/v1/search_by_date?tags=comment,story_${thread.objectID}&hitsPerPage=100`;
      const cRes = await fetch(commentsUrl, { next: { revalidate: 0 } });
      if (!cRes.ok) continue;
      const cData = await cRes.json() as {
        hits: Array<{ objectID: string; comment_text?: string; author: string; created_at: string }>;
      };

      for (const comment of cData.hits) {
        const text = stripHtml(comment.comment_text ?? '');
        // Only include comments that are people HIRING (not seeking work)
        if (
          text.toLowerCase().startsWith('hiring') ||
          text.toLowerCase().includes('we are hiring') ||
          text.toLowerCase().includes('looking for a web') ||
          text.toLowerCase().includes('looking for a designer') ||
          text.toLowerCase().includes('need a framer') ||
          text.toLowerCase().includes('need a web designer') ||
          text.toLowerCase().includes('website designer needed')
        ) {
          posts.push({
            id: postId('hackernews', comment.objectID),
            platform: 'hackernews',
            url: `https://news.ycombinator.com/item?id=${comment.objectID}`,
            title: `[HN Hiring] ${text.slice(0, 80)}`,
            snippet: text.slice(0, 500),
            author: comment.author,
            createdAt: comment.created_at,
          });
        }
      }
    }
  } catch (e) {
    console.log(`[hn] freelancer thread error: ${(e as Error).message}`);
  }

  // Also fetch direct "who is hiring web designer" stories from the past 2 weeks
  const since = Math.floor(Date.now() / 1000) - 14 * 24 * 60 * 60;
  const hiringQueries = [
    'hire web designer framer landing page',
    'looking for web designer website',
    'web designer needed startup',
  ];

  for (const q of hiringQueries) {
    try {
      const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=15&numericFilters=created_at_i>${since}`;
      const res = await fetch(url, { next: { revalidate: 0 } });
      if (!res.ok) continue;
      const data = await res.json() as {
        hits: Array<{ objectID: string; title?: string; author: string; created_at: string }>;
      };
      for (const hit of data.hits) {
        posts.push({
          id: postId('hackernews', hit.objectID),
          platform: 'hackernews',
          url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
          title: (hit.title ?? 'HN Post').slice(0, 120),
          snippet: (hit.title ?? '').slice(0, 500),
          author: hit.author,
          createdAt: hit.created_at,
        });
      }
    } catch { /* skip */ }
  }

  console.log(`[posts] HN: ${posts.length} hiring posts`);
  return posts;
}

// ─── Product Hunt RSS ─────────────────────────────────────────────────────────
// New launches = founders who just shipped and likely need a better landing page.
// Samuel can reach out: "Congrats on the launch — I notice the site could be polished
// up. I build Framer sites for founders, here's an example."

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
      posts.push({
        id: postId('producthunt', link || title),
        platform: 'reddit' as const,
        url: link,
        title: `[Product Hunt] ${title}`.slice(0, 120),
        snippet: desc,
        author: 'Product Hunt',
        createdAt: String(item.pubDate ?? new Date().toISOString()),
      });
    }
    console.log(`[posts] Product Hunt: ${posts.length} launches`);
    return posts;
  } catch (e) {
    console.log(`[posts] Product Hunt error: ${(e as Error).message}`);
    return [];
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function fetchAllPosts(): Promise<Post[]> {
  console.log('[posts] Fetching from Reddit (forhire/entrepreneur/smallbusiness) + HN hiring threads + Product Hunt...');
  const [reddit, hn, ph] = await Promise.all([
    fetchRedditPosts(),
    fetchHNFreelancerThreads(),
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
