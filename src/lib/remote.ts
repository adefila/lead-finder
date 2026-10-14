import type { Lead } from '@/types/lead';

// Remote roles in your niche from free job boards, kept only when they are open to anyone,
// anywhere: no country or region limit, and no time-zone limit that leaves out Nigeria.

const UA = 'Mozilla/5.0 (compatible; LeadFinder/1.0; +https://adefilasamuel.com)';
const MAX_AGE_DAYS = 14;
const WEB_ROLE = /\b(web|front[- ]?end|framer|webflow|wordpress|shopify|landing|ui|ux|product designer|product design|product engineer|web designer|digital designer)\b/i;
// Samuel's niche: Framer, Webflow, no-code, landing pages, marketing websites, product design,
// UI/UX design and product engineering. A generic backend or React engineer role is not.
const NICHE = /\b(framer|webflow|no-?code|landing[- ]pages?|marketing (site|website|pages?)s?|websites? (design|redesign|build|builds|development)|web ?design(er|ers)?|product design(er|ers)?|product engineer(s|ing)?|ui ?\/ ?ux|ux ?\/ ?ui|ui designer|ux designer|ui and ux|ux and ui|user experience|user interface)\b/i;
const NOT_A_FIT = /\b(intern|internship|werkstudent|praktik|student|director|vp|head of|chief|principal|manager|linguist|translator|interpreter)\b|\(m\/w\/d\)/i;
// A location that means no limit. "Remote (USA)" or "EMEA" is a limit.
const WORLDWIDE = /^\s*(worldwide|anywhere|global|everywhere|anywhere in the world|remote,? worldwide|all countries)\s*$/i;
const NIGERIA_UTC = 1;

interface Role {
  key: string;
  board: string;
  title: string;
  company: string;
  url: string;
  where: string;      // what the board says about location
  places: string[];   // location limits; empty means anywhere
  zones?: number[];   // UTC offsets allowed, when the board lists them
  type: string;       // full time, contract, ...
  posted: Date;
  text: string;       // plain-text description
  salary?: string;
}

const plain = (html = '') => html
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<\/(p|li|h\d|div)>/gi, '. ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ').replace(/(\.\s*){2,}/g, '. ').trim();

// Many listings are in Spanish or German. Keep the ones written in English.
const looksEnglish = (t: string) => (t.slice(0, 600).match(/\b(the|and|you|with|our|we|will|for|your)\b/gi)?.length ?? 0) >= 4;

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) { console.error(`[jobs] ${new URL(url).host}: HTTP ${res.status}`); return null; }
    return (await res.json()) as T;
  } catch (e) {
    console.error(`[jobs] ${new URL(url).host}:`, (e as Error).message);
    return null;
  }
}

async function himalayas(): Promise<Role[]> {
  type J = {
    title: string; companyName: string; excerpt?: string; description?: string; employmentType?: string;
    locationRestrictions?: string[]; timezoneRestrictions?: number[]; pubDate: number; applicationLink: string; guid: string;
    minSalary?: number | null; maxSalary?: number | null; currency?: string | null;
  };
  const queries = ['framer', 'webflow', 'web designer', 'landing page', 'no-code', 'marketing website', 'product designer', 'ui ux designer', 'product engineer'];
  const results = await Promise.all(queries.map(q => getJson<{ jobs?: J[] }>(`https://himalayas.app/jobs/api/search?q=${encodeURIComponent(q)}&limit=50`)));
  return results.flatMap(r => r?.jobs ?? []).map(j => {
    const places = j.locationRestrictions ?? [];
    return {
      key: `himalayas-${j.guid}`,
      board: 'Himalayas',
      title: j.title,
      company: j.companyName,
      url: j.applicationLink || j.guid,
      where: places.length ? `Remote (${places.join(', ')})` : 'Anywhere',
      places,
      zones: j.timezoneRestrictions ?? [],
      type: j.employmentType ?? '',
      posted: new Date(j.pubDate * 1000),
      text: plain(j.description || j.excerpt),
      salary: j.minSalary && j.maxSalary ? `${j.currency ?? ''} ${j.minSalary.toLocaleString()}–${j.maxSalary.toLocaleString()}`.trim() : undefined,
    };
  });
}

async function remotive(): Promise<Role[]> {
  type J = { id: number; url: string; title: string; company_name: string; candidate_required_location?: string; job_type?: string; publication_date: string; description?: string; salary?: string };
  const results = await Promise.all(['design', 'software-dev'].map(c => getJson<{ jobs?: J[] }>(`https://remotive.com/api/remote-jobs?category=${c}&limit=200`)));
  return results.flatMap(r => r?.jobs ?? []).map(j => ({
    key: `remotive-${j.id}`, board: 'Remotive', title: j.title, company: j.company_name, url: j.url,
    where: j.candidate_required_location ? `Remote (${j.candidate_required_location})` : 'Anywhere',
    places: j.candidate_required_location ? [j.candidate_required_location] : [],
    type: (j.job_type ?? '').replace(/_/g, ' '),
    posted: new Date(j.publication_date), text: plain(j.description), salary: j.salary || undefined,
  }));
}

