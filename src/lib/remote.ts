import type { Lead } from '@/types/lead';

// Web roles from free job boards, split two ways:
// - Remote roles: someone based in Nigeria can do them (open worldwide, or to EMEA / Europe-and-Africa
//   time zones). Markets of interest (UK, Germany, Australia) are noted on the lead.
// - Jobs: roles at employers based in the United States, Canada, Germany or Ireland, whether
//   on-site, hybrid or remote within that country.

const UA = 'Mozilla/5.0 (compatible; LeadFinder/1.0; +https://adefilasamuel.com)';
const MAX_AGE_DAYS = 14;
const WEB_ROLE = /\b(web|front[- ]?end|framer|webflow|wordpress|shopify|landing|ui|ux|product designer|web designer|digital designer)\b/i;
// Samuel's niche: the listing has to be about Framer, Webflow, no-code, landing pages or marketing
// websites. A generic React engineer or app UI designer role is not.
const NICHE = /\b(framer|webflow|no-?code|landing[- ]pages?|marketing (site|website|pages?)s?|websites? (design|redesign|build|builds|development)|web ?design(er|ers)?)\b/i;
const NOT_A_FIT = /\b(intern|internship|werkstudent|praktik|student|director|vp|head of|chief|principal|manager|linguist|translator|interpreter)\b|\(m\/w\/d\)/i;
// "South Africa" alone is not us; Africa as a whole, EMEA, Nigeria or worldwide is.
const OPEN_TO_US = /worldwide|anywhere|global|\bremote\b|emea|nigeria|(?<!south\s)\bafrica\b/i;
const MARKETS = /united kingdom|\buk\b|england|germany|deutschland|australia/i;
const NIGERIA_UTC = 1;

// Countries for the Jobs list. US state codes ("Austin, TX") are matched case-sensitively.
// Indiana's "IN" is left out: boards also use it for India ("Chennai, IN").
const US_STATE = /,\s*(A[KLRZ]|C[AOT]|D[CE]|FL|GA|HI|I[ADL]|K[SY]|LA|M[ADEINOST]|N[CDEHJMVY]|O[HKR]|PA|RI|S[CD]|T[NX]|UT|V[AT]|W[AIVY])\b/;
const COUNTRIES: [string, RegExp][] = [
  ['United States', /\b(united states|usa|u\.s\.a?\.?|us only|us-based|north america|americas)\b/i],
  ['Canada', /\b(canada|north america|americas|toronto|vancouver|montr[eé]al|ottawa|calgary|edmonton|waterloo)\b/i],
  ['Germany', /\b(germany|deutschland|berlin|m[uü]nchen|munich|hamburg|frankfurt|k[oö]ln|cologne|stuttgart|d[uü]sseldorf|leipzig)\b/i],
  ['Ireland', /(?<!northern\s)\bireland\b|\b(dublin|cork|galway|limerick)\b/i],
];

function countriesOf(where: string): string[] {
  if (/\bindia\b/i.test(where)) return [];
  const found = COUNTRIES.filter(([, re]) => re.test(where)).map(([name]) => name);
  if (US_STATE.test(where) && !found.includes('United States')) found.unshift('United States');
  return found;
}

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
  const queries = ['framer', 'webflow', 'web designer', 'landing page', 'no-code', 'marketing website'];
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
  // The open feed, plus roles limited to each country we want jobs in.
  const geos = ['', 'usa', 'canada', 'germany', 'ireland'];
  const urls = geos.flatMap(g => industries.map(i => `https://jobicy.com/api/v2/remote-jobs?count=50&industry=${i}${g ? `&geo=${g}` : ''}`));
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

// German board. Remote roles go to the remote list; office and hybrid roles are German jobs.
async function arbeitnow(): Promise<Role[]> {
  type J = { slug: string; title: string; company_name: string; remote: boolean; url: string; location?: string; job_types?: string[]; created_at: number; description?: string };
  const r = await getJson<{ data?: J[] }>('https://www.arbeitnow.com/api/job-board-api');
  return (r?.data ?? []).map(j => {
    const city = `${j.location || 'Germany'}, Germany`;
    return {
      key: `arbeitnow-${j.slug}`, board: 'Arbeitnow', title: j.title, company: j.company_name, url: j.url,
      where: j.remote ? `Remote (${j.location || 'Germany'})` : city,
      places: j.remote ? [] : [city],
      type: (j.job_types ?? []).join(', '),
      posted: new Date(j.created_at * 1000), text: plain(j.description),
    };
  });
}

