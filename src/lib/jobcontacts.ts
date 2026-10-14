import type { Lead } from '@/types/lead';
import { analyzeWebsite, extractEmails, findPage, getHtml, platformOf } from '@/lib/enrich';
import { emailDomainAccepts } from '@/lib/verify';
import { generateColdEmails } from '@/lib/claude';
import { getLeads, updateLead } from '@/lib/supabase';

// For a job post, find the company's own website and an address to pitch to directly: the hiring
// or HR inbox first, then a named person (founder, CEO), then the general one. The about page text
// goes to the drafting step, which picks out the founder or CEO's name when the page shows it.

const BUDGET_MS = 45_000;
const BATCH = 6;

// Job boards and applicant-tracking systems: their domain is not the employer's.
const NOT_EMPLOYER = /(^|\.)(greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|smartrecruiters\.com|myworkdayjobs\.com|workday\.com|bamboohr\.com|recruitee\.com|personio\.(de|com)|jobvite\.com|icims\.com|breezy\.hr|teamtailor\.com|join\.com|applytojob\.com|jazzhr\.com|rippling\.com|gem\.com|dover\.com|pinpointhq\.com|homerun\.co|wellfound\.com|ycombinator\.com|workatastartup\.com|himalayas\.app|remotive\.com|jobicy\.com|arbeitnow\.com|themuse\.com|linkedin\.com|indeed\.com|glassdoor\.com|google\.com|googleapis\.com|gstatic\.com|cloudfront\.net|amazonaws\.com|cdn\.\w+|typeform\.com|forms\.gle|notion\.site|github\.com|medium\.com|youtube\.com|apple\.com|stepstone\.de|xing\.com)$/i;
const LEGAL = /\b(inc|llc|ltd|limited|gmbh|ag|corp|corporation|co|plc|se|ug|bv|sa|technologies|technology|labs|group|holdings)\b\.?/gi;

const HIRING = /^(careers?|jobs?|hr|talent|recruit\w*|people|hiring|join|joinus|work|apply|applications?|karriere|bewerbung\w*|personal)([._-]|@)/i;
const GENERAL = /^(hello|hi|info|contact|team|office|mail|kontakt|hallo|enquiries|inquiries|general)([._-]|@)/i;
const NEVER = /^(no-?reply|do-?not-?reply|privacy|legal|gdpr|dpo|datenschutz|abuse|security|press|media|billing|invoices?|accounts?|support|help|unsubscribe|webmaster|postmaster|admin|sales|partners?|marketing)([._-]|@)/i;

export interface JobContact {
  website: string;
  email: string | null;
  kind: 'hiring' | 'person' | 'general' | null;
  siteText?: string;
  links: Lead['contactLinks'];
}

const companyOf = (l: Lead) => l.company.split(' · ')[0].trim();
const slugOf = (name: string) => name.replace(LEGAL, ' ').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
const tokensOf = (name: string) => name.replace(LEGAL, ' ').toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ')
  .split(/\s+/).filter(w => w.length >= 4);

function hostOf(url: string): string | null {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
}

// "careers.acme-labs.co.uk" -> "careersacmelabs"; good enough to compare with a company name.
function labelOf(host: string): string {
  const parts = host.split('.');
  const cut = parts.length > 2 && ['co', 'com'].includes(parts[parts.length - 2]) ? 2 : 1;
  return parts.slice(0, -cut).join('').replace(/[^a-z0-9]/g, '');
}

function isEmployerHost(host: string): boolean {
  return !NOT_EMPLOYER.test(host) && !platformOf(`https://${host}`);
}

// The whole name ("Acme Labs" -> acmelabs) or a distinctive first word ("Acme") must be in the domain.
function matchesCompany(host: string, company: string): boolean {
  const label = labelOf(host);
  const slug = slugOf(company);
  if (slug.length >= 3 && label.includes(slug)) return true;
  const first = tokensOf(company)[0];
  return !!first && first.length >= 5 && label.includes(first);
}

async function companySite(l: Lead): Promise<string | null> {
  const company = companyOf(l);
  if (!company) return null;

  // 1. The apply link is on their own site.
  const applyHost = hostOf(l.url);
  if (applyHost && isEmployerHost(applyHost) && matchesCompany(applyHost, company)) return `https://${applyHost}`;

  // 2. The job page links to their site (boards and ATS pages usually do, from the logo or footer).
  const page = await getHtml(l.url);
  if (page.kind === 'ok') {
    for (const m of page.html.matchAll(/href=["'](https?:\/\/[^"'#\s]+)["']/gi)) {
      const host = hostOf(m[1]);
      if (host && host !== applyHost && isEmployerHost(host) && matchesCompany(host, company)) return `https://${host}`;
    }
  }

  // 3. Their name as a domain, only when the page there names the company.
  const slug = slugOf(company);
  if (slug.length < 3) return null;
  const tld = /Germany/.test(l.company) ? '.de' : /Ireland/.test(l.company) ? '.ie' : /Canada/.test(l.company) ? '.ca' : '.com';
  const name = company.replace(LEGAL, ' ').trim().toLowerCase();
  const urls = [...new Set(['.com', tld, '.io', '.co'])].map(t => `https://${slug}${t}`);
  const homes = await Promise.all(urls.map(u => getHtml(u)));
  for (const home of homes) {
    if (home.kind === 'ok' && home.html.slice(0, 40000).toLowerCase().includes(name)) return `https://${hostOf(home.finalUrl)}`;
  }
  return null;
}

