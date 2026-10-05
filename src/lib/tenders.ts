import type { Lead } from '@/types/lead';

// Public tenders: a buyer has published a website project with a deadline, so this is real demand
// and you apply rather than cold email. Germany and Austria (plus English-language Ireland) come
// from TED, the EU's official tender journal. Australia comes from AusTender, the federal portal.

const BUDGET_MS = 60_000;
const MIN_DAYS_LEFT = 4;
const MAX_AGE_DAYS = 30;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';

// Website design, web page software, internet development.
const TED_CPV = ['72413000', '72212224', '72420000'];
const TED_COUNTRIES: Record<string, string> = { DEU: 'Germany', AUT: 'Austria', IRL: 'Ireland' };
// CPV codes also catch broadband and Wi-Fi contracts. Those are not web work.
const NOT_WEB = /google ad|mediaplanung|breitband|gigabit|glasfaser|wlan|wi-?fi|isp\b|internet service provider|telekommunikation|telecommunication|broadband|fibre|fiber/i;

const AU_KEYWORDS = ['website', 'web development', 'web design', 'digital experience'];
const AU_WEB = /\b(web ?sites?|web design|web development|digital (experience|platform)|drupal|wordpress|content management|cms|landing pages?|online portal|intranet)\b/i;

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return isNaN(t) ? null : Math.floor((t - Date.now()) / 86400000);
}

function niceDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function money(value?: number, cur?: string): string | null {
  if (!value) return null;
  return `${cur ?? 'EUR'} ${Math.round(value).toLocaleString('en-GB')}`;
}

// ─── TED (EU) ────────────────────────────────────────────────────────────────

type Langs = Record<string, string | string[]>;
interface TedNotice {
  'publication-number': string;
  'publication-date'?: string;
  'notice-title'?: Langs;
  'buyer-name'?: Langs;
  'buyer-country'?: string[];
  'buyer-email'?: string[];
  'deadline-receipt-tender-date-lot'?: string[];
  'estimated-value-lot'?: number[];
  'estimated-value-cur-lot'?: string[];
  'description-lot'?: Langs;
  'official-language'?: string[];
}

function pickLang(v?: Langs): string {
  if (!v) return '';
  const raw = v.eng ?? v.deu ?? Object.values(v)[0];
  return (Array.isArray(raw) ? raw[0] : raw) ?? '';
}

// "2026-10-29+01:00" -> "2026-10-29"
const tedDate = (s?: string) => (s ? s.slice(0, 10) : null);

const LANGUAGE: Record<string, string> = { ENG: 'English', DEU: 'German', GLE: 'Irish', FRA: 'French', NLD: 'Dutch' };

