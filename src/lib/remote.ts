import type { Lead } from '@/types/lead';

// Jobs in your niche, two kinds only:
// - Remote, full-time, open to you: worldwide, or explicitly open to Nigeria / Africa / EMEA.
//   No contract, part-time or freelance roles, and no remote role limited to the US, UK etc.
// - Relocation: on-site or hybrid roles in English-speaking job markets (UK, Ireland, Canada,
//   Australia, Luxembourg, Netherlands, Germany and other English-friendly European countries)
//   whose listing offers visa sponsorship or relocation support.
//
// Sources: Himalayas (its own worldwide / open-to-Nigeria filters), We Work Remotely, Remotive,
// Jobicy, Arbeitnow (visa sponsorship filter), company job boards on Greenhouse, Lever and Ashby,
// and Adzuna when ADZUNA_APP_ID and ADZUNA_APP_KEY are set.

const UA = 'Mozilla/5.0 (compatible; LeadFinder/1.0; +https://adefilasamuel.com)';
const MAX_AGE_DAYS = 21;
const WEB_ROLE = /\b(web|front[- ]?end|framer|webflow|wordpress|shopify|landing|ui|ux|product designer|product design|product engineer|web designer|digital designer)\b/i;
// Samuel's niche: Framer, Webflow, no-code, landing pages, marketing websites, product design,
// UI/UX design and product engineering. A generic backend or React engineer role is not.
const NICHE = /\b(framer|webflow|no-?code|landing[- ]pages?|marketing (site|website|pages?)s?|websites? (design|redesign|build|builds|development)|web ?design(er|ers)?|product design(er|ers)?|product engineer(s|ing)?|ui ?\/ ?ux|ux ?\/ ?ui|ui designer|ux designer|ui and ux|ux and ui|user experience|user interface)\b/i;
const NOT_A_FIT = /\b(intern|internship|werkstudent|praktik|student|director|vp|head of|chief|principal|manager|linguist|translator|interpreter)\b|\(m\/w\/d\)/i;
const NOT_FULL_TIME = /\b(contract|contractor|part[- ]?time|freelance|temporary|temp|internship|fixed[- ]term)\b/i;

// Remote roles: a limit that still includes someone living in Nigeria.
const OPEN_TO_YOU = /\b(worldwide|anywhere|global|everywhere|all countries|nigeria|emea|(?<!south\s)africa)\b/i;
const NIGERIA_UTC = 1;
// Some "worldwide" listings say otherwise in the text ("US only", "must be based in Canada").
const PLACE = '(the )?(us|usa|u\\.s\\.?|united states|america|canada|uk|united kingdom|europe|eu|european union|latam|latin america|apac|india|philippines|australia)';
const TEXT_LIMIT = new RegExp(`\\b(${PLACE}[- ](only|residents?|citizens?)|(must|should|need to) (be )?(based|located|living|residing|reside|live) in ${PLACE}|(only|exclusively) (open to|hiring|accepting) (candidates |applicants |people )?(in|from) ${PLACE}|(legally )?authori[sz]ed to work in ${PLACE})\\b`, 'i');

