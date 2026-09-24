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
  pagination?: { total_entries?: number };
  error?: string;
}

function isMasked(email: string): boolean {
  return email.includes('*') || email.includes('[email') || email.includes('@example');
}

async function searchPeople(params: Record<string, unknown>): Promise<ApolloPerson[]> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify({ ...params, api_key: apiKey }),
      signal: AbortSignal.timeout(15000),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error('[apollo] HTTP', res.status, text.slice(0, 200));
      return [];
    }

    let data: ApolloResponse;
    try { data = JSON.parse(text); } catch { console.error('[apollo] JSON parse failed'); return []; }

    if (data.error) { console.error('[apollo] API error:', data.error); return []; }

    const people = data.people ?? data.contacts ?? [];
    console.log(`[apollo] search returned ${people.length} people (total: ${data.pagination?.total_entries ?? '?'})`);
    return people;
  } catch (e) {
    console.error('[apollo] fetch error:', e);
    return [];
  }
}

export async function fetchApolloLeads(): Promise<Lead[]> {
  if (!process.env.APOLLO_API_KEY) {
    console.log('[apollo] No APOLLO_API_KEY, skipping');
    return [];
  }

  console.log('[apollo] Searching for contacts...');

  // Broad searches — we take whoever Apollo returns and let Claude draft a personalised email
  const searches = [
    // Small startup founders who build products and need websites
    {
      per_page: 25,
      page: 1,
      person_titles: ['Founder', 'Co-Founder', 'CEO'],
      organization_num_employees_ranges: ['1,10'],
    },
    // Marketing / growth people who own the website
    {
      per_page: 15,
      page: 1,
      person_titles: ['Head of Marketing', 'CMO', 'VP Marketing', 'Growth Lead', 'Marketing Manager'],
      organization_num_employees_ranges: ['1,50'],
    },
    // Product people at very small teams
    {
      per_page: 15,
      page: 1,
      person_titles: ['Product Manager', 'Head of Product', 'CPO'],
      organization_num_employees_ranges: ['1,20'],
    },
  ];

  const allPeople: ApolloPerson[] = [];
  for (const params of searches) {
    const people = await searchPeople(params);
    allPeople.push(...people);
  }

  console.log(`[apollo] ${allPeople.length} total people before dedup`);

  // Dedup by id
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
  const locked = deduped.filter(p => !p.email || isMasked(p.email));
  console.log(`[apollo] ${deduped.length} unique: ${withEmail.length} with email, ${locked.length} locked`);

  // Include verified emails first, then up to 20 locked contacts (user looks them up manually)
  const contacts = [...withEmail, ...locked.slice(0, 20)];

  return contacts.map(p => {
    const name = p.name ?? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
    const company = p.organization?.name ?? 'Unknown';
    const website = p.organization?.website_url ?? '';
    const desc = p.organization?.short_description ?? '';
    const employees = p.organization?.estimated_num_employees;
    const industry = p.organization?.industry ?? '';

    const descParts = [desc, industry && `Industry: ${industry}`, employees && `~${employees} people`].filter(Boolean);

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