async function fetchTed(): Promise<Lead[]> {
  const since = new Date(Date.now() - MAX_AGE_DAYS * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
  const query = `classification-cpv IN (${TED_CPV.join(' ')}) AND buyer-country IN (${Object.keys(TED_COUNTRIES).join(' ')}) `
    + `AND notice-type IN (cn-standard cn-social) AND publication-date >= ${since} SORT BY publication-date DESC`;
  try {
    const res = await fetch('https://api.ted.europa.eu/v3/notices/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        query,
        scope: 'ACTIVE',
        limit: 50,
        page: 1,
        fields: ['publication-number', 'publication-date', 'notice-title', 'buyer-name', 'buyer-country', 'buyer-email',
          'deadline-receipt-tender-date-lot', 'estimated-value-lot', 'estimated-value-cur-lot', 'description-lot', 'official-language'],
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) { console.log(`[tenders] TED: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`); return []; }
    const data = await res.json() as { notices?: TedNotice[] };
    const leads: Lead[] = [];
    // The same tender is often republished (corrections, translations): keep one per buyer and title.
    const seen = new Set<string>();
    for (const n of data.notices ?? []) {
      // Titles read "Germany – Website design services – <the buyer's own title>".
      const fullTitle = pickLang(n['notice-title']);
      const title = fullTitle.split(' – ').slice(2).join(' – ').trim() || fullTitle;
      const buyer = pickLang(n['buyer-name']);
      if (NOT_WEB.test(title)) continue;
      const key = `${buyer}|${title}`.toLowerCase();
      if (seen.has(key)) continue;

      const deadline = tedDate(n['deadline-receipt-tender-date-lot']?.[0]);
      const left = daysUntil(deadline);
      if (left !== null && left < MIN_DAYS_LEFT) continue;
      seen.add(key);

      const country = TED_COUNTRIES[n['buyer-country']?.[0] ?? ''] ?? 'Europe';
      const languages = (n['official-language'] ?? []).map(l => LANGUAGE[l] ?? l);
      const value = money(n['estimated-value-lot']?.[0], n['estimated-value-cur-lot']?.[0]);
      const description = pickLang(n['description-lot']);
      const email = n['buyer-email']?.[0];

      leads.push({
        id: `tender-ted-${n['publication-number']}`,
        title,
        company: [buyer, country, deadline ? `closes ${niceDate(deadline)}` : 'no deadline listed'].join(' · '),
        description: [
          `Public tender in ${country}${value ? `, estimated value ${value}` : ''}`,
          deadline ? `Bids close ${niceDate(deadline)}` : 'No bid deadline listed',
          languages.length ? `Bids in ${languages.join(' or ')}` : null,
          email ? `Buyer contact for questions: ${email}` : null,
          description && !/^(see|siehe|zie) /i.test(description) ? `Scope: ${description}` : null,
        ].filter(Boolean).join('. ').slice(0, 1200) + '.',
        url: `https://ted.europa.eu/en/notice/-/detail/${n['publication-number']}`,
        source: 'tender',
        postedAt: new Date(tedDate(n['publication-date']) ?? Date.now()).toISOString(),
      });
    }
    return leads;
  } catch (e) {
    console.error('[tenders] TED:', (e as Error).message);
    return [];
  }
}

// ─── AusTender (Australia) ───────────────────────────────────────────────────

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

// "7-Oct-2026 12:00 pm" -> ISO date
function auDate(s: string): string | null {
  const m = s.match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  return month === undefined ? null : new Date(Date.UTC(Number(m[3]), month, Number(m[1]))).toISOString().slice(0, 10);
}

const decode = (s: string) => s
  .replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function field(block: string, label: string): string {
  const re = new RegExp(`<span>${label}:?</span>\\s*<div class="list-desc-inner">([\\s\\S]*?)</div>`, 'i');
  return decode(block.match(re)?.[1] ?? '');
}

async function searchAusTender(keyword: string, retry = true): Promise<Lead[]> {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/ /g, '-');
  const url = `https://www.tenders.gov.au/Search/AtmAdvancedSearch?Keyword=${encodeURIComponent(keyword)}&KeywordTypeSearch=AllWord&CloseFrom=${today}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, cache: 'no-store', signal: AbortSignal.timeout(20000) });
    if (!res.ok) { console.log(`[tenders] AusTender "${keyword}": HTTP ${res.status}`); return []; }
    const html = await res.text();
    const leads: Lead[] = [];
    for (const block of html.split('<article').slice(1)) {
      const title = decode(block.match(/<p class="lead"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '');
      const uuid = block.match(/href="\/Atm\/Show\/([0-9a-f-]+)"/i)?.[1];
      if (!title || !uuid) continue;
      const agency = field(block, 'Agency');
      const category = field(block, 'Category');
      const description = field(block, 'Description');
      if (!AU_WEB.test(`${title} ${description}`)) continue;
      const deadline = auDate(field(block, 'Close Date &amp; Time') || field(block, 'Close Date & Time'));
      const left = daysUntil(deadline);
      if (left !== null && left < MIN_DAYS_LEFT) continue;

      leads.push({
        id: `tender-au-${uuid}`,
        title,
        company: [agency || 'Australian Government', 'Australia', deadline ? `closes ${niceDate(deadline)}` : 'no deadline listed'].join(' · '),
        description: [
          'Public tender in Australia (federal government, AusTender)',
          deadline ? `Bids close ${niceDate(deadline)}` : 'No bid deadline listed',
          category ? `Category: ${category}` : null,
          'Bids in English. You need a free AusTender account to download the documents',
          description ? `Scope: ${description}` : null,
        ].filter(Boolean).join('. ').slice(0, 1200) + '.',
        url: `https://www.tenders.gov.au/Atm/Show/${uuid}`,
        source: 'tender',
        postedAt: new Date().toISOString(),
      });
    }
    return leads;
  } catch (e) {
    if (retry) return searchAusTender(keyword, false);
    console.error(`[tenders] AusTender "${keyword}":`, (e as Error).message);
    return [];
  }
}

async function fetchAusTender(): Promise<Lead[]> {
  // One search at a time: AusTender drops connections when several arrive together.
  const byId = new Map<string, Lead>();
  for (const keyword of AU_KEYWORDS) {
    for (const l of await searchAusTender(keyword)) byId.set(l.id, l);
  }
  return [...byId.values()];
}

export async function fetchTenders(): Promise<Lead[]> {
  const timeout = new Promise<[Lead[], Lead[]]>(resolve => setTimeout(() => resolve([[], []]), BUDGET_MS));
  const [eu, au] = await Promise.race([Promise.all([fetchTed(), fetchAusTender()]), timeout]);
  console.log(`[tenders] ${eu.length} open EU website tenders (Germany, Austria, Ireland), ${au.length} Australian`);
  return [...eu, ...au];
}
