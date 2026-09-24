import Anthropic from '@anthropic-ai/sdk';
import type { Lead } from '@/types/lead';
import type { Post } from '@/types/post';

const MODEL = 'claude-haiku-4-5-20251001';

const SAMUEL = `
Samuel Adefila is a Top-Rated Framer developer (Upwork, 100% Job Success Score, 50+ sites delivered).
He specialises in: Figma-to-Framer conversions, landing pages, marketing sites, SaaS websites, portfolio sites, startup homepages, template customisation, Webflow migrations to Framer.
Typical turnaround: 14 days. Portfolio: adefilasamuel.com.
He works with startups, SaaS companies, agencies, solo founders, and anyone who needs a polished web presence fast.
Good lead signals: needs a website, landing page, or redesign; mentions Framer/Figma/Webflow/no-code; is a founder or early-stage startup; launching a product; needs a designer or front-end developer for web.
`.trim();

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// ─── Job lead scoring ────────────────────────────────────────────────────────

export async function scoreJobs(jobs: Lead[]): Promise<Lead[]> {
  if (!jobs.length) return [];
  console.log(`[claude] Scoring ${jobs.length} jobs...`);

  const client = getClient();
  const input = jobs.map(j => ({
    id: j.id,
    source: j.source,
    title: j.title,
    context: j.company,
    description: j.description.slice(0, 500),
    hasEmail: !!j.contactEmail,
    hasPhone: !!j.contactPhone,
  }));

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `You are ranking website leads for this freelancer:
${SAMUEL}

Score each lead 0-100 for how likely it is to turn into a paid website project. Use the full range.

For source "freelancer" (a client posted a website project; "context" holds budget and bid count):
- Fit: marketing/business/portfolio/landing sites he can build in Framer or Webflow score high. Heavy custom backend, booking systems, marketplaces or plugin dev score lower.
- Budget: USD 250+ fixed or USD 20+/hr is good. Under USD 50, or INR under 12500, scores low.
- Competition: fewer bids is better. 70+ bids lowers the score.

For source "places" (a local business found on Google with no website or a weak one):
- Established business (many Google reviews, good rating) with no website or a clearly outdated/broken one scores high.
- Higher-ticket industries (dental, legal, med spa, real estate, architecture, contractors) score higher than low-margin ones.
- hasEmail adds points (easy to reach). No email but a phone number is still workable.
- Minor issues only (e.g. just an old copyright year) score lower.

For source "apollo": founders/marketers at small companies; score on how likely their company needs a better site.

Return ONLY a JSON array, no commentary: [{"id": "...", "score": 0-100}]

Leads:
${JSON.stringify(input)}`,
    }],
  });

  let scored: { id: string; score: number }[] = [];
  try {
    const c = msg.content[0];
    if (c.type === 'text') {
      const match = c.text.match(/\[[\s\S]*\]/);
      if (match) scored = JSON.parse(match[0]);
    }
  } catch {
    // Parsing failed — pass everything at score 50 so the human can review
    return jobs.map(j => ({ ...j, score: 50 })).slice(0, 50);
  }

  // If Claude returned no scores, same fallback
  if (!scored.length) return jobs.map(j => ({ ...j, score: 50 })).slice(0, 50);

  const map = new Map(scored.map(s => [s.id, s.score]));
  return jobs
    .map(j => ({ ...j, score: map.get(j.id) ?? 50 }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

// ─── Outreach drafts ─────────────────────────────────────────────────────────

type DraftKind = 'apollo' | 'freelancer' | 'places';

function draftKind(l: Lead): DraftKind {
  if (l.source === 'places') return 'places';
  if (l.source === 'apollo') return 'apollo';
  return 'freelancer';
}

function describe(l: Lead, i: number, kind: DraftKind): string {
  if (kind === 'apollo') {
    return `CONTACT ${i + 1} (ID: ${l.id}):\nName: ${l.contactName}\nTitle: ${l.contactTitle}\nCompany: ${l.company}\nCompany description: ${l.description.slice(0, 400)}\nWebsite: ${l.url}`;
  }
  if (kind === 'places') {
    const channel = l.contactEmail ? 'EMAIL' : 'DM';
    return `BUSINESS ${i + 1} (ID: ${l.id}):\nChannel: ${channel}\nBusiness: ${l.contactName}\nType and city: ${l.company}\nWebsite: ${l.contactLinks?.website ?? 'none'}\nFindings: ${l.description.slice(0, 500)}`;
  }
  return `PROJECT ${i + 1} (ID: ${l.id}):\nTitle: ${l.title}\nBudget and bids: ${l.company}\nBrief: ${l.description.slice(0, 700)}`;
}

const PROMPTS: Record<DraftKind, string> = {
  apollo: `Draft a short personalised cold email from Samuel Adefila to each person below. These are real people with real email addresses — make it feel like Samuel wrote it specifically to them.

Rules:
- Start with "Subject: ..." on line 1, then blank line, then body
- Open with their first name: "Hi [FirstName],"
- Under 130 words total
- Reference their specific company or product — show you looked
- Lead with value (what Samuel can do for their situation), not a resume
- One soft CTA at the end
- Sign as Samuel
- No emojis, no "I hope this email finds you well", no "I came across your profile"

Return ONLY valid JSON: {"ID": "Subject: ...\\n\\nBody...", ...}`,

  freelancer: `Write a Freelancer.com bid proposal from Samuel Adefila for each project below. The client reads dozens of bids, so the first line must prove Samuel read their brief.

Rules:
- No subject line, no greeting like "Dear Sir"; open with "Hi," then go straight to their specific need
- Under 120 words
- Line 1-2: restate their goal in your own words and name one concrete thing you would do for it
- Mention one relevant past result or site type from Samuel's experience
- Give a realistic timeline for this specific project
- End with one short question about their project that invites a reply
- Sign off as Samuel, with adefilasamuel.com
- No emojis, no buzzwords, no "I am the perfect fit"

Return ONLY valid JSON: {"ID": "proposal text", ...}`,

  places: `Write outreach from Samuel Adefila to each local business below. Samuel found them on Google Maps and checked their website. The findings list exactly what is wrong (or that they have no website).

Rules:
- If Channel is EMAIL: start with "Subject: ..." on line 1 (specific, under 8 words, no clickbait), blank line, then the body. Under 120 words.
- If Channel is DM: no subject line. Under 70 words; it will be sent as an Instagram/Facebook/LinkedIn message or website contact form.
- Open with "Hi [Business name] team," then one genuine, specific observation (e.g. their strong Google rating) before the problem
- State ONE concrete issue from the findings in plain, non-technical words and why it costs them customers (e.g. "on a phone the site is hard to read, and most people searching for a dentist are on their phone")
- If they have no website: point out that people who find them on Google Maps have nowhere to go to learn more or book
- Offer something low-commitment: a free homepage mockup or a quick 10-minute call
- Sign as Samuel, adefilasamuel.com
- Never invent facts beyond the findings. No emojis, no flattery, no "I hope this finds you well"

Return ONLY valid JSON: {"ID": "message text", ...}`,
};

async function draftBatch(batch: Lead[], kind: DraftKind): Promise<Map<string, string>> {
  const block = batch.map((l, i) => describe(l, i, kind)).join('\n\n---\n\n');
  const prompt = `${PROMPTS[kind]}\n\nAbout Samuel: ${SAMUEL}\n\n${block}`;

  const msg = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const result = new Map<string, string>();
  try {
    const c = msg.content[0];
    if (c.type === 'text') {
      const match = c.text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as Record<string, string>;
        for (const [id, draft] of Object.entries(parsed)) result.set(id, draft);
      }
    }
  } catch (e) {
    console.error(`[claude] ${kind} draft parse error:`, e);
  }
  return result;
}

export async function generateColdEmails(leads: Lead[]): Promise<Lead[]> {
  if (!leads.length) return [];
  console.log(`[claude] Drafting outreach for ${leads.length} leads...`);

  const drafts = new Map<string, string>();
  const BATCH = 5;
  for (const kind of ['freelancer', 'places', 'apollo'] as DraftKind[]) {
    const group = leads.filter(l => draftKind(l) === kind);
    for (let i = 0; i < group.length; i += BATCH) {
      try {
        const map = await draftBatch(group.slice(i, i + BATCH), kind);
        map.forEach((v, k) => drafts.set(k, v));
      } catch (e) {
        console.error(`[claude] ${kind} batch failed:`, e);
      }
    }
  }

  return leads.map(l => (drafts.has(l.id) ? { ...l, proposal: drafts.get(l.id) } : l));
}

// Keep backward compat
export async function generateAllProposals(jobs: Lead[]): Promise<Lead[]> {
  return generateColdEmails(jobs);
}

// ─── Post scoring + reply drafts ─────────────────────────────────────────────

export async function scoreAndDraftPosts(posts: Post[]): Promise<Post[]> {
  if (!posts.length) return [];
  console.log(`[claude] Scoring ${posts.length} posts...`);

  const client = getClient();
  const input = posts.map(p => ({ id: p.id, title: p.title, snippet: p.snippet.slice(0, 300), platform: p.platform }));

  const scoreMsg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `Score these posts 0-100 for how good a reply opportunity they are for Samuel Adefila.

Samuel: ${SAMUEL}

High score (70-100): person/startup ACTIVELY HIRING or requesting a web designer, landing page, Framer/Webflow site, or website redesign; a client project on Upwork/Freelancer; "I need a website built"; just launched on Product Hunt (potential client needing a better site).
Medium score (30-69): discussions about web design tools, startup websites, design trends — could naturally prompt Samuel to reach out.
Low score (0-29): general tech/engineering discussion with no web design angle, no hiring intent, fully off-topic — AI tools, backend APIs, mobile apps.

Return ONLY JSON array: [{"id": "...", "score": 0-100}]

Posts:
${JSON.stringify(input)}`,
    }],
  });

  let scored: { id: string; score: number }[] = [];
  try {
    const c = scoreMsg.content[0];
    if (c.type === 'text') {
      const match = c.text.match(/\[[\s\S]*\]/);
      if (match) scored = JSON.parse(match[0]);
    }
  } catch {
    console.error('[claude] Post scoring parse failed, using fallback scores');
  }

  // Fallback: if scoring failed or returned nothing, pass all posts at 50
  const map = scored.length
    ? new Map(scored.map(s => [s.id, s.score]))
    : new Map(posts.map(p => [p.id, 50]));

  const filtered = posts
    .map(p => ({ ...p, score: map.get(p.id) ?? 50 }))
    .filter(p => (p.score ?? 0) >= 20)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 40);

  console.log(`[claude] ${filtered.length} posts passed filter. Drafting replies...`);

  const BATCH = 5;
  const withReplies = [...filtered];

  for (let i = 0; i < filtered.length; i += BATCH) {
    const batch = filtered.slice(i, i + BATCH);
    const block = batch
      .map((p, n) => `POST ${n + 1} (ID: ${p.id}):\nPlatform: ${p.platform}\nTitle: ${p.title}\nContent: ${p.snippet.slice(0, 350)}`)
      .join('\n\n---\n\n');

    try {
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `Write a short, helpful reply Samuel Adefila can post on ${batch[0].platform === 'reddit' ? 'Reddit' : 'Hacker News'} for each post.

Samuel: ${SAMUEL}

Rules:
- 2-4 sentences max
- Lead with genuine insight or value first
- Naturally mention Samuel's work at the end if relevant (not forced)
- Sound like a real person, not marketing
- Don't start with "As a Framer developer..."
- Match the platform's casual tone
- No emojis

Return ONLY JSON, no explanation: {"POST_ID": "reply text", ...}

${block}`,
        }],
      });

      const c = msg.content[0];
      if (c.type === 'text') {
        const match = c.text.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]) as Record<string, string>;
          for (const post of batch) {
            const idx = withReplies.findIndex(r => r.id === post.id);
            if (idx !== -1 && parsed[post.id]) {
              withReplies[idx] = { ...withReplies[idx], replyDraft: parsed[post.id] };
            }
          }
        }
      }
    } catch (e) {
      console.error(`[claude] Reply batch error:`, e);
    }
  }

  return withReplies;
}
