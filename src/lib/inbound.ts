import crypto from 'crypto';
import type { Lead } from '@/types/lead';
import { getLeadById, getLeads, saveLeads, updateLead } from '@/lib/supabase';
import { analyzeWebsite, findSiteEmails, platformOf } from '@/lib/enrich';
import { emailDomainAccepts } from '@/lib/verify';
import { generateColdEmails } from '@/lib/claude';
import { sendInboundAlert } from '@/lib/email';
import { logVisitAndCheckBurst } from '@/lib/visitlog';

// Leads that come from adefilasamuel.com itself:
// - website: someone filled in the contact form (Framer form webhook or the embed snippet).
// - visitor: a company identified from the network a visitor browsed from.
// - and visits by leads you already emailed, through the tracked link in your emails.

// Your website's addresses: browsers may only send the beacon and the form from these.
export const SITE_ORIGINS = (process.env.SITE_ORIGINS ?? 'https://adefilasamuel.com,https://www.adefilasamuel.com')
  .split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && (SITE_ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+\.framer\.(app|website)$/.test(origin));
  return allowed ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' } : {};
}

// Email security scanners and crawlers open links and pages too. They are not people.
export const NOT_A_PERSON = /bot|crawl|spider|preview|scan|safelinks|proofpoint|mimecast|barracuda|forcepoint|symantec|trendmicro|sophos|curl|wget|python|go-http|java\/|headless|phantom|lighthouse|pingdom|uptime/i;

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const hostOf = (url: string) => { try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
const slugOf = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const FREE_MAIL = /@(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|me|aol|proton|protonmail|gmx|web|mail|yandex)\./i;

// ─── Contact form ────────────────────────────────────────────────────────────

// Field names differ between forms ("Name", "full_name", "Your email"...): match them loosely.
function pick(fields: Record<string, unknown>, ...patterns: RegExp[]): string {
  for (const re of patterns) {
    for (const [k, v] of Object.entries(fields)) if (re.test(k) && typeof v === 'string' && v.trim()) return v;
  }
  return '';
}

export interface Enquiry { name: string; email: string; company: string; website: string; budget: string; message: string; page: string }

export function parseEnquiry(raw: unknown): Enquiry | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Send the form fields as JSON' };
  // Framer sends the fields at the top level; some tools nest them under "data" or "fields".
  const top = raw as Record<string, unknown>;
  const fields = (typeof top.data === 'object' && top.data) || (typeof top.fields === 'object' && top.fields) || top;
  const f = fields as Record<string, unknown>;
  // Hidden "website_url2" field: people never fill it in, spam bots do.
  if (clean(f.website_url2 ?? f.hp, 200)) return { error: 'spam' };
  const enquiry: Enquiry = {
    name: clean(pick(f, /^(full[ _-]?)?name$/i, /name/i), 100),
    email: clean(pick(f, /e-?mail/i), 200).toLowerCase(),
    company: clean(pick(f, /company|business|organi[sz]ation|brand/i), 120),
    website: clean(pick(f, /website|site|url|link/i), 200),
    budget: clean(pick(f, /budget|price/i), 80),
    message: clean(pick(f, /message|project|details|about|help|need|description|brief/i), 3000),
    page: clean(pick(f, /^page$|source|referr?er/i), 200),
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(enquiry.email)) return { error: 'A valid email is required' };
  if (!enquiry.name && !enquiry.message) return { error: 'Add your name or a message' };
  return enquiry;
}