function rank(email: string): number {
  if (HIRING.test(email)) return 0;
  if (GENERAL.test(email)) return 2;
  return 1; // a named person
}

async function contactFor(l: Lead): Promise<JobContact | null> {
  const website = await companySite(l);
  if (!website) return null;
  const host = hostOf(website)!;
  const base = host.split('.').slice(-2).join('.');

  const [report, home] = await Promise.all([analyzeWebsite(website), getHtml(website)]);
  const emails = [...report.emails];
  // The careers page often lists the hiring inbox.
  if (home.kind === 'ok') {
    const careers = findPage(home.html, home.finalUrl, /career|jobs|join|work-with-us|karriere|hiring/i);
    const page = careers ? await getHtml(careers) : null;
    if (page?.kind === 'ok') emails.push(...extractEmails(page.html));
  }

  // Only addresses on their own domain: anything else is an agency, a vendor or a template.
  const own = [...new Set(emails)].filter(e => e.endsWith(`@${host}`) || e.endsWith(`.${base}`) || e.endsWith(`@${base}`))
    .filter(e => !NEVER.test(e))
    .sort((a, b) => rank(a) - rank(b));
  for (const e of own) {
    if (await emailDomainAccepts(e)) {
      const r = rank(e);
      return { website, email: e, kind: r === 0 ? 'hiring' : r === 1 ? 'person' : 'general', siteText: report.siteText, links: report.links };
    }
  }
  return { website, email: null, kind: null, siteText: report.siteText, links: report.links };
}

// Adds the company website, a pitch address and their site text to job leads, within a time budget.
// Every job it gets to is marked as searched, found or not.
export async function findJobContacts(leads: Lead[], budgetMs = BUDGET_MS): Promise<Lead[]> {
  const started = Date.now();
  const out = new Map<string, Lead>();
  const todo = leads.filter(l => l.source === 'job' && !l.contactEmail && !l.contactLinks?.searched);
  const searched = new Date().toISOString();
  let found = 0;
  let sites = 0;
  for (let i = 0; i < todo.length && Date.now() - started < budgetMs; i += BATCH) {
    await Promise.all(todo.slice(i, i + BATCH).map(async l => {
      const c = await contactFor(l).catch(() => null);
      if (c) sites++;
      if (c?.email) found++;
      out.set(l.id, c ? {
        ...l,
        contactEmail: c.email ?? undefined,
        contactLinks: { ...(l.contactLinks ?? {}), ...c.links, website: c.website, searched },
        siteText: c.siteText,
      } : { ...l, contactLinks: { ...(l.contactLinks ?? {}), searched } });
    }));
  }
  console.log(`[job-contacts] ${out.size} of ${todo.length} jobs searched, ${sites} company sites, ${found} emails to pitch to`);
  return leads.map(l => out.get(l.id) ?? l);
}

// Jobs already in the dashboard (still To contact, never searched): find who to pitch, and for the
// ones with an email, write the pitch email in place of the application note. One pitch per company.
export async function backfillJobContacts(budgetMs: number): Promise<{ searched: number; emails: number; left: number }> {
  const all = await getLeads();
  const todo = all.filter(l => l.source === 'job' && (l.status ?? 'new') === 'new' && !l.contactEmail && !l.contactLinks?.searched);
  if (!todo.length || budgetMs < 10_000) return { searched: 0, emails: 0, left: todo.length };

  const taken = new Set(all.map(l => l.contactEmail?.toLowerCase()).filter(Boolean) as string[]);
  const done = (await findJobContacts(todo, budgetMs)).filter(l => l.contactLinks?.searched);
  const withEmail: Lead[] = [];
  for (const l of done) {
    const email = l.contactEmail?.toLowerCase();
    if (email && !taken.has(email)) { taken.add(email); withEmail.push(l); continue; }
    await updateLead(l.id, { contact_links: l.contactLinks ?? null });
  }

  const drafted = withEmail.length ? await generateColdEmails(withEmail) : [];
  for (const d of drafted) {
    const pitch = d.proposal && /^\s*Subject:/i.test(d.proposal) ? d.proposal : null;
    await updateLead(d.id, {
      contact_email: d.contactEmail,
      contact_links: d.contactLinks ?? null,
      ...(pitch ? { draft_email: pitch, contact_name: d.contactName ?? null, contact_title: d.contactTitle ?? null } : {}),
    });
  }
  const left = todo.length - done.length;
  console.log(`[job-contacts] backfill: ${done.length} existing jobs searched, ${withEmail.length} now have an email, ${left} left`);
  return { searched: done.length, emails: withEmail.length, left };
}
