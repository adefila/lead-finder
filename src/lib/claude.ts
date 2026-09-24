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
  const input = jobs.map(j => ({ id: j.id, title: j.title, budgetAndBids: j.company, description: j.description.slice(0, 500), source: j.source }));

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `You are ranking client website projects for this freelancer:
${SAMUEL}

Score each project 0-100 for how worth bidding on it is. Weigh three things:
1. Fit: a marketing/business/portfolio/landing site he can build in Framer, Webflow or similar scores high. Heavy custom backend, booking systems, marketplaces or WordPress plugin dev score lower.
2. Budget: USD 250+ fixed or USD 20+/hr is good. Tiny budgets (under USD 50, or INR under 12500) score lower.
3. Competition: fewer bids so far is better. 70+ bids lowers the score.
Use the full range. Return ONLY a JSON array, no commentary: [{"id": "...", "score": 0-100}]

Return ONLY a JSON array, no commentary: [{"id": "...", "score": 0-100}]

Jobs:
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

// ─── Cold email drafts ───────────────────────────────────────────────────────

async function draftEmailBatch(batch: Lead[]): Promise<Map<string, string>> {
  const client = getClient();

  // Apollo leads have a real name + company desc — personalise to them
  // Job board leads get a proposal-style email
  const isApolloLead = (l: Lead) => l.source === 'apollo' && !!l.contactEmail;

  const block = batch
    .map((j, i) => {
      if (isApolloLead(j)) {
        return `CONTACT ${i + 1} (ID: ${j.id}):\nName: ${j.contactName}\nTitle: ${j.contactTitle}\nCompany: ${j.company}\nCompany description: ${j.description.slice(0, 400)}\nWebsite: ${j.url}`;
      }
      return `JOB ${i + 1} (ID: ${j.id}):\nTitle: ${j.title}\nCompany: ${j.company}\nSource: ${j.source}\nDescription: ${j.description.slice(0, 400)}`;
    })
    .join('\n\n---\n\n');

  const hasApollo = batch.some(isApolloLead);
  const prompt = hasApollo
    ? `Draft a short personalised cold email from Samuel Adefila to each person below. These are real people with real email addresses — make it feel like Samuel wrote it specifically to them.

About Samuel: ${SAMUEL}

Rules:
- Start with "Subject: ..." on line 1, then blank line, then body
- Open with their first name: "Hi [FirstName],"
- Under 130 words total
- Reference their specific company or product — show you looked
- Lead with value (what Samuel can do for their situation), not a resume
- One soft CTA at the end ("Would love to show you a quick example — open to a call?")
- Sign as Samuel (no surname in sign-off, just "Samuel")
- No emojis, no "I hope this email finds you well", no "I came across your profile"

Return ONLY valid JSON: {"ID": "Subject: ...\\n\\nBody...", ...}

${block}`
    : `Write a Freelancer.com bid proposal from Samuel Adefila for each project below. The client reads dozens of bids, so the first line must prove Samuel read their brief.

About Samuel: ${SAMUEL}

Rules:
- No subject line, no greeting like "Dear Sir"; open with "Hi," then go straight to their specific need
- Under 120 words
- Line 1-2: restate their goal in your own words and name one concrete thing you would do for it
- Mention one relevant past result or site type from Samuel's experience
- Give a realistic timeline for this specific project
- End with one short question about their project that invites a reply
- Sign off as Samuel, with adefilasamuel.com
- No emojis, no buzzwords, no "I am the perfect fit"

Return ONLY valid JSON: {"ID": "proposal text", ...}

${block}`;

  const msg = await client.messages.create({
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
    console.error('[claude] Email batch parse error:', e);
  }
  return result;
}

export async function generateColdEmails(jobs: Lead[]): Promise<Lead[]> {
  if (!jobs.length) return [];
  console.log(`[claude] Drafting cold emails for ${jobs.length} leads...`);

  const BATCH = 5;
  const results = [...jobs];

  for (let i = 0; i < jobs.length; i += BATCH) {
    const batch = jobs.slice(i, i + BATCH);
    try {
      const map = await draftEmailBatch(batch);
      for (const job of batch) {
        const idx = results.findIndex(r => r.id === job.id);
        if (idx !== -1 && map.has(job.id)) {
          results[idx] = { ...results[idx], proposal: map.get(job.id) };
        }
      }
    } catch (e) {
      console.error(`[claude] Email batch ${Math.floor(i / BATCH) + 1} failed:`, e);
    }
  }
  return results;
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
