import type { Post } from '@/types/post';
import crypto from 'crypto';

function postId(platform: string, key: string): string {
  return crypto.createHash('md5').update(`${platform}:${key}`).digest('hex').slice(0, 16);
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchRedditPosts(): Promise<Post[]> {
  const feeds = [
    'https://www.reddit.com/r/forhire/new.json?limit=50',
    'https://www.reddit.com/r/webdesign/new.json?limit=50',
    'https://www.reddit.com/search.json?q=looking+for+framer+developer&sort=new&t=week&limit=50',
    'https://www.reddit.com/search.json?q=need+web+designer+landing+page&sort=new&t=week&limit=50',
    'https://www.reddit.com/search.json?q=hire+framer+figma+designer&sort=new&t=week&limit=50',
    'https://www.reddit.com/r/entrepreneur/search.json?q=web+design&sort=new&t=week&limit=50',
    'https://www.reddit.com/r/startups/search.json?q=landing+page+designer&sort=new&t=week&limit=50',
  ];

  const posts: Post[] = [];
  for (const feed of feeds) {
    try {
      const res = await fetch(feed, {
        headers: { 'User-Agent': 'LeadFinderBot/1.0 (by SamuelAdefila; contact adefilasamuel929@gmail.com)' },
        next: { revalidate: 0 },
      });
      if (!res.ok) continue;
      const data = await res.json() as {
        data: { children: Array<{ data: { id: string; title: string; selftext: string; permalink: string; author: string; created_utc: number } }> };
      };
      for (const { data: p } of data.data.children) {
        const url = `https://reddit.com${p.permalink}`;
        posts.push({
          id: postId('reddit', p.id),
          platform: 'reddit',
          url,
          title: p.title,
          snippet: (p.selftext || p.title).slice(0, 500),
          author: p.author,
          createdAt: new Date(p.created_utc * 1000).toISOString(),
        });
      }
    } catch (e) {
      console.error('[posts] Reddit feed error:', feed, e);
    }
  }
  return posts;
}

async function fetchHNPosts(): Promise<Post[]> {
  const since = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
  const queries = ['framer developer', 'web designer landing page', 'need designer website', 'figma framer', 'no-code website builder'];
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
    } catch (e) {
      console.error('[posts] HN query error:', q, e);
    }
  }
  return posts;
}

export async function fetchAllPosts(): Promise<Post[]> {
  console.log('[posts] Fetching from Reddit + HN...');
  const [reddit, hn] = await Promise.all([fetchRedditPosts(), fetchHNPosts()]);
  const seen = new Set<string>();
  const deduped = [...reddit, ...hn].filter(p => {
    if (!p.id || seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
  console.log(`[posts] ${deduped.length} unique posts (${reddit.length} Reddit, ${hn.length} HN)`);
  return deduped;
}
