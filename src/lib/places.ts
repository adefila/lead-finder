import type { Lead } from '@/types/lead';
import { analyzeWebsite, platformOf } from '@/lib/enrich';
import { emailDomainAccepts } from '@/lib/verify';
import { getSentIds, getExistingLeadIds } from '@/lib/supabase';
import { languageOfPlace, type LeadLang } from '@/lib/leadview';

// B2B companies: founders and owners of businesses that sell to other businesses. Their sites are the ones
// worth rebuilding around what they sell. (Local clinics, salons and trades are no longer searched.)
const DEFAULT_CATEGORIES = [
  // construction and the built world (the main focus)
  'construction company', 'building contractor', 'commercial construction company', 'civil engineering contractor', 'groundworks contractor',
  'scaffolding company', 'commercial roofing contractor', 'steel fabrication company', 'electrical contractor', 'mechanical and electrical contractor',
  'HVAC contractor', 'fit-out contractor', 'demolition contractor', 'plant hire company', 'building materials supplier',
  'quantity surveying firm', 'project management consultancy', 'architecture firm', 'civil engineering consultancy', 'structural engineering firm',
  'engineering firm', 'commercial solar installer', 'facilities management company', 'property management company', 'commercial real estate firm',
  // industry and logistics
  'manufacturing company', 'industrial equipment supplier', 'wholesale distributor', 'logistics company', 'freight forwarder', 'packaging company',
  'security services company', 'commercial cleaning company', 'environmental consultancy', 'energy consultancy',
  // professional services
  'management consultancy', 'recruitment agency', 'training company', 'accounting firm', 'law firm',
];
const B2B_CATEGORIES = new Set(DEFAULT_CATEGORIES);