// The Muse: office, hybrid and remote roles at named employers, mostly in the US.
async function theMuse(): Promise<Role[]> {
  type J = {
    id: number; name: string; contents?: string; publication_date: string; locations?: { name: string }[];
    levels?: { name: string }[]; refs?: { landing_page?: string }; company?: { name?: string };
  };
  const categories = ['Software Engineering', 'Design and UX'];
  // Cities outside the US, so those countries are not crowded out by US listings.
  const cities = ['Toronto, Canada', 'Vancouver, Canada', 'Montreal, Canada', 'Berlin, Germany', 'Munich, Germany', 'Hamburg, Germany', 'Dublin, Ireland'];
  const cityQuery = cities.map(c => `&location=${encodeURIComponent(c)}`).join('');
  const urls = categories.flatMap(c => {
    const base = `https://www.themuse.com/api/public/jobs?descending=true&category=${encodeURIComponent(c)}`;
    return [0, 1, 2].map(p => `${base}&page=${p}`).concat(`${base}${cityQuery}&page=0`);
  });
  const results = await Promise.all(urls.map(u => getJson<{ results?: J[] }>(u)));
  return results.flatMap(r => r?.results ?? []).flatMap(j => {
    // "Flexible / Remote" alone says nothing about where the employer hires.
    const places = (j.locations ?? []).map(l => l.name).filter(n => !/flexible|remote/i.test(n));
    if (!places.length || !j.refs?.landing_page) return [];
    return [{
      key: `muse-${j.id}`, board: 'The Muse', title: j.name, company: j.company?.name ?? '', url: j.refs.landing_page,
      where: places.join(' / '), places,
      type: (j.levels ?? []).map(l => l.name).join(', '),
      posted: new Date(j.publication_date), text: plain(j.contents),
    }];
  });
}

export function isNicheRole(title: string, text: string): boolean {
  return WEB_ROLE.test(title) && !NOT_A_FIT.test(title) && NICHE.test(`${title} ${text}`);
}

const openToYou = (r: Role) =>
  (!r.places.length || r.places.some(p => OPEN_TO_US.test(p)))
  && (!r.zones?.length || r.zones.some(z => Math.abs(z - NIGERIA_UTC) <= 1));

export async function fetchJobBoards(): Promise<{ remote: Lead[]; jobs: Lead[] }> {
  const all = (await Promise.all([himalayas(), remotive(), jobicy(), arbeitnow(), theMuse()])).flat();
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;
  const seen = new Set<string>();
  const roles = all.filter(r => {
    const dupe = `${r.title}|${r.company}`.toLowerCase();
    if (seen.has(dupe)) return false;
    seen.add(dupe);
    return isNicheRole(r.title, r.text) && r.posted.getTime() >= cutoff && looksEnglish(r.text);
  });

  const remote: Lead[] = [];
  const jobs: Lead[] = [];
  const perCountry = new Map<string, number>();
  for (const r of roles) {
    if (openToYou(r)) {
      const market = `${r.where} ${r.text.slice(0, 400)}`.match(MARKETS)?.[0];
      remote.push({
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
      });
      continue;
    }
    const countries = countriesOf(r.places.join(' | '));
    if (!countries.length) continue;
    for (const c of countries) perCountry.set(c, (perCountry.get(c) ?? 0) + 1);
    jobs.push({
      id: `job-${r.key}`.slice(0, 180),
      title: r.title,
      company: [r.company, countries.join(', '), r.type, r.salary].filter(Boolean).join(' · '),
      description: [
        `Based in: ${countries.join(', ')} (${r.where}).`,
        `Posted on ${r.board}.`,
        r.text.slice(0, 1100),
      ].join(' '),
      url: r.url,
      source: 'job',
      postedAt: r.posted.toISOString(),
    });
  }

  const byCountry = COUNTRIES.map(([name]) => `${name} ${perCountry.get(name) ?? 0}`).join(', ');
  console.log(`[jobs] ${all.length} listings: ${remote.length} remote roles open to you, ${jobs.length} jobs (${byCountry})`);
  return { remote, jobs };
}
