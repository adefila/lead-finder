import type { ContactLinks } from '@/types/lead';

export interface SiteReport {
  reachable: boolean | null;
  emails: string[];
  links: ContactLinks;
  issues: string[];
  siteText?: string;
}

const MAX_BYTES = 600_000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';

const JUNK_EMAIL = /(example\.|sentry|wixpress|domain\.com|email\.com|yourdomain|yoursite|godaddy|squarespace\.com|\.(png|jpe?g|gif|webp|svg|css|js)$|^u00|@2x)/i;

type Fetched = { kind: 'ok'; html: string; finalUrl: string } | { kind: 'dead' } | { kind: 'unknown' };

const DEAD_CODES = /ENOTFOUND|ECONNREFUSED|EAI_AGAIN|CERT|SSL|TLS|UNABLE_TO_VERIFY|DEPTH_ZERO/i;

async function getHtml(url: string): Promise<Fetched> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 404 || res.status === 410 || res.status >= 500) return { kind: 'dead' };
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) return { kind: 'unknown' };
    const html = (await res.text()).slice(0, MAX_BYTES);
    return { kind: 'ok', html, finalUrl: res.url || url };
  } catch (e) {
    const err = e as Error & { cause?: { code?: string; message?: string } };
    const detail = `${err.cause?.code ?? ''} ${err.cause?.message ?? ''}`;
    return DEAD_CODES.test(detail) ? { kind: 'dead' } : { kind: 'unknown' };
  }
}

function decodeCfEmail(hex: string): string {
  const key = parseInt(hex.slice(0, 2), 16);
  let out = '';
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  return out;
}

function extractEmails(html: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/mailto:([^"'?\s>]+)/gi)) found.add(decodeURIComponent(m[1]));
  for (const m of html.matchAll(/data-cfemail="([0-9a-f]+)"/gi)) found.add(decodeCfEmail(m[1]));
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ');
  for (const m of text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) found.add(m[0]);
  return [...found].map(e => e.trim().toLowerCase()).filter(e => e.includes('@') && !JUNK_EMAIL.test(e));
}

function extractLinks(html: string): ContactLinks {
  const links: ContactLinks = {};
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map(m => m[1]);
  for (const h of hrefs) {
    if (!links.linkedin && /linkedin\.com\/(company|in)\//i.test(h)) links.linkedin = h;
    else if (!links.twitter && /(twitter\.com|x\.com)\/(?!share|intent|home)[A-Za-z0-9_]+/i.test(h)) links.twitter = h;
    else if (!links.instagram && /instagram\.com\/(?!p\/|explore)[A-Za-z0-9_.]+/i.test(h)) links.instagram = h;
    else if (!links.facebook && /facebook\.com\/(?!sharer|share|plugins|tr\?)[A-Za-z0-9_.-]+/i.test(h)) links.facebook = h;
  }
  return links;
}

function findPage(html: string, base: string, pattern: RegExp): string | null {
  for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    if (!pattern.test(m[1])) continue;
    try {
      const url = new URL(m[1], base);
      if (url.hostname === new URL(base).hostname) return url.toString();
    } catch { /* skip malformed */ }
  }
  return null;
}

function visibleText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function structuredNames(html: string): string[] {
  const names = new Set<string>();
  for (const m of html.matchAll(/"(founder|author|employee|member)"\s*:\s*\[?\s*\{[^}]*?"name"\s*:\s*"([^"]{3,60})"/gi)) {
    names.add(`${m[1]}: ${m[2]}`);
  }
  return [...names];
}

function detectIssues(html: string, finalUrl: string): string[] {
  const issues: string[] = [];
  if (finalUrl.startsWith('http://')) issues.push('no HTTPS (browsers show "Not secure")');
  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) issues.push('not mobile-friendly (no viewport tag)');

  const years = [...html.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map(m => Number(m[1]));
  const latest = years.length ? Math.max(...years) : null;
  if (latest && latest <= new Date().getFullYear() - 3) issues.push(`footer copyright says ${latest}`);

  if (/<table[^>]+(width|bgcolor)=/i.test(html) || /<font[\s>]/i.test(html)) issues.push('built with very old HTML (tables/font tags)');
  if (/\.wixsite\.com|\.weebly\.com|\.godaddysites\.com|\.business\.site/i.test(finalUrl)) issues.push('on a free builder subdomain, no custom domain');
  if (/under construction|coming soon/i.test(html.slice(0, 20000))) issues.push('site says "under construction" / "coming soon"');
  if (html.replace(/<[^>]+>/g, '').trim().length < 400) issues.push('almost no content on the homepage');
  return issues;
}

export async function analyzeWebsite(url: string): Promise<SiteReport> {
  const home = await getHtml(url);
  if (home.kind === 'dead') return { reachable: false, emails: [], links: {}, issues: ['website is down or broken'] };
  if (home.kind === 'unknown') return { reachable: null, emails: [], links: {}, issues: [] };

  const emails = extractEmails(home.html);
  const links = extractLinks(home.html);
  const issues = detectIssues(home.html, home.finalUrl);
  const names = structuredNames(home.html);

  const aboutUrl = findPage(home.html, home.finalUrl, /about|team|our-story|meet|staff|doctor|bio/i);
  const contactUrl = emails.length ? null : findPage(home.html, home.finalUrl, /contact/i);
  const [about, contact] = await Promise.all([
    aboutUrl ? getHtml(aboutUrl) : null,
    contactUrl && contactUrl !== aboutUrl ? getHtml(contactUrl) : null,
  ]);

  let aboutText = '';
  for (const page of [about, contact]) {
    if (page?.kind !== 'ok') continue;
    emails.push(...extractEmails(page.html));
    names.push(...structuredNames(page.html));
    const extra = extractLinks(page.html);
    for (const k of Object.keys(extra) as (keyof ContactLinks)[]) links[k] ??= extra[k];
    if (page === about) aboutText = visibleText(page.html).slice(0, 1500);
  }

  const host = new URL(home.finalUrl).hostname.replace(/^www\./, '');
  const unique = [...new Set(emails)];
  unique.sort((a, b) => Number(b.endsWith(host)) - Number(a.endsWith(host)));

  const siteText = [
    names.length ? `Structured data: ${[...new Set(names)].join('; ')}` : '',
    `Homepage: ${visibleText(home.html).slice(0, 900)}`,
    aboutText ? `About page: ${aboutText}` : '',
  ].filter(Boolean).join('\n');

  return { reachable: true, emails: unique.slice(0, 3), links, issues, siteText };
}