// Relocation roles: the listing has to offer it, and must not rule it out.
const RELOCATION = /\b(relocation (support|assistance|package|bonus|budget|allowance|help)|relocation is (available|offered|provided|supported)|(we|will|can|happy to|able to) (sponsor|support) (your |a |the )?(work )?visas?|visa sponsorship (is |are )?(available|offered|provided|possible)|(offer|offers|provide|provides|including) (visa sponsorship|relocation)|sponsorship (and|&) relocation|relocation (and|&) visa|help (you )?(to )?relocate)\b/i;
const NO_RELOCATION = /\b(no (visa )?sponsorship|(not|unable|cannot|can't|can not) (be )?(able |in a position )?(to )?(offer|provide|support|sponsor)( (a |any ))?( work)?( visa)?( sponsorships?)?|does not (offer|provide) (visa )?sponsorship|(do|does|will) not (offer |provide )?(visa )?sponsor(ship)?|no relocation|without (visa )?sponsorship|must (already )?(have|hold) (the )?(full )?right to work|existing right to work|already (have|hold) (the )?right to work)\b/i;

// English-speaking job markets where a non-EU designer or engineer can be sponsored.
const MARKETS: [string, RegExp][] = [
  ['United Kingdom', /\b(united kingdom|uk|england|scotland|wales|london|manchester|edinburgh|bristol|leeds|birmingham|cambridge|oxford|glasgow)\b/i],
  ['Ireland', /(?<!northern\s)\bireland\b|\b(dublin|cork|galway|limerick)\b/i],
  ['Canada', /\b(canada|toronto|vancouver|montr[eé]al|ottawa|calgary|waterloo)\b/i],
  ['Australia', /\b(australia|sydney|melbourne|brisbane|perth|adelaide|canberra)\b/i],
  ['Luxembourg', /\bluxembourg\b/i],
  ['Netherlands', /\b(netherlands|holland|amsterdam|rotterdam|utrecht|eindhoven|the hague)\b/i],
  ['Germany', /\b(germany|deutschland|berlin|munich|m[uü]nchen|hamburg|frankfurt|cologne|k[oö]ln|stuttgart|d[uü]sseldorf)\b/i],
  ['Belgium', /\b(belgium|brussels|antwerp)\b/i],
  ['Denmark', /\b(denmark|copenhagen)\b/i],
  ['Sweden', /\b(sweden|stockholm|gothenburg)\b/i],
  ['Finland', /\b(finland|helsinki)\b/i],
  ['Estonia', /\b(estonia|tallinn)\b/i],
  ['Portugal', /\b(portugal|lisbon|porto)\b/i],
  ['Spain', /\b(spain|madrid|barcelona|valencia)\b/i],
  ['Austria', /\b(austria|vienna)\b/i],
  ['Switzerland', /\b(switzerland|zurich|z[uü]rich|geneva|basel)\b/i],
  ['Poland', /\b(poland|warsaw|krak[oó]w)\b/i],
  ['Czechia', /\b(czechia|czech republic|prague)\b/i],
  ['Malta', /\bmalta\b/i],
  ['Cyprus', /\b(cyprus|limassol|nicosia)\b/i],
];

// Company job boards to watch for relocation roles. Wrong names just return nothing.
// Add more with JOB_COMPANIES="greenhouse:acme,lever:foo,ashby:bar".
const COMPANIES = [
  'greenhouse:intercom', 'greenhouse:stripe', 'greenhouse:figma', 'greenhouse:datadog', 'greenhouse:elastic',
  'greenhouse:contentful', 'greenhouse:miro', 'greenhouse:adyen', 'greenhouse:n26', 'greenhouse:gitlab',
  'greenhouse:cloudflare', 'greenhouse:mongodb', 'greenhouse:webflow', 'greenhouse:dropbox', 'greenhouse:airbnb',
  'greenhouse:monzo', 'greenhouse:deliveroo', 'greenhouse:hellofresh', 'greenhouse:mollie', 'greenhouse:messagebird',
  'lever:spotify', 'lever:canva', 'lever:wolt',
  'ashby:linear', 'ashby:notion', 'ashby:vercel', 'ashby:ramp', 'ashby:framer',
];

interface Role {
  key: string;
  board: string;
  title: string;
  company: string;
  url: string;
  where: string;        // what the board says about location
  places: string[];     // remote location limits; empty means anywhere
  zones?: number[];     // UTC offsets allowed, when the board lists them
  remote: boolean;      // false: on-site or hybrid
  type: string;         // full time, contract, ...
  posted: Date;
  text: string;         // plain-text description
  salary?: string;
  sponsored?: boolean;  // the board itself says it offers visa sponsorship
  openToYou?: boolean;  // decided from the board's own location data
}

const plain = (html = '') => html
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<\/(p|li|h\d|div)>/gi, '. ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ').replace(/(\.\s*){2,}/g, '. ').trim();

// Many listings are in Spanish or German. Keep the ones written in English.
const looksEnglish = (t: string) => (t.slice(0, 600).match(/\b(the|and|you|with|our|we|will|for|your)\b/gi)?.length ?? 0) >= 4;

// Boards send locations as strings or as objects ({ name }, { country }); read either.
function placeName(p: unknown): string {
  if (typeof p === 'string') return p;
  if (p && typeof p === 'object') {
    const o = p as Record<string, unknown>;
    return String(o.name ?? o.country ?? o.alpha2 ?? '');
  }
  return '';
}

async function get(url: string, accept = 'application/json'): Promise<Response | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) { if (res.status !== 404) console.error(`[jobs] ${new URL(url).host}: HTTP ${res.status}`); return null; }
    return res;
  } catch (e) {
    console.error(`[jobs] ${new URL(url).host}:`, (e as Error).message);
    return null;
  }
}

