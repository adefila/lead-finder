import type { Lead } from '@/types/lead';
import { analyzeWebsite, platformOf } from '@/lib/enrich';
import { emailDomainAccepts } from '@/lib/verify';

const DEFAULT_CATEGORIES = [
  'dentist', 'law firm', 'real estate agency', 'med spa', 'roofing contractor', 'interior designer',
  'accounting firm', 'physiotherapy clinic', 'wedding photographer', 'boutique gym', 'hair salon',
  'landscaping company', 'chiropractor', 'boutique hotel', 'architecture firm', 'veterinary clinic',
];

const DEFAULT_CITIES = [
  'Austin, TX', 'Denver, CO', 'Miami, FL', 'San Diego, CA', 'Nashville, TN', 'Toronto, Canada',
  'Calgary, Canada', 'Manchester, UK', 'Leeds, UK', 'Dublin, Ireland', 'Sydney, Australia', 'Auckland, New Zealand',
];

// Each search is one billed Text Search (Enterprise) call. 4 per run x 2 runs/day stays well under
// Google's free monthly allowance for that SKU.
const SEARCHES_PER_RUN = 4;
const MIN_REVIEWS = 10;
// A business is only a lead if customers are still reviewing it.
const MAX_REVIEW_AGE_DAYS = 365;
const MAX_REVIEW_AGE_DAYS_BROKEN_SITE = 180;

const FIELD_MASK = [
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

function pickSearches(): { category: string; city: string }[] {
  const categories = listFromEnv('PLACES_CATEGORIES', DEFAULT_CATEGORIES);
  const cities = listFromEnv('PLACES_CITIES', DEFAULT_CITIES);
  const picks = new Map<string, { category: string; city: string }>();
  let guard = 0;
  while (picks.size < SEARCHES_PER_RUN && guard++ < 50) {
    const category = categories[Math.floor(Math.random() * categories.length)];
    const city = cities[Math.floor(Math.random() * cities.length)];
    picks.set(`${category}|${city}`, { category, city });
  }
  return [...picks.values()];
}

async function textSearch(query: string, apiKey: string): Promise<Place[]> {
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK },
      body: JSON.stringify({ textQuery: query, pageSize: 20 }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error(`[places] "${query}": HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
      return [];
    }
    const data = await res.json() as { places?: Place[] };
    return data.places ?? [];
  } catch (e) {
    console.error(`[places] "${query}":`, (e as Error).message);
    return [];
  }
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

export async function fetchPlacesLeads(): Promise<Lead[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.log('[places] No GOOGLE_PLACES_API_KEY, skipping');
    return [];
  }

  const searches = pickSearches();
  const results = await Promise.all(
    searches.map(async s => ({ ...s, places: await textSearch(`${s.category} in ${s.city}`, apiKey) })),
  );

  const candidates: { place: Place; category: string; city: string }[] = [];
  const seen = new Set<string>();
  const dropped = { closed: 0, fewReviews: 0, inactive: 0 };
  for (const r of results) {
    for (const place of r.places) {
      if (seen.has(place.id)) continue;
      seen.add(place.id);
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
    const batch = await Promise.all(candidates.slice(i, i + BATCH).map(c => toLead(c.place, c.category, c.city)));
    for (const l of batch) if (l) leads.push(l);
  }

  const withEmail = leads.filter(l => l.contactEmail).length;
  console.log(`[places] ${searches.map(s => `${s.category} in ${s.city}`).join('; ')} -> ${candidates.length} active businesses (dropped ${dropped.closed} not open, ${dropped.fewReviews} too few reviews, ${dropped.inactive} no recent reviews), ${leads.length} prospects (${withEmail} with a working email)`);
  return leads;
}
