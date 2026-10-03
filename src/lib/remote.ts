import type { Lead } from '@/types/lead';

// Remote web roles from free job boards. Kept only when someone based in Nigeria can do them:
// open worldwide, or to EMEA / Europe-and-Africa time zones. Markets of interest (UK, Germany,
// Australia) are noted on the lead so you can spot them.

const UA = 'Mozilla/5.0 (compatible; LeadFinder/1.0; +https://adefilasamuel.com)';
const MAX_AGE_DAYS = 14;
const WEB_ROLE = /\b(web|front[- ]?end|framer|webflow|wordpress|shopify|landing|ui|ux|product designer|web designer|digital designer)\b/i;
const NOT_A_FIT = /\b(intern|internship|werkstudent|praktik|student|director|vp|head of|chief|principal|manager|linguist|translator|interpreter)\b|\(m\/w\/d\)/i;
// "South Africa" alone is not us; Africa as a whole, EMEA, Nigeria or worldwide is.
const OPEN_TO_US = /worldwide|anywhere|global|\bremote\b|emea|nigeria|(?<!south\s)\bafrica\b/i;
const MARKETS = /united kingdom|\buk\b|england|germany|deutschland|australia/i;
const NIGERIA_UTC = 1;

interface Role {
  key: string;
  board: string;
  title: string;
  company: string;
  url: string;
  where: string;      // what the board says about location
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
    if (!res.ok) { console.error(`[remote] ${new URL(url).host}: HTTP ${res.status}`); return null; }
    return (await res.json()) as T;
  } catch (e) {
    console.error(`[remote] ${new URL(url).host}:`, (e as Error).message);
    return null;
  }
}

async function himalayas(): Promise<Role[]> {
  type J = {
    title: string; companyName: string; excerpt?: string; description?: string; employmentType?: string;
    locationRestrictions?: string[]; timezoneRestrictions?: number[]; pubDate: number; applicationLink: string; guid: string;
    minSalary?: number | null; maxSalary?: number | null; currency?: string | null;
  };
  const queries = ['webflow', 'framer', 'web designer', 'frontend developer', 'shopify developer', 'wordpress developer', 'ui designer'];
  const results = await Promise.all(queries.map(q => getJson<{ jobs?: J[] }>(`https://himalayas.app/jobs/api/search?q=${encodeURIComponent(q)}&limit=50`)));
  const roles: Role[] = [];
  for (const j of results.flatMap(r => r?.jobs ?? [])) {
    const places = j.locationRestrictions ?? [];
    const zones = j.timezoneRestrictions ?? [];
    // Open to us when there is no place limit, or it names us, and our time zone is allowed.
    const placeOk = !places.length || places.some(p => OPEN_TO_US.test(p));
    const zoneOk = !zones.length || zones.some(z => Math.abs(z - NIGERIA_UTC) <= 1);
    if (!placeOk || !zoneOk) continue;
    roles.push({
      key: `himalayas-${j.guid}`,
      board: 'Himalayas',
      title: j.title,
      company: j.companyName,
      url: j.applicationLink || j.guid,
      where: places.length ? places.join(', ') : 'Anywhere',
      type: j.employmentType ?? '',
      posted: new Date(j.pubDate * 1000),
      text: plain(j.description || j.excerpt),
      salary: j.minSalary && j.maxSalary ? `${j.currency ?? ''} ${j.minSalary.toLocaleString()}–${j.maxSalary.toLocaleString()}`.trim() : undefined,
    });
  }
  return roles;
}

