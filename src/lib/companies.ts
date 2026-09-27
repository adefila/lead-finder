import type { Lead } from '@/types/lead';
import { linkedInSearchUrl } from '@/lib/leadview';
import { analyzeWebsite } from '@/lib/enrich';
import { emailDomainAccepts } from '@/lib/verify';
import { UK_CITIES } from '@/lib/cities';

const API = 'https://api.company-information.service.gov.uk';

// Customer-facing trades that need a website (UK SIC 2007 codes).
const SIC: Record<string, string> = {
  '86230': 'Dental practice',
  '86900': 'Health practice',
  '96020': 'Hair and beauty salon',
  '96040': 'Spa and wellbeing',
  '93130': 'Fitness studio',
  '69102': 'Solicitors',
  '69201': 'Accountants',
  '68310': 'Estate agency',
  '71111': 'Architects',
  '74201': 'Photography studio',
  '43910': 'Roofing',
  '81300': 'Landscaping',
  '55100': 'Hotel',
  '56102': 'Cafe or restaurant',
  '75000': 'Veterinary practice',
};

const NEW_WITHIN_DAYS = 45;
const MAX_PER_RUN = 20;

interface Company {
  company_name: string;
  company_number: string;
  company_status?: string;
  date_of_creation?: string;
  sic_codes?: string[];
  registered_office_address?: { locality?: string };
}
interface Officer { name?: string; officer_role?: string; resigned_on?: string }

function authHeader(key: string): Record<string, string> {
  return { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}` };
}

async function chGet<T>(path: string, key: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { headers: authHeader(key), signal: AbortSignal.timeout(15000) });
    if (!res.ok) { console.error(`[companies] ${path.split('?')[0]}: HTTP ${res.status}`); return null; }
    return await res.json() as T;
  } catch (e) {
    console.error('[companies]', (e as Error).message);
    return null;
  }
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b([a-z])/g, m => m.toUpperCase()).replace(/\bLtd\b/, 'Ltd');
}

// "SMITH, Jane Mary" -> "Jane Smith"
function directorName(raw: string): string {
  const [surname, rest = ''] = raw.split(',').map(p => p.trim());
  const first = rest.split(/\s+/)[0] ?? '';
  return titleCase(`${first} ${surname}`.trim());
}

function baseName(companyName: string): string {
  return companyName.replace(/\b(ltd|limited|llp|plc|& co|and co)\.?$/i, '').replace(/[.,]/g, '').trim();
}

// Guess the obvious domains and accept one only when it clearly belongs to this company.
async function findWebsite(c: Company): Promise<string | null> {
  const name = baseName(c.company_name);
  const slug = name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
  if (slug.length < 4) return null;
  const numberRe = new RegExp(`\\b0*${c.company_number.replace(/^0+/, '')}\\b`);

  for (const url of [`https://${slug}.co.uk`, `https://www.${slug}.com`, `https://${slug}.uk`]) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) continue;
      const html = (await res.text()).slice(0, 400_000);
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
      if (numberRe.test(text) || text.includes(name.toLowerCase())) return res.url || url;
    } catch { /* not there */ }
  }
  return null;
}

async function toLead(c: Company, key: string): Promise<Lead | null> {
  const officers = await chGet<{ items?: Officer[] }>(`/company/${c.company_number}/officers?items_per_page=10`, key);
  const director = officers?.items?.find(o => o.officer_role === 'director' && !o.resigned_on && o.name);
  const person = director?.name ? directorName(director.name) : undefined;

  const trade = (c.sic_codes ?? []).map(code => SIC[code]).find(Boolean) ?? 'New business';
  const town = titleCase(c.registered_office_address?.locality ?? 'UK');
  const name = titleCase(c.company_name);
  const created = c.date_of_creation ? new Date(c.date_of_creation) : null;
  const ageDays = created ? Math.max(0, Math.floor((Date.now() - created.getTime()) / 86400000)) : null;
  const register = `https://find-and-update.company-information.service.gov.uk/company/${c.company_number}`;

  const site = await findWebsite(c);
  let headline = 'No website yet';
  let issues = ['no website found for this new company'];
  let email: string | undefined;
  let links: Lead['contactLinks'] = { register };
  let siteText: string | undefined;

  if (site) {
    const report = await analyzeWebsite(site);
    if (report.reachable === true && report.issues.length === 0) return null; // already has a decent site
    headline = report.reachable ? 'Outdated website' : 'Website broken';
    issues = report.issues;
    siteText = report.siteText;
    links = { ...links, website: site, ...report.links };
    for (const e of report.emails) if (await emailDomainAccepts(e)) { email = e; break; }
  }
  if (person && !links.linkedin) {
    links.linkedin = linkedInSearchUrl(person, baseName(name));
  }

  return {
    id: `ch-${c.company_number}`,
    title: name,
    company: `${trade} · ${town}, UK`,
    description: [
      headline,
      `Verified active: registered on Companies House ${ageDays !== null ? `${ageDays} days ago` : 'recently'}, status active`,
      person ? `Director: ${person}` : null,
      `Issues found: ${issues.join('; ')}`,
    ].filter(Boolean).join('. ') + '.',
    url: site ?? register,
    source: 'companies_house',
    postedAt: new Date().toISOString(),
    siteText,
    contactName: person,
    contactTitle: person ? 'Director' : undefined,
    contactEmail: email,
    contactLinks: links,
  };
}

export async function fetchCompaniesHouseLeads(): Promise<Lead[]> {
  const key = process.env.COMPANIES_HOUSE_API_KEY?.trim();
  if (!key) {
    console.log('[companies] No COMPANIES_HOUSE_API_KEY, skipping');
    return [];
  }

  const from = new Date(Date.now() - NEW_WITHIN_DAYS * 86400000).toISOString().slice(0, 10);
  const codes = Object.keys(SIC).sort(() => Math.random() - 0.5).slice(0, 5);
  const city = UK_CITIES[Math.floor(Math.random() * UK_CITIES.length)];
  const q = new URLSearchParams({
    incorporated_from: from,
    company_status: 'active',
    sic_codes: codes.join(','),
    location: city,
    size: '60',
  });
  const found = await chGet<{ items?: Company[] }>(`/advanced-search/companies?${q}`, key);
  const companies = (found?.items ?? []).sort(() => Math.random() - 0.5).slice(0, MAX_PER_RUN);

  const leads: Lead[] = [];
  for (let i = 0; i < companies.length; i += 5) {
    const batch = await Promise.all(companies.slice(i, i + 5).map(c => toLead(c, key)));
    for (const l of batch) if (l) leads.push(l);
  }

  console.log(`[companies] ${codes.map(c => SIC[c]).join(', ')} in ${city} since ${from} -> ${found?.items?.length ?? 0} new companies, ${leads.length} prospects (${leads.filter(l => l.contactEmail).length} with email, ${leads.filter(l => l.contactName).length} with director name)`);
  return leads;
}
