import type { Lead } from '@/types/lead';
import { analyzeWebsite, platformOf } from '@/lib/enrich';
import { emailDomainAccepts } from '@/lib/verify';
import { CITY_COORDS } from '@/lib/cities';

// OpenStreetMap trades, as OSM tags. Businesses tag themselves, so coverage varies by city.
const TRADES: { label: string; tag: string }[] = [
  { label: 'Dentist', tag: '"amenity"="dentist"' },
  { label: 'Law firm', tag: '"office"="lawyer"' },
  { label: 'Estate agent', tag: '"office"="estate_agent"' },
  { label: 'Accountant', tag: '"office"="accountant"' },
  { label: 'Architect', tag: '"office"="architect"' },
  { label: 'Hair salon', tag: '"shop"="hairdresser"' },
  { label: 'Beauty salon', tag: '"shop"="beauty"' },
  { label: 'Physiotherapist', tag: '"healthcare"="physiotherapist"' },
  { label: 'Veterinary clinic', tag: '"amenity"="veterinary"' },
  { label: 'Gym', tag: '"leisure"="fitness_centre"' },
  { label: 'Photographer', tag: '"craft"="photographer"' },
  { label: 'Roofer', tag: '"craft"="roofer"' },
];

const SEARCHES_PER_RUN = 2;
const RADIUS_M = 8000;
const MAX_PER_SEARCH = 25;

interface OsmElement { type: string; id: number; tags?: Record<string, string> }

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

async function overpass(tag: string, lat: number, lon: number): Promise<OsmElement[]> {
  const around = `(around:${RADIUS_M},${lat},${lon})`;
  const query = `[out:json][timeout:25];(nwr[${tag}]["website"]${around};nwr[${tag}]["contact:website"]${around};);out tags ${MAX_PER_SEARCH};`;
  // The public Overpass servers are often busy; try the next one before giving up.
  for (const endpoint of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'LeadFinder/1.0 (+https://adefilasamuel.com)' },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) {
        console.error(`[osm] ${new URL(endpoint).host}: HTTP ${res.status}`);
        continue;
      }
      const data = await res.json() as { elements?: OsmElement[] };
      return data.elements ?? [];
    } catch (e) {
      console.error(`[osm] ${new URL(endpoint).host}:`, (e as Error).message);
    }
  }
  return [];
}

function normaliseSite(raw: string): string | null {
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    return url.toString();
  } catch { return null; }
}

async function toLead(el: OsmElement, trade: string, city: string): Promise<Lead | null> {
  const t = el.tags ?? {};
  const name = t.name;
  const site = normaliseSite(t.website ?? t['contact:website'] ?? '');
  if (!name || !site) return null;

  const platform = platformOf(site);
  if (platform?.kind === 'social') return null; // can't confirm they still trade
  if (platform?.kind === 'booking') {
    const phone = t.phone ?? t['contact:phone'];
    const listed = [t.email, t['contact:email']].filter(Boolean) as string[];
    let email: string | undefined;
    for (const e of listed) if (await emailDomainAccepts(e)) { email = e.toLowerCase(); break; }
    return {
      id: `osm-${el.type}-${el.id}`,
      title: name,
      company: `${trade} · ${city}`,
      description: [
        'No own website',
        `Verified active: taking bookings on ${platform.name}${phone ? ', phone listed' : ''}`,
        `Issues found: uses a ${platform.name} booking page instead of their own website`,
      ].join('. ') + '.',
      url: site,
      source: 'osm',
      postedAt: new Date().toISOString(),
      contactEmail: email,
      contactPhone: phone,
      contactLinks: { website: site, maps: `https://www.openstreetmap.org/${el.type}/${el.id}` },
    };
  }

  // No reviews on OSM, so a live website is the proof the business still operates.
  const report = await analyzeWebsite(site);
  if (report.reachable !== true || report.issues.length === 0) return null;

  const listed = [t.email, t['contact:email']].filter(Boolean) as string[];
  let email: string | undefined;
  for (const e of [...listed, ...report.emails]) {
    if (await emailDomainAccepts(e)) { email = e.toLowerCase(); break; }
  }
  const phone = t.phone ?? t['contact:phone'];
  const address = [t['addr:housenumber'], t['addr:street'], t['addr:city'] ?? city.split(',')[0]].filter(Boolean).join(' ');

  return {
    id: `osm-${el.type}-${el.id}`,
    title: name,
    company: `${trade} · ${city}`,
    description: [
      'Outdated website',
      `Verified active: website online, ${t.opening_hours ? 'opening hours listed' : 'listed on OpenStreetMap'}${phone ? ', phone listed' : ''}`,
      address || null,
      `Issues found: ${report.issues.join('; ')}`,
    ].filter(Boolean).join('. ') + '.',
    url: site,
    source: 'osm',
    postedAt: new Date().toISOString(),
    siteText: report.siteText,
    contactEmail: email,
    contactPhone: phone,
    contactLinks: {
      website: site,
      maps: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      ...report.links,
    },
  };
}

export async function fetchOsmLeads(): Promise<Lead[]> {
  const cities = Object.keys(CITY_COORDS);
  const searches = Array.from({ length: SEARCHES_PER_RUN }, () => ({ trade: pick(TRADES), city: pick(cities) }));

  const leads: Lead[] = [];
  let found = 0;
  // Overpass is a shared free service: run searches one after another, not in parallel.
  for (const { trade, city } of searches) {
    const { lat, lon } = CITY_COORDS[city];
    const elements = await overpass(trade.tag, lat, lon);
    found += elements.length;
    for (let i = 0; i < elements.length; i += 8) {
      const batch = await Promise.all(elements.slice(i, i + 8).map(el => toLead(el, trade.label, city)));
      for (const l of batch) if (l) leads.push(l);
    }
  }

  console.log(`[osm] ${searches.map(s => `${s.trade.label} in ${s.city}`).join('; ')} -> ${found} with websites, ${leads.length} prospects (${leads.filter(l => l.contactEmail).length} with a working email)`);
  return leads;
}