// Markets. Each run picks a market first and then a city inside it, so every country gets its share and the English-speaking
// cities (which are the most numerous) do not crowd out the rest. Outside English, the search is written in the local language
// (see LOCAL_TERMS) and the email is written in that language too (leadLanguage).
//
// `on` markets are searched by default: the countries where a short, relevant email to a business address published on its own
// website with an opt-out line is generally allowed. The rest are off by default because the law there asks for consent first,
// even for companies (Germany, Austria, Spain, Portugal, Italy, parts of Latin America): turn them on with PLACES_MARKETS (for
// example "de|es", or "all") only after checking the rules for that country. Canada is left out on purpose (strict cold-email law).
// This is not legal advice.
// Only European countries are on (UK, Ireland, Netherlands, France, Norway). The others are kept but off; turn one on with PLACES_MARKETS.
interface Market { country: string; cities: string[]; on: boolean }
const MARKETS: Market[] = [
  { country: 'United Kingdom', on: true, cities: ['London, UK', 'Manchester, UK', 'Birmingham, UK', 'Leeds, UK', 'Edinburgh, UK', 'Bristol, UK', 'Glasgow, UK', 'Liverpool, UK', 'Cardiff, UK'] },
  { country: 'Ireland', on: true, cities: ['Dublin, Ireland', 'Cork, Ireland'] },
  { country: 'Australia', on: false, cities: ['Sydney, Australia', 'Melbourne, Australia', 'Brisbane, Australia', 'Perth, Australia', 'Adelaide, Australia'] },
  { country: 'New Zealand', on: false, cities: ['Auckland, New Zealand', 'Wellington, New Zealand'] },
  { country: 'Singapore', on: false, cities: ['Singapore'] },
  { country: 'United States', on: false, cities: ['Austin, TX', 'Denver, CO', 'Atlanta, GA', 'Chicago, IL', 'Boston, MA', 'Seattle, WA', 'Miami, FL', 'Nashville, TN', 'New York, NY', 'San Francisco, CA', 'Dallas, TX', 'Raleigh, NC', 'Minneapolis, MN', 'Phoenix, AZ'] },
  { country: 'United Arab Emirates', on: false, cities: ['Dubai, UAE', 'Abu Dhabi, UAE'] },
  { country: 'South Africa', on: false, cities: ['Johannesburg, South Africa', 'Cape Town, South Africa'] },
  { country: 'Nigeria', on: false, cities: ['Lagos, Nigeria', 'Abuja, Nigeria'] },
  { country: 'Kenya', on: false, cities: ['Nairobi, Kenya'] },
  { country: 'Ghana', on: false, cities: ['Accra, Ghana'] },
  { country: 'Malaysia', on: false, cities: ['Kuala Lumpur, Malaysia'] },
  // Written in the local language
  { country: 'Netherlands', on: true, cities: ['Amsterdam, Netherlands', 'Rotterdam, Netherlands', 'Utrecht, Netherlands', 'The Hague, Netherlands', 'Eindhoven, Netherlands'] },
  { country: 'France', on: true, cities: ['Paris, France', 'Lyon, France', 'Marseille, France', 'Toulouse, France', 'Nantes, France', 'Bordeaux, France', 'Lille, France'] },
  { country: 'Norway', on: true, cities: ['Oslo, Norway', 'Bergen, Norway', 'Trondheim, Norway', 'Stavanger, Norway'] },
  // Off by default: consent rules. Enable one at a time with PLACES_MARKETS.
  { country: 'Germany', on: false, cities: ['Berlin, Germany', 'Munich, Germany', 'Hamburg, Germany', 'Frankfurt, Germany', 'Cologne, Germany', 'Stuttgart, Germany'] },
  { country: 'Austria', on: false, cities: ['Vienna, Austria', 'Graz, Austria', 'Salzburg, Austria'] },
  { country: 'Spain', on: false, cities: ['Madrid, Spain', 'Barcelona, Spain', 'Valencia, Spain', 'Seville, Spain', 'Bilbao, Spain'] },
  { country: 'Portugal', on: false, cities: ['Lisbon, Portugal', 'Porto, Portugal'] },
  { country: 'Italy', on: false, cities: ['Milan, Italy', 'Rome, Italy', 'Turin, Italy', 'Bologna, Italy'] },
  { country: 'Mexico', on: false, cities: ['Mexico City, Mexico', 'Guadalajara, Mexico', 'Monterrey, Mexico'] },
  { country: 'Brazil', on: false, cities: ['São Paulo, Brazil', 'Rio de Janeiro, Brazil'] },
];

function activeMarkets(): Market[] {
  const want = (process.env.PLACES_MARKETS ?? '').toLowerCase().split(/[|,]/).map(x => x.trim()).filter(Boolean);
  const all = want.includes('all');
  return MARKETS.filter(m => m.on || all || want.includes(m.country.toLowerCase()) || want.includes(m.country.slice(0, 2).toLowerCase()));
}
const DEFAULT_CITIES = MARKETS.filter(m => m.on).flatMap(m => m.cities);