async function jobicy(): Promise<Role[]> {
  type J = { id: number; url: string; jobTitle: string; companyName: string; jobGeo?: string; jobType?: string[]; pubDate: string; jobExcerpt?: string; jobDescription?: string; salaryMin?: number; salaryMax?: number; salaryCurrency?: string };
  const industries = ['design-multimedia', 'dev'];
  const urls = industries.map(i => `https://jobicy.com/api/v2/remote-jobs?count=50&industry=${i}`);
  const results = await Promise.all(urls.map(u => getJson<{ jobs?: J[] }>(u)));
  return results.flatMap(r => r?.jobs ?? []).map(j => ({
    key: `jobicy-${j.id}`, board: 'Jobicy', title: j.jobTitle, company: j.companyName, url: j.url,
    where: j.jobGeo ? `Remote (${j.jobGeo})` : 'Anywhere',
    places: j.jobGeo ? [j.jobGeo] : [],
    type: (j.jobType ?? []).join(', '), posted: new Date(j.pubDate),
    text: plain(j.jobDescription || j.jobExcerpt),
    salary: j.salaryMin && j.salaryMax ? `${j.salaryCurrency ?? ''} ${j.salaryMin.toLocaleString()}–${j.salaryMax.toLocaleString()}`.trim() : undefined,
  }));
}

// German board: "remote" there usually means remote within Germany, so it only counts when
// the listing says it is open worldwide.
async function arbeitnow(): Promise<Role[]> {
  type J = { slug: string; title: string; company_name: string; remote: boolean; url: string; location?: string; job_types?: string[]; created_at: number; description?: string };
  const r = await getJson<{ data?: J[] }>('https://www.arbeitnow.com/api/job-board-api');
  return (r?.data ?? []).map(j => {
    const city = `${j.location || 'Germany'}, Germany`;
    return {
      key: `arbeitnow-${j.slug}`, board: 'Arbeitnow', title: j.title, company: j.company_name, url: j.url,
      where: j.remote ? `Remote (${j.location || 'Germany'})` : city,
      places: j.remote && /\b(worldwide|anywhere in the world|work from anywhere)\b/i.test(j.description ?? '') ? [] : [city],
      type: (j.job_types ?? []).join(', '),
      posted: new Date(j.created_at * 1000), text: plain(j.description),
    };
  });
}

export function isNicheRole(title: string, text: string): boolean {
  return WEB_ROLE.test(title) && !NOT_A_FIT.test(title) && NICHE.test(`${title} ${text}`);
}

const openToAll = (r: Role) =>
  (!r.places.length || r.places.every(p => WORLDWIDE.test(p)))
  && (!r.zones?.length || r.zones.some(z => Math.abs(z - NIGERIA_UTC) <= 1));

// For jobs already saved: their description starts "Open to: <where>." (older ones "Based in: ...").
export function savedJobOpenToAll(l: Pick<Lead, 'description'>): boolean {
  const where = l.description.match(/^Open to: (.*?)\.\s/)?.[1];
  return !!where && WORLDWIDE.test(where.replace(/^Remote \((.*)\)$/, '$1'));
}

export async function fetchJobBoards(): Promise<Lead[]> {
  const all = (await Promise.all([himalayas(), remotive(), jobicy(), arbeitnow()])).flat();
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;
  const seen = new Set<string>();
  const roles = all.filter(r => {
    const dupe = `${r.title}|${r.company}`.toLowerCase();
    if (seen.has(dupe)) return false;
    seen.add(dupe);
    return isNicheRole(r.title, r.text) && r.posted.getTime() >= cutoff && looksEnglish(r.text);
  });
  const open = roles.filter(openToAll);

  const jobs: Lead[] = open.map(r => ({
    // Same id as when these were "remote" leads, so a role saved before is not added twice.
    id: `remote-${r.key}`.slice(0, 180),
    title: r.title,
    company: [r.company, r.type, r.salary].filter(Boolean).join(' · '),
    description: [`Open to: Anywhere.`, `Posted on ${r.board}.`, r.text.slice(0, 1100)].join(' '),
    url: r.url,
    source: 'job',
    postedAt: r.posted.toISOString(),
  }));

  console.log(`[jobs] ${all.length} listings, ${roles.length} in your niche, ${jobs.length} open to anyone anywhere`);
  return jobs;
}
