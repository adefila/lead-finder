import type { Lead } from '@/types/lead';
import { analyzeWebsite, platformOf } from '@/lib/enrich';
import { emailDomainAccepts } from '@/lib/verify';
import { getSentIds, getExistingLeadIds } from '@/lib/supabase';

const DEFAULT_CATEGORIES = [
  'dentist', 'law firm', 'real estate agency', 'med spa', 'roofing contractor', 'interior designer',
  'accounting firm', 'physiotherapy clinic', 'wedding photographer', 'boutique gym', 'hair salon',
  'landscaping company', 'chiropractor', 'boutique hotel', 'architecture firm', 'veterinary clinic',
  // Service businesses that live on quotes, bookings and reviews
  'plumber', 'electrician', 'cleaning service', 'driving school', 'mortgage broker', 'pet groomer', 'auto repair shop', 'tutoring centre',
];

// Australia and Singapore: English-speaking, and both allow a relevant email to an address a
// business publishes on its own website. Germany is left out on purpose (strict cold-email law).
// The Netherlands, Norway and Luxembourg are written to in Dutch, Norwegian and French
// (see leadLanguage in leadview.ts).
const DEFAULT_CITIES = [
  'Sydney, Australia', 'Melbourne, Australia', 'Brisbane, Australia', 'Perth, Australia',
  'Adelaide, Australia', 'Gold Coast, Australia', 'Canberra, Australia', 'Singapore',
  'Amsterdam, Netherlands', 'Rotterdam, Netherlands', 'Utrecht, Netherlands', 'The Hague, Netherlands', 'Eindhoven, Netherlands',
  'Oslo, Norway', 'Bergen, Norway', 'Trondheim, Norway', 'Stavanger, Norway',
  'Luxembourg City, Luxembourg',
  // English-speaking, business email to a published address is allowed with an opt-out
  'Auckland, New Zealand', 'Wellington, New Zealand', 'Christchurch, New Zealand',
  'Dublin, Ireland', 'Cork, Ireland', 'Galway, Ireland', 'Limerick, Ireland',
];

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
const MIN_REVIEWS = 10;
// A business is only a lead if customers are still reviewing it.
const MAX_REVIEW_AGE_DAYS = 365;
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
  const cities = only?.cities ?? listFromEnv('PLACES_CITIES', DEFAULT_CITIES);
  const count = only?.searches ?? SEARCHES_PER_RUN;
  const picks = new Map<string, { category: string; city: string }>();
  let guard = 0;
  // With a city list, spread the searches evenly across the cities.
  if (only) {
    for (let i = 0; picks.size < count && guard++ < 50; i++) {
      const city = cities[i % cities.length];
      const category = categories[Math.floor(Math.random() * categories.length)];
      picks.set(`${category}|${city}`, { category, city });
    }
    return [...picks.values()];
  }
  while (picks.size < count && guard++ < 50) {
    const category = categories[Math.floor(Math.random() * categories.length)];
    const city = cities[Math.floor(Math.random() * cities.length)];
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
    if (report.reachable === null || (report.reachable && report.issues.length === 0)) return null;
    headline = report.reachable ? 'Outdated website' : 'Website broken';
    if (!report.reachable && (activity.lastReviewDays === null || activity.lastReviewDays > MAX_REVIEW_AGE_DAYS_BROKEN_SITE)) return null;
    issues = report.issues;
    for (const e of report.emails) {
      if (await emailDomainAccepts(e)) { emails = [e]; break; }
    }
    links = { ...links, website: p.websiteUri, ...report.links };
    siteText = report.siteText;
  }
  if (REQUIRE_EMAIL && !emails[0]) return null;

  return {
    id: `places-${p.id}`,
    title: name,
    company: `${type} · ${city}`,
    description: [headline, activitySentence(activity), ...facts, `Issues found: ${issues.join('; ')}`].filter(Boolean).join('. ') + '.',
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
    searches.map(async s => ({ ...s, places: await textSearch(`${s.category} in ${s.city}`, apiKey) })),
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
      if ((place.userRatingCount ?? 0) < MIN_REVIEWS) { dropped.fewReviews++; continue; }
      const a = activityOf(place);
      const recentlyReviewed = a.lastReviewDays !== null && a.lastReviewDays <= MAX_REVIEW_AGE_DAYS;
      const noReviewData = a.lastReviewDays === null && a.hasHours && a.hasPhone;
      if (!recentlyReviewed && !noReviewData) { dropped.inactive++; continue; }
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