// What a business owner in that country would type to find these companies. Categories without an entry are searched in English,
// which Google also understands; the lead keeps the English category either way.
const LOCAL_TERMS: Partial<Record<LeadLang, Record<string, string>>> = {
  nl: {
    'software company': 'softwarebedrijf', 'SaaS company': 'SaaS-bedrijf', 'IT services company': 'IT-dienstverlener',
    'cybersecurity company': 'cybersecuritybedrijf', 'digital marketing agency': 'online marketingbureau', 'management consultancy': 'adviesbureau',
    'recruitment agency': 'recruitmentbureau', 'HR consultancy': 'HR-adviesbureau', 'fintech company': 'fintechbedrijf', 'logistics company': 'logistiek bedrijf',
    'engineering firm': 'ingenieursbureau', 'training company': 'opleidingsbedrijf', 'business services company': 'zakelijke dienstverlener',
    'PR agency': 'PR-bureau', 'accounting firm': 'accountantskantoor', 'law firm': 'advocatenkantoor', 'architecture firm': 'architectenbureau',
    'construction company': 'bouwbedrijf', 'insurance broker': 'verzekeringsadviseur', 'staffing agency': 'uitzendbureau',
  },
  fr: {
    'software company': 'éditeur de logiciels', 'SaaS company': 'éditeur SaaS', 'IT services company': 'société de services informatiques',
    'managed IT provider': 'infogérance informatique', 'cybersecurity company': 'société de cybersécurité', 'digital marketing agency': 'agence de marketing digital',
    'management consultancy': 'cabinet de conseil en management', 'recruitment agency': 'cabinet de recrutement', 'HR consultancy': 'cabinet de conseil RH',
    'fintech company': 'entreprise fintech', 'logistics company': 'entreprise de logistique', 'engineering firm': "bureau d'études ingénierie",
    'training company': 'organisme de formation', 'business services company': 'société de services aux entreprises', 'PR agency': 'agence de relations publiques',
    'accounting firm': "cabinet d'expertise comptable", 'law firm': "cabinet d'avocats", 'architecture firm': "cabinet d'architecture",
    'construction company': 'entreprise de construction', 'insurance broker': "courtier en assurances", 'staffing agency': "agence d'intérim",
  },
  no: {
    'software company': 'programvareselskap', 'SaaS company': 'SaaS-selskap', 'IT services company': 'IT-selskap', 'cybersecurity company': 'cybersikkerhetsselskap',
    'digital marketing agency': 'digitalbyrå', 'management consultancy': 'rådgivningsselskap', 'recruitment agency': 'rekrutteringsbyrå', 'HR consultancy': 'HR-rådgivning',
    'fintech company': 'fintech-selskap', 'logistics company': 'logistikkselskap', 'engineering firm': 'ingeniørfirma', 'training company': 'kursleverandør',
    'PR agency': 'PR-byrå', 'accounting firm': 'regnskapsfirma', 'law firm': 'advokatfirma', 'architecture firm': 'arkitektkontor',
    'construction company': 'entreprenør', 'staffing agency': 'bemanningsbyrå',
  },
  de: {
    'software company': 'Softwareunternehmen', 'SaaS company': 'SaaS-Unternehmen', 'IT services company': 'IT-Dienstleister', 'cybersecurity company': 'Cybersecurity-Unternehmen',
    'digital marketing agency': 'Digitalagentur', 'management consultancy': 'Unternehmensberatung', 'recruitment agency': 'Personalberatung', 'accounting firm': 'Steuerberater',
    'law firm': 'Anwaltskanzlei', 'engineering firm': 'Ingenieurbüro', 'logistics company': 'Logistikunternehmen', 'training company': 'Weiterbildungsanbieter',
  },
  es: {
    'software company': 'empresa de software', 'SaaS company': 'empresa SaaS', 'IT services company': 'empresa de servicios informáticos', 'cybersecurity company': 'empresa de ciberseguridad',
    'digital marketing agency': 'agencia de marketing digital', 'management consultancy': 'consultora de gestión', 'recruitment agency': 'empresa de selección de personal',
    'accounting firm': 'asesoría contable', 'law firm': 'despacho de abogados', 'engineering firm': 'empresa de ingeniería', 'logistics company': 'empresa de logística',
  },
  pt: {
    'software company': 'empresa de software', 'SaaS company': 'empresa SaaS', 'IT services company': 'empresa de serviços de TI', 'digital marketing agency': 'agência de marketing digital',
    'management consultancy': 'consultoria de gestão', 'accounting firm': 'escritório de contabilidade', 'law firm': 'escritório de advocacia', 'logistics company': 'empresa de logística',
  },
  it: {
    'software company': 'azienda di software', 'SaaS company': 'azienda SaaS', 'IT services company': 'azienda di servizi informatici', 'digital marketing agency': 'agenzia di marketing digitale',
    'management consultancy': 'società di consulenza', 'accounting firm': 'studio commercialista', 'law firm': 'studio legale', 'logistics company': 'azienda di logistica',
  },
};
const searchText = (category: string, city: string) => {
  const lang = languageOfPlace(city);
  const term = lang === 'en' ? category : (LOCAL_TERMS[lang]?.[category] ?? category);
  return `${term} in ${city}`;
};