export async function createEnquiryLead(e: Enquiry): Promise<Lead> {
  const businessDomain = FREE_MAIL.test(e.email) ? '' : e.email.split('@')[1];
  const website = e.website ? (e.website.startsWith('http') ? e.website : `https://${e.website}`) : businessDomain ? `https://${businessDomain}` : '';
  const who = e.company || e.name || e.email;
  const lead: Lead = {
    id: `website-${slugOf(who) || 'enquiry'}-${crypto.randomBytes(4).toString('hex')}`,
    source: 'website',
    title: who,
    company: ['Enquiry from adefilasamuel.com', e.budget && `Budget: ${e.budget}`].filter(Boolean).join(' · '),
    description: [e.message || 'No message.', e.page && `Sent from ${e.page}.`].filter(Boolean).join(' '),
    url: website || 'https://adefilasamuel.com',
    postedAt: new Date().toISOString(),
    score: 95,
    contactEmail: e.email,
    contactName: e.name || undefined,
    contactLinks: website && !platformOf(website) ? { website } : undefined,
  };
  const [drafted] = await generateColdEmails([lead]).catch(() => [lead]);
  await saveLeads([drafted]);
  try { await sendInboundAlert(drafted, 'enquiry'); } catch (err) { console.error('[capture] alert failed:', (err as Error).message); }
  console.log(`[capture] enquiry from ${e.email} saved as ${lead.id}`);
  return drafted;
}

// ─── Visits by leads you emailed (tracked link) ──────────────────────────────

export async function recordLeadVisit(lead: Lead, ua: string, page = '/'): Promise<void> {
  try {
    if (!ua || NOT_A_PERSON.test(ua)) return;
    // Scanners open every link the moment an email lands.
    if (lead.lastSentAt && Date.now() - new Date(lead.lastSentAt).getTime() < 3 * 60_000) return;
    // A run of different leads clicking within minutes is a scanner, not interest.
    if (await logVisitAndCheckBurst(lead, 'site')) return;
    const links = lead.contactLinks ?? {};
    const first = !links.siteVisitedAt;
    await updateLead(lead.id, {
      contact_links: {
        ...links,
        siteVisitedAt: links.siteVisitedAt ?? new Date().toISOString(),
        siteVisits: (links.siteVisits ?? 0) + 1,
        sitePages: [...new Set([...(links.sitePages ?? []), page])].slice(-10),
      },
    });
    console.log(`[visit] ${lead.title} visited your site (visit ${(links.siteVisits ?? 0) + 1})`);
    if (first) await sendInboundAlert(lead, 'visited').catch(() => null);
  } catch (e) {
    console.error('[visit] tracking failed:', (e as Error).message);
  }
}

// ─── Company identification from the visitor's network ───────────────────────

// Home broadband, mobile networks, clouds and VPNs: the network tells us nothing about a company.
const NOT_A_COMPANY = /\b(telecom|telekom|telefonica|telstra|vodafone|orange|comcast|xfinity|verizon|at&t|att |t-mobile|sprint|charter|spectrum|cox|centurylink|lumen|frontier|rogers|bell canada|shaw|telus|videotron|virgin|sky |bt |talktalk|eir|mtn|airtel|glo |globacom|9mobile|safaricom|jio|reliance|bharti|china (telecom|unicom|mobile)|kddi|ntt|softbank|deutsche|1&1|o2|telenor|telia|swisscom|proximus|kpn|ziggo|free sas|sfr|bouygues|iliad|liberty global|starlink|google|amazon|aws|microsoft|azure|cloudflare|digitalocean|ovh|hetzner|linode|akamai|fastly|oracle|alibaba|tencent|vultr|leaseweb|contabo|choopa|m247|datacamp|nordvpn|expressvpn|mullvad|private internet|zscaler|apple|facebook|meta platforms|broadband|cable|wireless|mobile|cellular|internet|isp\b|hosting|datacenter|data center|network services|communications)\b/i;

interface IpInfo { ip?: string; org?: string; city?: string; region?: string; country?: string; company?: { name?: string; domain?: string; type?: string }; privacy?: { vpn?: boolean; proxy?: boolean; hosting?: boolean } }

const ipCache = new Map<string, Promise<IpInfo | null>>();

