import Anthropic from '@anthropic-ai/sdk';
import type { Lead } from '@/types/lead';
import { humanize } from '@/lib/compose';
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
    return [
      `BUSINESS ${i + 1} (ID: ${l.id}):`,
      `Channel: ${channel}`,
      `Business name: ${l.title}`,
      `Type and city: ${l.company}`,
      `Website: ${l.contactLinks?.website ?? 'none'}`,
      `Findings: ${l.description.slice(0, 500)}`,
      `Site text: ${(l.siteText ?? 'none').slice(0, 1800)}`,
    ].join('\n');
  }
  return `PROJECT ${i + 1} (ID: ${l.id}):\nTitle: ${l.title}\nBudget and bids: ${l.company}\nBrief: ${l.description.slice(0, 700)}`;
}

const VOICE = `Voice (strict, applies to every message):
- Write like a real person typing a quick note to one other person. Plain words, short sentences, contractions (I'm, you're, it's).
- Never use em dashes or en dashes. Use a comma or a full stop instead.
- No semicolons, no exclamation marks, no bullet points, no bold.
- Never use: elevate, leverage, seamless, streamline, boost, unlock, transform, stunning, top-notch, cutting-edge, game-changer, delighted, reach out, touch base, I hope this finds you well, I came across, I wanted to.
- Vary how each message opens. No two messages in this batch may start their second sentence the same way.`;

const PROMPTS: Record<DraftKind, string> = {
  apollo: `Draft a short personalised cold email from Samuel Adefila to each person below.

Rules:
- Line 1 is "Subject: ..." (lowercase-feeling, under 7 words, specific to them), then a blank line, then the body
- Open with "Hi [FirstName],"
- Under 110 words
- Mention something specific about their company, then what Samuel would do for their site
- End with one easy question
- Sign off "Samuel"

${VOICE}

Return ONLY valid JSON: {"ID": "Subject: ...\\n\\nBody...", ...}`,

  freelancer: `Write a Freelancer.com bid proposal from Samuel Adefila for each project below. The client reads dozens of bids, so the first line must prove Samuel read their brief.

Rules:
- No subject line. Open with "Hi," then go straight to their specific need
- Under 110 words
- Restate their goal in your own words and name one concrete thing you'd do for it
- Mention one relevant site type Samuel has built
- Give a realistic timeline for this project
- End with one short question about their project
- Sign off "Samuel" and on the next line "adefilasamuel.com"

${VOICE}

Return ONLY valid JSON: {"ID": "proposal text", ...}`,

  places: `Write outreach from Samuel Adefila to each local business below. He found them on Google Maps and looked at their website. "Findings" lists what's wrong, or that they have no website. "Site text" is text scraped from their site.

Step 1, find the person. Look in the business name and site text for the owner, founder, principal or lead practitioner.
- Only use a name when it's clear they run the place: "founded by", "owner", "principal", "Dr. X" at a solo practice, "Hi, I'm X", or a business named after a person (e.g. "Sarah Kim Interiors").
- Never guess or pick a random staff member. If unsure, leave name empty.

Step 2, write the message.
- Greeting: "Hi [FirstName]," when you found a person (use "Hi Dr. [LastName]," for doctors and dentists). If no person but it's clearly a team, "Hi [Business name] team,". Otherwise "Hi there,".
- If Channel is EMAIL: line 1 is "Subject: ..." (under 7 words, about their business, no clickbait), blank line, then body under 110 words.
- If Channel is DM: no subject line, under 65 words. It goes out as an Instagram, Facebook or LinkedIn message.
- One real, specific observation first (their review count and rating, what they specialise in, something from their site text).
- Then ONE issue from the findings in plain words, and what it costs them (e.g. "on a phone the text is tiny, and that's where most people look up a vet").
- No website: say people who find them on Google Maps have nowhere to go to see their work or book.
- Offer one easy next step: a free homepage mockup, no strings.
- Sign off "Samuel" and on the next line "adefilasamuel.com".
- Never state anything that isn't in the findings or site text.

${VOICE}

Return ONLY valid JSON: {"ID": {"name": "First Last or empty string", "role": "Owner / Founder / Dentist etc, or empty string", "message": "..."}, ...}`,
};

type Draft = { message: string; name?: string; role?: string };

async function draftBatch(batch: Lead[], kind: DraftKind): Promise<Map<string, Draft>> {
  const block = batch.map((l, i) => describe(l, i, kind)).join('\n\n---\n\n');
  const prompt = `${PROMPTS[kind]}\n\nAbout Samuel: ${SAMUEL}\n\n${block}`;

  const msg = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const result = new Map<string, Draft>();
  try {
    const c = msg.content[0];
    if (c.type === 'text') {
      const match = c.text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as Record<string, string | Draft>;
        for (const [id, value] of Object.entries(parsed)) {
          const draft = typeof value === 'string' ? { message: value } : value;
          if (draft?.message) result.set(id, { ...draft, message: humanize(draft.message) });
        }
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

  const drafts = new Map<string, Draft>();
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

  const named = [...drafts.values()].filter(d => d.name?.trim()).length;
  if (named) console.log(`[claude] Found owner/founder names for ${named} leads`);

  return leads.map(l => {
    const d = drafts.get(l.id);
    if (!d) return l;
    return {
      ...l,
      proposal: d.message,
      contactName: d.name?.trim() || l.contactName,
      contactTitle: d.role?.trim() || l.contactTitle,
    };
  });
}

// ─── Follow-ups ──────────────────────────────────────────────────────────────

export async function draftFollowUp(lead: Lead): Promise<string> {
  const number = (lead.followUps ?? 0) + 1;
  const since = lead.contactedAt
    ? Math.max(1, Math.round((Date.now() - new Date(lead.contactedAt).getTime()) / 86400000))
    : null;
  const channel = lead.source === 'freelancer' ? 'a Freelancer.com message on his bid'
    : lead.contactEmail ? 'an email reply in the same thread' : 'a short DM';
  const person = lead.contactName && lead.contactName !== lead.title ? lead.contactName : '';

  const prompt = `Samuel Adefila contacted this lead${since ? ` ${since} days ago` : ''} and hasn't heard back. Write follow-up number ${number} of 2, sent as ${channel}.

Lead: ${lead.title} (${lead.company})${person ? `\nPerson: ${person}${lead.contactTitle ? `, ${lead.contactTitle}` : ''}` : ''}
What we know: ${lead.description.slice(0, 400)}

His first message:
"""
${lead.proposal ?? ''}
"""

Rules:
- No subject line. Start with the same greeting style as the first message.
- Follow-up 1: under 60 words. Don't repeat the first message. Add one new, useful thing (a quick idea for their homepage, or offer to send the free mockup this week). End with a yes/no question.
- Follow-up 2: under 45 words. Polite last check-in. Say you won't keep emailing, and leave the door open.
- Never guilt-trip ("just bumping this", "did you see my email"). No fake urgency.
- Sign off "Samuel".

${VOICE}

Return ONLY the message text.`;

  const msg = await getClient().messages.create({
    model: MODEL,
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });
  const c = msg.content[0];
  return c.type === 'text' ? humanize(c.text.replace(/^"""|"""$/g, '')) : '';
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