async function getJson<T>(url: string): Promise<T | null> {
  const res = await get(url);
  return res ? (res.json() as Promise<T>).catch(() => null) : null;
}

const money = (min?: number | null, max?: number | null, cur?: string | null) =>
  min && max ? `${cur ?? ''} ${min.toLocaleString()}–${max.toLocaleString()}`.trim() : undefined;

// ─── Remote boards ───────────────────────────────────────────────────────────

// Himalayas caps results at 20 a request. Ask its own filters for worldwide roles and for roles
// open to people in Nigeria, two pages each.
async function himalayas(): Promise<Role[]> {
  type J = {
    title: string; companyName: string; excerpt?: string; description?: string; employmentType?: string;
    locationRestrictions?: unknown[]; timezoneRestrictions?: number[]; pubDate: number; applicationLink: string; guid: string;
    minSalary?: number | null; maxSalary?: number | null; currency?: string | null;
  };
  const queries = ['framer', 'webflow', 'web designer', 'landing page', 'product designer', 'ui ux designer', 'product engineer'];
  const filters = ['worldwide=true', 'country=NG'];
  const urls = queries.flatMap(q => filters.flatMap(f => [1, 2].map(p => `https://himalayas.app/jobs/api/search?q=${encodeURIComponent(q)}&${f}&page=${p}`)));
  const results = await Promise.all(urls.map(u => getJson<{ jobs?: J[] }>(u)));
  return results.flatMap(r => r?.jobs ?? []).map(j => {
    const places = (j.locationRestrictions ?? []).map(placeName).filter(Boolean);
    return {
      key: `himalayas-${j.guid}`,
      board: 'Himalayas',
      title: j.title,
      company: j.companyName,
      url: j.applicationLink || j.guid,
      where: places.length ? places.join(', ') : 'Anywhere',
      places,
      zones: j.timezoneRestrictions ?? [],
      remote: true,
      type: j.employmentType ?? '',
      posted: new Date(j.pubDate * 1000),
      text: plain(j.description || j.excerpt),
      salary: money(j.minSalary, j.maxSalary, j.currency),
      // Found through the worldwide / Nigeria filter, but a listed limit still has to include you.
      openToYou: !places.length || places.some(p => OPEN_TO_YOU.test(p)),
    };
  });
}