// Each page of results is one billed Text Search (Enterprise) call. 8 searches x 2 pages x 2 runs a day
// is about 960 calls a month, which should stay inside Google's free monthly allowance for that SKU
// (about 1,000). Raise PLACES_SEARCHES_PER_RUN or PLACES_PAGES in Vercel for more leads at a cost, or
// lower them to spend less.
const SEARCHES_PER_RUN = Math.max(1, Number(process.env.PLACES_SEARCHES_PER_RUN) || 8);
// Google returns 20 results per page; the second page reaches businesses the first never shows.
const PAGES_PER_SEARCH = Math.min(3, Math.max(1, Number(process.env.PLACES_PAGES) || 2));
// Only keep businesses we can actually email: an address published on their own website.
const REQUIRE_EMAIL = true;
// Checking websites is slow; stop starting new ones after this so the twice-daily run finishes.
const BUDGET_MS = 110_000;
// Small businesses with a dated website are exactly who you pitch, and many have only a handful of reviews.
const MIN_REVIEWS = 5;
// A business is only a lead if customers are still reviewing it.
const MAX_REVIEW_AGE_DAYS = 365;
// B2B companies must show recent life on Google too: a review in the last PLACES_ACTIVE_DAYS days (default 90), or no review data but opening hours and a phone.
const MAX_REVIEW_AGE_DAYS_B2B = Number(process.env.PLACES_ACTIVE_DAYS ?? 90);
const MAX_REVIEW_AGE_DAYS_BROKEN_SITE = 180;

const FIELD_MASK = [
  'nextPageToken',
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.internationalPhoneNumber',
  'places.websiteUri', 'places.googleMapsUri', 'places.rating', 'places.userRatingCount',
  'places.businessStatus', 'places.primaryTypeDisplayName',
  'places.reviews', 'places.regularOpeningHours',
].join(',');

interface Place {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  primaryTypeDisplayName?: { text?: string };
  reviews?: { publishTime?: string }[];
  regularOpeningHours?: { weekdayDescriptions?: string[] };
}

interface Activity { lastReviewDays: number | null; hasHours: boolean; hasPhone: boolean }

function activityOf(p: Place): Activity {
  const times = (p.reviews ?? []).map(r => Date.parse(r.publishTime ?? '')).filter(t => !isNaN(t));
  return {
    lastReviewDays: times.length ? Math.floor((Date.now() - Math.max(...times)) / 86400000) : null,
    hasHours: !!p.regularOpeningHours?.weekdayDescriptions?.length,
    hasPhone: !!p.internationalPhoneNumber,
  };
}