async function remotive(): Promise<Role[]> {
  type J = { id: number; url: string; title: string; company_name: string; candidate_required_location?: string; job_type?: string; publication_date: string; description?: string; salary?: string };
  const results = await Promise.all(['design', 'software-dev'].map(c => getJson<{ jobs?: J[] }>(`https://remotive.com/api/remote-jobs?category=${c}&limit=200`)));
  return results.flatMap(r => r?.jobs ?? [])
    .filter(j => !j.candidate_required_location || OPEN_TO_US.test(j.candidate_required_location))
    .map(j => ({
      key: `remotive-${j.id}`, board: 'Remotive', title: j.title, company: j.company_name, url: j.url,
      where: j.candidate_required_location || 'Anywhere', type: (j.job_type ?? '').replace(/_/g, ' '),
      posted: new Date(j.publication_date), text: plain(j.description), salary: j.salary || undefined,
    }));
}

async function jobicy(): Promise<Role[]> {
  type J = { id: number; url: string; jobTitle: string; companyName: string; jobGeo?: string; jobType?: string[]; pubDate: string; jobExcerpt?: string; jobDescription?: string; salaryMin?: number; salaryMax?: number; salaryCurrency?: string };
  const results = await Promise.all(['design-multimedia', 'dev'].map(i => getJson<{ jobs?: J[] }>(`https://jobicy.com/api/v2/remote-jobs?count=50&industry=${i}`)));
  return results.flatMap(r => r?.jobs ?? [])
    .filter(j => !j.jobGeo || OPEN_TO_US.test(j.jobGeo))
    .map(j => ({
      key: `jobicy-${j.id}`, board: 'Jobicy', title: j.jobTitle, company: j.companyName, url: j.url,
      where: j.jobGeo || 'Anywhere', type: (j.jobType ?? []).join(', '), posted: new Date(j.pubDate),
      text: plain(j.jobDescription || j.jobExcerpt),
      salary: j.salaryMin && j.salaryMax ? `${j.salaryCurrency ?? ''} ${j.salaryMin.toLocaleString()}–${j.salaryMax.toLocaleString()}`.trim() : undefined,
    }));
}

// German board. Only its remote roles, and only English listings (the language check drops the rest).
async function arbeitnow(): Promise<Role[]> {
  type J = { slug: string; title: string; company_name: string; remote: boolean; url: string; location?: string; job_types?: string[]; created_at: number; description?: string };
  const r = await getJson<{ data?: J[] }>('https://www.arbeitnow.com/api/job-board-api');
  return (r?.data ?? []).filter(j => j.remote).map(j => ({
    key: `arbeitnow-${j.slug}`, board: 'Arbeitnow', title: j.title, company: j.company_name, url: j.url,
    where: `Remote (${j.location || 'Germany'})`, type: (j.job_types ?? []).join(', '),
    posted: new Date(j.created_at * 1000), text: plain(j.description),
  }));
}

export async function fetchRemoteRoles(): Promise<Lead[]> {
  const all = (await Promise.all([himalayas(), remotive(), jobicy(), arbeitnow()])).flat();
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;
  const seen = new Set<string>();
  const roles = all.filter(r => {
    const dupe = `${r.title}|${r.company}`.toLowerCase();
    if (seen.has(dupe)) return false;
    seen.add(dupe);
    return WEB_ROLE.test(r.title) && !NOT_A_FIT.test(r.title) && r.posted.getTime() >= cutoff && looksEnglish(r.text);
  });

  const leads: Lead[] = roles.map(r => {
    const market = `${r.where} ${r.text.slice(0, 400)}`.match(MARKETS)?.[0];
    return {
      id: `remote-${r.key}`.slice(0, 180),
      title: r.title,
      company: [r.company, r.type, r.salary].filter(Boolean).join(' · '),
      description: [
        `Open to: ${r.where}.`,
        market ? `Market: ${market.replace(/^uk$/i, 'UK')}.` : '',
        `Posted on ${r.board}.`,
        r.text.slice(0, 1100),
      ].filter(Boolean).join(' '),
      url: r.url,
      source: 'remote',
      postedAt: r.posted.toISOString(),
    };
  });

  console.log(`[remote] ${all.length} listings, ${leads.length} web roles open to you (${leads.filter(l => /Market:/.test(l.description)).length} mention the UK, Germany or Australia)`);
  return leads;
}