// We Work Remotely's public RSS feeds (design, front-end). Each item has a region.
async function weWorkRemotely(): Promise<Role[]> {
  const feeds = ['remote-design-jobs', 'remote-front-end-programming-jobs'];
  const texts = await Promise.all(feeds.map(async f => {
    const res = await get(`https://weworkremotely.com/categories/${f}.rss`, 'application/rss+xml');
    return res ? res.text().catch(() => '') : '';
  }));
  const tag = (item: string, name: string) => plain(item.match(new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`))?.[1] ?? '');
  return texts.flatMap(xml => [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => {
    const item = m[1];
    const [company, ...rest] = tag(item, 'title').split(': ');
    const region = tag(item, 'region') || 'Anywhere in the World';
    const link = tag(item, 'link') || tag(item, 'guid');
    return {
      key: `wwr-${link.split('/').pop() ?? link}`,
      board: 'We Work Remotely',
      title: rest.join(': ') || company,
      company: rest.length ? company : '',
      url: link,
      where: region,
      places: /anywhere/i.test(region) ? [] : [region],
      remote: true,
      type: tag(item, 'type'),
      posted: new Date(tag(item, 'pubDate') || Date.now()),
      text: tag(item, 'description'),
    };
  }));
}

async function remotive(): Promise<Role[]> {
  type J = { id: number; url: string; title: string; company_name: string; candidate_required_location?: string; job_type?: string; publication_date: string; description?: string; salary?: string };
  const results = await Promise.all(['design', 'software-dev'].map(c => getJson<{ jobs?: J[] }>(`https://remotive.com/api/remote-jobs?category=${c}&limit=200`)));
  return results.flatMap(r => r?.jobs ?? []).map(j => ({
    key: `remotive-${j.id}`, board: 'Remotive', title: j.title, company: j.company_name, url: j.url,
    where: j.candidate_required_location || 'Anywhere',
    places: j.candidate_required_location ? [j.candidate_required_location] : [],
    remote: true,
    type: (j.job_type ?? '').replace(/_/g, ' '),
    posted: new Date(j.publication_date), text: plain(j.description), salary: j.salary || undefined,
  }));
}

async function jobicy(): Promise<Role[]> {
  type J = { id: number; url: string; jobTitle: string; companyName: string; jobGeo?: string; jobType?: string[]; pubDate: string; jobExcerpt?: string; jobDescription?: string; salaryMin?: number; salaryMax?: number; salaryCurrency?: string };
  const results = await Promise.all(['design-multimedia', 'dev'].map(i => getJson<{ jobs?: J[] }>(`https://jobicy.com/api/v2/remote-jobs?count=50&industry=${i}`)));
  return results.flatMap(r => r?.jobs ?? []).map(j => ({
    key: `jobicy-${j.id}`, board: 'Jobicy', title: j.jobTitle, company: j.companyName, url: j.url,
    where: j.jobGeo || 'Anywhere',
    places: j.jobGeo ? [j.jobGeo] : [],
    remote: true,
    type: (j.jobType ?? []).join(', '), posted: new Date(j.pubDate),
    text: plain(j.jobDescription || j.jobExcerpt),
    salary: money(j.salaryMin, j.salaryMax, j.salaryCurrency),
  }));
}

// ─── Relocation sources ──────────────────────────────────────────────────────

// Arbeitnow's own visa sponsorship filter (Germany and other European countries).
async function arbeitnow(): Promise<Role[]> {
  type J = { slug: string; title: string; company_name: string; remote: boolean; url: string; location?: string; job_types?: string[]; created_at: number; description?: string };
  const pages = await Promise.all([1, 2, 3].map(p => getJson<{ data?: J[] }>(`https://www.arbeitnow.com/api/job-board-api?visa_sponsorship=true&page=${p}`)));
  return pages.flatMap(r => r?.data ?? []).map(j => {
    const location = j.location || 'Germany';
    const text = plain(j.description);
    const worldwide = j.remote && /\b(worldwide|anywhere in the world|work from anywhere)\b/i.test(text);
    return {
      key: `arbeitnow-${j.slug}`, board: 'Arbeitnow', title: j.title, company: j.company_name, url: j.url,
      where: MARKETS.some(([, re]) => re.test(location)) ? location : `${location}, Germany`,
      places: worldwide ? [] : [location],
      remote: worldwide,
      type: (j.job_types ?? []).join(', '),
      posted: new Date(j.created_at * 1000), text,
      sponsored: true,
    };
  });
}

interface BoardJob { key: string; board: string; title: string; company: string; url: string; location: string; type: string; posted: string; text: string }

// Company job boards: Greenhouse, Lever and Ashby all publish free, official JSON feeds.
async function companyBoard(entry: string): Promise<BoardJob[]> {
  const [ats, name] = entry.split(':');
  if (ats === 'greenhouse') {
    type J = { id: number; title: string; absolute_url: string; updated_at: string; location?: { name?: string }; content?: string };
    const r = await getJson<{ jobs?: J[] }>(`https://boards-api.greenhouse.io/v1/boards/${name}/jobs?content=true`);
    return (r?.jobs ?? []).map(j => ({ key: `gh-${name}-${j.id}`, board: 'Greenhouse', title: j.title, company: name, url: j.absolute_url, location: j.location?.name ?? '', type: '', posted: j.updated_at, text: plain(j.content) }));
  }
  if (ats === 'lever') {
    type J = { id: string; text: string; hostedUrl: string; createdAt: number; categories?: { location?: string; commitment?: string }; workplaceType?: string; descriptionPlain?: string; additionalPlain?: string };
    const r = await getJson<J[]>(`https://api.lever.co/v0/postings/${name}?mode=json`);
    return (r ?? []).map(j => ({ key: `lever-${name}-${j.id}`, board: 'Lever', title: j.text, company: name, url: j.hostedUrl, location: `${j.categories?.location ?? ''}${j.workplaceType === 'remote' ? ' (Remote)' : ''}`, type: j.categories?.commitment ?? '', posted: new Date(j.createdAt).toISOString(), text: `${j.descriptionPlain ?? ''} ${j.additionalPlain ?? ''}` }));
  }
  if (ats === 'ashby') {
    type J = { id?: string; title: string; jobUrl: string; publishedAt?: string; location?: string; isRemote?: boolean; employmentType?: string; descriptionPlain?: string };
    const r = await getJson<{ jobs?: J[] }>(`https://api.ashbyhq.com/posting-api/job-board/${name}`);
    return (r?.jobs ?? []).map(j => ({ key: `ashby-${name}-${j.id ?? j.jobUrl.split('/').pop()}`, board: 'Ashby', title: j.title, company: name, url: j.jobUrl, location: `${j.location ?? ''}${j.isRemote ? ' (Remote)' : ''}`, type: j.employmentType ?? '', posted: j.publishedAt ?? new Date().toISOString(), text: plain(j.descriptionPlain) }));
  }
  return [];
}

async function companyBoards(): Promise<Role[]> {
  const list = [...COMPANIES, ...(process.env.JOB_COMPANIES ?? '').split(',').map(s => s.trim()).filter(s => s.includes(':'))];
  const results = await Promise.all([...new Set(list)].map(companyBoard));
  return results.flat().map(j => {
    const remote = /\bremote\b/i.test(j.location) && !/hybrid/i.test(j.location);
    const where = j.location.replace(/\(remote\)/i, '').trim();
    return {
      key: j.key, board: j.board, title: j.title,
      company: j.company.charAt(0).toUpperCase() + j.company.slice(1),
      url: j.url, where: j.location,
      // A remote role here counts as open to you only when its location says so.
      places: remote ? [where || 'Remote'] : [j.location],
      remote, type: j.type, posted: new Date(j.posted), text: j.text,
    };
  });
}

// Adzuna (UK, Canada, Australia, Netherlands, Germany, Belgium, Austria), only with a free key.
async function adzuna(): Promise<Role[]> {
  const id = process.env.ADZUNA_APP_ID, key = process.env.ADZUNA_APP_KEY;
  if (!id || !key) return [];
  type J = { id: string; title: string; redirect_url: string; created: string; description?: string; contract_time?: string; company?: { display_name?: string }; location?: { display_name?: string }; salary_min?: number; salary_max?: number };
  const countries: [string, string, string][] = [['gb', 'United Kingdom', 'GBP'], ['ca', 'Canada', 'CAD'], ['au', 'Australia', 'AUD'], ['nl', 'Netherlands', 'EUR'], ['de', 'Germany', 'EUR'], ['be', 'Belgium', 'EUR'], ['at', 'Austria', 'EUR']];
  const what = encodeURIComponent('designer developer framer webflow ux ui product');
  const results = await Promise.all(countries.map(async ([cc, country, cur]) => {
    const r = await getJson<{ results?: J[] }>(`https://api.adzuna.com/v1/api/jobs/${cc}/search/1?app_id=${id}&app_key=${key}&results_per_page=50&max_days_old=${MAX_AGE_DAYS}&what_phrase=${encodeURIComponent('visa sponsorship')}&what_or=${what}&content-type=application/json`);
    return (r?.results ?? []).map(j => ({
      key: `adzuna-${cc}-${j.id}`, board: 'Adzuna', title: plain(j.title), company: j.company?.display_name ?? '', url: j.redirect_url,
      where: `${j.location?.display_name ?? ''}, ${country}`, places: [country], remote: false,
      type: (j.contract_time ?? '').replace(/_/g, ' '), posted: new Date(j.created), text: plain(j.description),
      salary: money(j.salary_min, j.salary_max, cur), sponsored: true,
    }));
  }));
  return results.flat();
}

// ─── Sorting the roles ───────────────────────────────────────────────────────

export function isNicheRole(title: string, text: string): boolean {
  return WEB_ROLE.test(title) && !NOT_A_FIT.test(title) && NICHE.test(`${title} ${text}`);
}

const fullTime = (r: Pick<Role, 'type' | 'title'>) => !NOT_FULL_TIME.test(`${r.type} ${r.title}`);

function remoteOpenToYou(r: Role): boolean {
  if (!r.remote) return false;
  if (TEXT_LIMIT.test(r.text)) return false;
  const placesOk = r.openToYou ?? (!r.places.length || r.places.some(p => OPEN_TO_YOU.test(p)));
  const zonesOk = !r.zones?.length || r.zones.some(z => Math.abs(z - NIGERIA_UTC) <= 1);
  return placesOk && zonesOk;
}

function relocationMarket(r: Role): string | null {
  if (r.remote) return null;
  const market = MARKETS.find(([, re]) => re.test(r.where))?.[0];
  if (!market) return null;
  const offers = r.sponsored || RELOCATION.test(r.text);
  return offers && !NO_RELOCATION.test(r.text) ? market : null;
}

// For jobs already saved: remote ones start "Open to: <where>.", relocation ones "Relocation: ...".
export function savedJobStillWanted(l: Pick<Lead, 'description' | 'company'>): boolean {
  if (NOT_FULL_TIME.test(l.company)) return false;
  if (/^Relocation: /.test(l.description)) return !NO_RELOCATION.test(l.description);
  const where = l.description.match(/^Open to: (.*?)\.\s/)?.[1];
  return !!where && OPEN_TO_YOU.test(where) && !TEXT_LIMIT.test(l.description);
}

export async function fetchJobBoards(): Promise<Lead[]> {
  const names = ['Himalayas', 'WWR', 'Remotive', 'Jobicy', 'Arbeitnow', 'Company boards', 'Adzuna'];
  const sources = await Promise.all([himalayas(), weWorkRemotely(), remotive(), jobicy(), arbeitnow(), companyBoards(), adzuna()]);
  const all = sources.flat();
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;
  const seen = new Set<string>();
  const roles = all.filter(r => {
    const dupe = `${r.title}|${r.company}`.toLowerCase();
    if (seen.has(dupe)) return false;
    seen.add(dupe);
    return isNicheRole(r.title, r.text) && fullTime(r) && !isNaN(r.posted.getTime()) && r.posted.getTime() >= cutoff && looksEnglish(r.text);
  });

  const jobs: Lead[] = [];
  let remoteCount = 0;
  const perMarket = new Map<string, number>();
  for (const r of roles) {
    if (remoteOpenToYou(r)) {
      remoteCount++;
      jobs.push({
        // Same id as when these were "remote" leads, so a role saved before is not added twice.
        id: `remote-${r.key}`.slice(0, 180),
        title: r.title,
        company: [r.company, r.type, r.salary].filter(Boolean).join(' · '),
        description: [`Open to: ${r.places.length ? r.where : 'Anywhere'}.`, `Posted on ${r.board}.`, r.text.slice(0, 1100)].join(' '),
        url: r.url,
        source: 'job',
        postedAt: r.posted.toISOString(),
      });
      continue;
    }
    const market = relocationMarket(r);
    if (!market) continue;
    perMarket.set(market, (perMarket.get(market) ?? 0) + 1);
    jobs.push({
      id: `reloc-${r.key}`.slice(0, 180),
      title: r.title,
      company: [r.company, market, r.type, r.salary].filter(Boolean).join(' · '),
      description: [`Relocation: ${market} (${r.where}).`, 'The listing offers visa sponsorship or relocation support.', `Posted on ${r.board}.`, r.text.slice(0, 1100)].join(' '),
      url: r.url,
      source: 'job',
      postedAt: r.posted.toISOString(),
    });
  }

  const counts = sources.map((s, i) => `${names[i]} ${s.length}`).join(', ');
  const markets = [...perMarket].map(([m, n]) => `${m} ${n}`).join(', ') || 'none';
  console.log(`[jobs] ${all.length} listings (${counts}); ${roles.length} full-time in your niche; ${remoteCount} remote open to you; relocation: ${markets}`);
  return jobs;
}