function ago(days: number): string {
  if (days < 14) return days <= 1 ? 'in the last day' : `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

function activitySentence(a: Activity): string {
  const parts = ['open on Google'];
  if (a.lastReviewDays !== null) parts.push(`last review ${ago(a.lastReviewDays)}`);
  if (a.hasHours) parts.push('opening hours listed');
  if (a.hasPhone) parts.push('phone listed');
  return `Verified active: ${parts.join(', ')}`;
}

function listFromEnv(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  if (!raw) return fallback;
  const items = raw.split('|').map(s => s.trim()).filter(Boolean);
  return items.length ? items : fallback;
}

// `only` limits a run to the given cities (used by the live test page); otherwise cities come
// from PLACES_CITIES or the defaults above.
export interface PlacesOptions { cities: string[]; searches: number }

function pickSearches(only?: PlacesOptions): { category: string; city: string }[] {
  const categories = listFromEnv('PLACES_CATEGORIES', DEFAULT_CATEGORIES);
  const count = only?.searches ?? SEARCHES_PER_RUN;
  const picks = new Map<string, { category: string; city: string }>();
  let guard = 0;
  // With a city list (the test page), spread the searches evenly across those cities.
  if (only) {
    for (let i = 0; picks.size < count && guard++ < 50; i++) {
      const city = only.cities[i % only.cities.length];
      const category = categories[Math.floor(Math.random() * categories.length)];
      picks.set(`${category}|${city}`, { category, city });
    }
    return [...picks.values()];
  }
  // A fixed list of cities from PLACES_CITIES wins over the markets.
  const fixed = process.env.PLACES_CITIES ? listFromEnv('PLACES_CITIES', DEFAULT_CITIES) : null;
  const markets = activeMarkets();
  while (picks.size < count && guard++ < 80) {
    const category = categories[Math.floor(Math.random() * categories.length)];
    // Market first, then a city in it, so each country gets an equal chance.
    const city = fixed
      ? fixed[Math.floor(Math.random() * fixed.length)]
      : (() => { const m = markets[Math.floor(Math.random() * markets.length)]; return m.cities[Math.floor(Math.random() * m.cities.length)]; })();
    picks.set(`${category}|${city}`, { category, city });
  }
  return [...picks.values()];
}

async function textSearchPage(query: string, apiKey: string, pageToken?: string): Promise<{ places: Place[]; next?: string }> {
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK },
      body: JSON.stringify({ textQuery: query, pageSize: 20, ...(pageToken ? { pageToken } : {}) }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error(`[places] "${query}": HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
      return { places: [] };
    }
    const data = await res.json() as { places?: Place[]; nextPageToken?: string };
    return { places: data.places ?? [], next: data.nextPageToken };
  } catch (e) {
    console.error(`[places] "${query}":`, (e as Error).message);
    return { places: [] };
  }
}

async function textSearch(query: string, apiKey: string): Promise<Place[]> {
  const all: Place[] = [];
  let token: string | undefined;
  for (let page = 0; page < PAGES_PER_SEARCH; page++) {
    const { places, next } = await textSearchPage(query, apiKey, token);
    all.push(...places);
    if (!next) break;
    token = next;
  }
  return all;
}

async function toLead(p: Place, category: string, city: string): Promise<Lead | null> {
  const b2b = B2B_CATEGORIES.has(category);
  const activity = activityOf(p);
  const name = p.displayName?.text ?? 'Unknown business';
  const reviews = p.userRatingCount ?? 0;
  const type = p.primaryTypeDisplayName?.text ?? category;
  const facts = [
    p.formattedAddress,
    p.rating ? `${p.rating} stars from ${reviews} Google reviews` : null,
  ];

  let headline: string;
  let issues: string[] = [];
  let emails: string[] = [];
  let links: Lead['contactLinks'] = { maps: p.googleMapsUri };
  let siteText: string | undefined;

  // No website (or only a Facebook page) means no published email to use.
  if (REQUIRE_EMAIL && (!p.websiteUri || platformOf(p.websiteUri))) return null;

  const platform = p.websiteUri ? platformOf(p.websiteUri) : null;
  if (!p.websiteUri) {
    headline = 'No website';
    issues = ['no website listed on Google'];
  } else if (platform) {
    headline = 'No own website';
    issues = [`their Google listing links to a ${platform.name} page instead of their own website`];
    links = { ...links, [platform.kind === 'social' && /instagram/i.test(platform.name) ? 'instagram' : platform.kind === 'social' && /facebook/i.test(platform.name) ? 'facebook' : 'website']: p.websiteUri };
  } else {
    const report = await analyzeWebsite(p.websiteUri);
    if (report.reachable === null || (!b2b && report.reachable && report.issues.length === 0)) return null;
    headline = report.reachable ? (report.issues.length ? 'Outdated website' : 'Has a working website') : 'Website broken';
    if (!b2b && !report.reachable && (activity.lastReviewDays === null || activity.lastReviewDays > MAX_REVIEW_AGE_DAYS_BROKEN_SITE)) return null;
    issues = report.issues;
    for (const e of report.emails) {
      if (await emailDomainAccepts(e)) { emails = [e]; break; }
    }
    links = { ...links, website: p.websiteUri, ...report.links };
    siteText = report.siteText;
  }
  if (REQUIRE_EMAIL && !emails[0]) return null;
  if (b2b) links = { ...links, segment: 'b2b' };

  return {
    id: `places-${p.id}`,
    title: name,
    company: `${type} · ${city}`,
    description: [headline, activitySentence(activity), ...facts, issues.length ? `Issues found: ${issues.join('; ')}` : null].filter(Boolean).join('. ') + '.',
    url: p.websiteUri ?? p.googleMapsUri ?? '',
    source: 'places',
    postedAt: new Date().toISOString(),
    siteText,
    contactEmail: emails[0],
    contactPhone: p.internationalPhoneNumber,
    contactLinks: links,
  };
}

