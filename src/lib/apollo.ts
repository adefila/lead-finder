import type { Lead } from '@/types/lead';

interface ApolloOrg {
  name?: string;
  website_url?: string;
  short_description?: string;
  primary_domain?: string;
  estimated_num_employees?: number;
  industry?: string;
}

interface ApolloPerson {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  email?: string;
  email_status?: string;
  organization?: ApolloOrg;
  linkedin_url?: string;
}

interface ApolloResponse {
  people?: ApolloPerson[];
  contacts?: ApolloPerson[];
}

function isMasked(email: string): boolean {
  return email.includes('*') || email.includes('[email');
}

async function searchPeople(params: Record<string, unknown>): Promise<ApolloPerson[]> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify({ ...params, api_key: apiKey }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      console.error('[apollo] HTTP', res.status, await res.text().catch(() => ''));
      return [];
    }
    const data = await res.json() as ApolloResponse;
    return data.people ?? data.contacts ?? [];
  } catch (e) {
    console.error('[apollo] search error:', e);
    return [];
  }
}

export async function fetchApolloLeads(): Promise<Lead[]> {
  if (!process.env.APOLLO_API_KEY) {
    console.log('[apollo] No APOLLO_API_KEY, skipping');
    return [];
  }

  console.log('[apollo] Searching for contacts...');

  // Three searches targeting different buyer profiles for Samuel's services:
  // 1. Founders at micro-startups — most likely to need a site and make the call fast
  // 2. Marketing leads at seed-stage companies — own the website
  // 3. CTOs/product heads at early teams launching something new
  const searches = [
    {
      per_page: 25,
      page: 1,
      person_titles: ['Founder', 'Co-Founder', 'CEO', 'Solo Founder'],
      organization_num_employees_ranges: ['1,10'],
      contact_email_status: ['verified'],
      q_keywords: 'SaaS product startup',
    },
    {
      per_page: 15,
      page: 1,
      person_titles: ['Head of Marketing', 'Marketing Lead', 'Growth Lead', 'CMO', 'VP Marketing'],
      organization_num_employees_ranges: ['1,30'],
      contact_email_status: ['verified'],
      q_keywords: 'startup landing page website',
    },
    {
      per_page: 15,
      page: 1,
      person_titles: ['Founder', 'CEO', 'Product Manager', 'Head of Product'],
      organization_num_employees_ranges: ['1,20'],
      contact_email_status: ['verified'],
      q_keywords: 'no-code design web app',
    },
  ];

  const allPeople: ApolloPerson[] = [];
  for (const params of searches) {
    const people = await searchPeople(params);
    allPeople.push(...people);
  }

  // Deduplicate by id, prefer contacts with revealed emails
  const seenIds = new Set<string>();
  const seenEmails = new Set<string>();
  const deduped = allPeople.filter(p => {
    if (!p.id || seenIds.has(p.id)) return false;
    seenIds.add(p.id);
    if (p.email && !isMasked(p.email)) {
      if (seenEmails.has(p.email)) return false;
      seenEmails.add(p.email);
    }
    return true;
  });

  const withEmail = deduped.filter(p => p.email && !isMasked(p.email));
  const withoutEmail = deduped.filter(p => !p.email || isMasked(p.email));
  console.log(`[apollo] ${deduped.length} contacts (${withEmail.length} with email, ${withoutEmail.length} email locked)`);

  // Include up to 20 contacts without email so user can look them up on LinkedIn
  const contacts = [...withEmail, ...withoutEmail.slice(0, 20)];

  return contacts.map(p => {
    const firstName = p.first_name ?? '';
    const lastName = p.last_name ?? '';
    const name = p.name ?? `${firstName} ${lastName}`.trim();
    const company = p.organization?.name ?? 'Unknown';
    const website = p.organization?.website_url ?? '';
    const desc = p.organization?.short_description ?? '';
    const employees = p.organization?.estimated_num_employees;
    const industry = p.organization?.industry ?? '';

    const descParts = [desc, industry && `Industry: ${industry}`, employees && `Team: ~${employees} people`].filter(Boolean);

    return {
      id: `apollo-${p.id}`,
      title: `${p.title ?? 'Founder'} at ${company}`,
      company,
      description: descParts.join('. ') || `${name} is ${p.title ?? 'a founder'} at ${company}.`,
      url: website,
      source: 'apollo' as const,
      postedAt: new Date().toISOString(),
      contactEmail: p.email && !isMasked(p.email) ? p.email : undefined,
      contactName: name,
      contactTitle: p.title,
    };
  });
}