function lookupIp(ip: string): Promise<IpInfo | null> {
  if (!ipCache.has(ip)) {
    const token = process.env.IPINFO_TOKEN;
    ipCache.set(ip, fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/json${token ? `?token=${token}` : ''}`, { signal: AbortSignal.timeout(5000) })
      .then(r => (r.ok ? r.json() as Promise<IpInfo> : null)).catch(() => null));
    if (ipCache.size > 2000) ipCache.delete(ipCache.keys().next().value!);
  }
  return ipCache.get(ip)!;
}

// The company behind a network, or null for homes, phones, clouds and VPNs.
function companyOf(info: IpInfo): { name: string; domain: string } | null {
  if (info.privacy?.vpn || info.privacy?.proxy || info.privacy?.hosting) return null;
  if (info.company?.name) {
    if (info.company.type && info.company.type !== 'business') return null;
    return NOT_A_COMPANY.test(info.company.name) ? null : { name: info.company.name, domain: info.company.domain ?? '' };
  }
  // Free plan: only "AS1234 Acme Corp". Big firms and universities run their own networks.
  const name = (info.org ?? '').replace(/^AS\d+\s+/, '').trim();
  if (!name || NOT_A_COMPANY.test(name)) return null;
  return { name, domain: '' };
}

export interface Visit { ip: string; ua: string; path: string; referrer: string }

export async function recordCompanyVisit(v: Visit): Promise<string | null> {
  if (!v.ip || !v.ua || NOT_A_PERSON.test(v.ua)) return null;
  const info = await lookupIp(v.ip);
  const company = info && companyOf(info);
  if (!company) return null;

  const page = v.path.slice(0, 120) || '/';
  const place = [info.city, info.country].filter(Boolean).join(', ');
  const domain = company.domain.toLowerCase();

  // A company you already have as a lead: mark the visit on that lead instead.
  if (domain) {
    const existing = (await getLeads()).find(l => hostOf(l.contactLinks?.website ?? '') === domain || l.contactEmail?.endsWith(`@${domain}`));
    if (existing) { await recordLeadVisit(existing, v.ua, page); return existing.id; }
  }

  const id = `visitor-${slugOf(company.name)}`;
  const known = await getLeadById(id);
  if (known) {
    const links = known.contactLinks ?? {};
    await updateLead(id, {
      contact_links: {
        ...links,
        siteVisitedAt: links.siteVisitedAt ?? new Date().toISOString(),
        siteVisits: (links.siteVisits ?? 0) + 1,
        sitePages: [...new Set([...(links.sitePages ?? []), page])].slice(-10),
      },
    });
    return id;
  }

  const website = domain ? `https://${domain}` : '';
  let lead: Lead = {
    id,
    source: 'visitor',
    title: company.name,
    company: ['Visited your site', place].filter(Boolean).join(' · '),
    description: [
      `Someone on ${company.name}'s network visited adefilasamuel.com (${page}${v.referrer ? `, from ${hostOf(v.referrer) || v.referrer}` : ''}).`,
      domain ? '' : 'Identified from the network name only, so check it is a real business before reaching out.',
    ].filter(Boolean).join(' '),
    url: website || `https://www.google.com/search?q=${encodeURIComponent(company.name)}`,
    postedAt: new Date().toISOString(),
    score: domain ? 70 : 50,
    contactLinks: { ...(website ? { website } : {}), siteVisitedAt: new Date().toISOString(), siteVisits: 1, sitePages: [page] },
  };

  // With their website, look for an email now so the lead is ready to contact.
  if (website) {
    const report = await analyzeWebsite(website).catch(() => null);
    let emails = report?.emails ?? [];
    if (!emails.length) emails = (await findSiteEmails(website).catch(() => ({ emails: [] as string[] }))).emails;
    lead = { ...lead, siteText: report?.siteText };
    for (const e of emails) if (await emailDomainAccepts(e)) { lead = { ...lead, contactEmail: e }; break; }
    if (lead.contactEmail) [lead] = await generateColdEmails([lead]).catch(() => [lead]);
  }
  await saveLeads([lead]);
  console.log(`[visit] new company visitor: ${company.name}${domain ? ` (${domain})` : ''}${lead.contactEmail ? `, email ${lead.contactEmail}` : ''}`);
  return id;
}