export async function fetchPlacesLeads(only?: PlacesOptions): Promise<Lead[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.log('[places] No GOOGLE_PLACES_API_KEY, skipping');
    return [];
  }

  const started = Date.now();
  const searches = pickSearches(only);
  const results = await Promise.all(
    searches.map(async s => ({ ...s, places: await textSearch(searchText(s.category, s.city), apiKey) })),
  );

  // Businesses already saved or emailed would be thrown out later anyway; skipping them now keeps the time
  // budget for new ones. (Not used by the live test page, which wants a fresh look every time.)
  const known = only ? new Set<string>() : new Set<string>([...await getSentIds(365), ...await getExistingLeadIds()]);
  const candidates: { place: Place; category: string; city: string }[] = [];
  const seen = new Set<string>();
  const dropped = { closed: 0, fewReviews: 0, inactive: 0, known: 0 };
  for (const r of results) {
    for (const place of r.places) {
      if (seen.has(place.id)) continue;
      seen.add(place.id);
      if (known.has(`places-${place.id}`)) { dropped.known++; continue; }
      if (place.businessStatus !== 'OPERATIONAL') { dropped.closed++; continue; }
      if (B2B_CATEGORIES.has(r.category)) {
        const a = activityOf(place);
        const recent = a.lastReviewDays !== null && a.lastReviewDays <= MAX_REVIEW_AGE_DAYS_B2B;
        const noReviewData = a.lastReviewDays === null && a.hasHours && a.hasPhone;
        if (!recent && !noReviewData) { dropped.inactive++; continue; }
      } else {
        if ((place.userRatingCount ?? 0) < MIN_REVIEWS) { dropped.fewReviews++; continue; }
        const a = activityOf(place);
        const recentlyReviewed = a.lastReviewDays !== null && a.lastReviewDays <= MAX_REVIEW_AGE_DAYS;
        const noReviewData = a.lastReviewDays === null && a.hasHours && a.hasPhone;
        if (!recentlyReviewed && !noReviewData) { dropped.inactive++; continue; }
      }
      candidates.push({ place, category: r.category, city: r.city });
    }
  }

  const leads: Lead[] = [];
  const BATCH = 10;
  for (let i = 0; i < candidates.length; i += BATCH) {
    if (Date.now() - started > BUDGET_MS) {
      console.log(`[places] Time budget reached, checked ${i} of ${candidates.length} businesses`);
      break;
    }
    const batch = await Promise.all(candidates.slice(i, i + BATCH).map(c => toLead(c.place, c.category, c.city)));
    for (const l of batch) if (l) leads.push(l);
  }

  const withEmail = leads.filter(l => l.contactEmail).length;
  console.log(`[places] ${searches.map(s => `${s.category} in ${s.city}`).join('; ')} -> ${candidates.length} active businesses (dropped ${dropped.known} already known, ${dropped.closed} not open, ${dropped.fewReviews} too few reviews, ${dropped.inactive} no recent reviews), ${leads.length} prospects (${withEmail} with a working email)`);
  return leads;
}
