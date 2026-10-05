import Anthropic from '@anthropic-ai/sdk';
import type { Lead } from '@/types/lead';
import { humanize } from '@/lib/compose';
import { systemsFor } from '@/lib/leadview';

const MODEL = 'claude-haiku-4-5-20251001';

const SAMUEL = `
Samuel Adefila is a Top-Rated Framer developer (Upwork, 100% Job Success Score, 50+ sites delivered).
He specialises in: Figma-to-Framer conversions, landing pages, marketing sites, SaaS websites, portfolio sites, startup homepages, template customisation, Webflow migrations to Framer.
Typical turnaround: 14 days. Portfolio: adefilasamuel.com.
He works with startups, SaaS companies, agencies, solo founders, and anyone who needs a polished web presence fast.
For local businesses he also sets up simple systems that save time: online booking with reminders, quote and enquiry forms that go straight to the owner's phone, automatic review requests, and follow-up on quiet quotes. Many local businesses need one of these more than a new website.
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

For source "remote" (a remote job or contract from a job board, open to someone based in Nigeria): hands-on Framer, Webflow, WordPress, Shopify, landing page or UI/UX roles score high (70-90). Generic senior software engineering or roles needing deep backend skills score lower. A listing that names the UK, Germany or Australia adds points.

For source "tender" (a public buyer in Germany, Austria, Ireland or Australia put a website project out to bid; "context" holds buyer, country and deadline): a website design, redesign or relaunch for a single organisation, with bids in English, scores high (65-85). A German-only tender scores lower (40-60). Multi-year frameworks, hosting-only or maintenance-only contracts, heavy IT systems, or estimated values over EUR 500,000 score low (15-35), because a solo freelancer rarely wins them. A deadline less than a week away lowers the score.

For source "freelancer" (a client posted a website project; "context" holds budget and bid count):
- Fit: marketing/business/portfolio/landing sites he can build in Framer or Webflow score high. Heavy custom backend, booking systems, marketplaces or plugin dev score lower.
- Budget: USD 250+ fixed or USD 20+/hr is good. Under USD 50, or INR under 12500, scores low.
- Competition: fewer bids is better. 70+ bids lowers the score.

For source "places" (a local business found on Google with no website or a weak one):
- Established business (many Google reviews, good rating) with no website or a clearly outdated/broken one scores high.
- Higher-ticket industries (dental, legal, med spa, real estate, architecture, contractors) score higher than low-margin ones.
- hasEmail adds points (easy to reach). No email but a phone number is still workable.
- Minor issues only (e.g. just an old copyright year) score lower.

For source "osm" (a local business from OpenStreetMap whose website is online but weak): score like "places"; they have no review data, so judge on trade value and how clear the website problems are.

For source "companies_house" (a UK company registered in the last few weeks): a brand-new customer-facing business with no website is a strong lead (70-90). Higher-ticket trades (dental, legal, estate agency, architects, clinics) score higher. hasEmail adds points; a named director is workable via LinkedIn. Deduct if the "company" looks like a holding or shell company.

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

type DraftKind = 'freelancer' | 'places' | 'newco' | 'remote' | 'tender';

function draftKind(l: Lead): DraftKind {
  if (l.source === 'places' || l.source === 'osm') return 'places';
  if (l.source === 'companies_house') return 'newco';
  if (l.source === 'remote') return 'remote';
  if (l.source === 'tender') return 'tender';
  return 'freelancer';
}

// Each local-business message gets a different way in. Reviews are only one option among many.
const PLACES_ANGLES = [
  'SITE DETAIL: open with something specific from their site text (a service they offer, how long they have been running, who they help, their story). If the site text has nothing usable, use their trade and city instead.',
  'CUSTOMER VIEW: open by describing, in one or two sentences, what a customer experiences when they look them up on a phone today.',
  'LOCAL: open with their town or neighbourhood and the people there searching for their kind of business.',
  'STRAIGHT TO IT: no warm-up. First sentence states who Samuel is in a few words and why he is writing to them specifically.',
  'THEIR GOAL: open with what a business like theirs usually wants more of (bookings, calls, enquiries, walk-ins) and connect it to what you noticed.',
  'REPUTATION: open with how customers talk about them (review count or rating). Only use this if the findings mention reviews.',
];

function angleFor(l: Lead, slot: number): string {
  const hasReviews = /review/i.test(l.description);
  const pool = hasReviews ? PLACES_ANGLES : PLACES_ANGLES.slice(0, -1);
  return pool[slot % pool.length];
}

function describe(l: Lead, i: number, kind: DraftKind, angleBase = 0): string {
  if (kind === 'places') {
    const channel = l.contactEmail ? 'EMAIL' : 'DM';
    return [
      `BUSINESS ${i + 1} (ID: ${l.id}):`,
      `Channel: ${channel}`,
      `Angle: ${angleFor(l, angleBase + i)}`,
      `Business name: ${l.title}`,
      `Type and city: ${l.company}`,
      `Website: ${l.contactLinks?.website ?? 'none'}`,
      `Idea to offer: ${systemsFor(l)[0] ?? 'none'}`,
      `Findings: ${l.description.slice(0, 500)}`,
      `Site text: ${(l.siteText ?? 'none').slice(0, 1800)}`,
    ].join('\n');
  }
  if (kind === 'newco') {
    return [
      `COMPANY ${i + 1} (ID: ${l.id}):`,
      `Channel: ${l.contactEmail ? 'EMAIL' : 'LINKEDIN'}`,
      `Company: ${l.title}`,
      `Trade and town: ${l.company}`,
      `Director: ${l.contactName ?? 'unknown'}`,
      `Idea to offer: ${systemsFor(l)[0] ?? 'none'}`,
      `Findings: ${l.description.slice(0, 400)}`,
      `Site text: ${(l.siteText ?? 'none').slice(0, 1200)}`,
    ].join('\n');
  }
  if (kind === 'remote') {
    return `ROLE ${i + 1} (ID: ${l.id}):\nRole: ${l.title}\nCompany and terms: ${l.company}\nListing: ${l.description.slice(0, 900)}`;
  }
  if (kind === 'tender') {
    return `TENDER ${i + 1} (ID: ${l.id}):\nTitle: ${l.title}\nBuyer, country and deadline: ${l.company}\nNotice: ${l.description.slice(0, 900)}`;
  }
  return `PROJECT ${i + 1} (ID: ${l.id}):\nTitle: ${l.title}\nBudget and bids: ${l.company}\nBrief: ${l.description.slice(0, 700)}`;
}

const VOICE = `Voice (strict, applies to every message):
- Warm, clear and professional: an experienced freelancer writing to a business owner he respects. It should read like one person wrote it by hand for this one reader.
- Plain English and full sentences. Contractions are fine. No slang, no hype, no jokes, no over-familiarity.
- Short paragraphs of one to three sentences, with a blank line between them.
- Never use em dashes or en dashes (— or –) anywhere, including the subject. Use a comma, a full stop or "and" instead.
- No semicolons, no exclamation marks, no bullet points, no bold, no emojis, no ALL CAPS.
- Never use: elevate, leverage, seamless, streamline, boost, unlock, transform, stunning, top-notch, cutting-edge, game-changer, delighted, reach out, touch base, circle back, synergy, I hope this finds you well, I came across, I wanted to, quick question.
- Be specific and honest. Never exaggerate or promise results you can't know.
- No flattery formulas ("says a lot about", "clearly passionate", "impressive work"). If you compliment, make it concrete and brief, and skip it entirely when there's nothing real to say.
- Vary how each message opens. No two messages in this batch may start their second sentence the same way.`;

const PROMPTS: Record<DraftKind, string> = {
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

  remote: `Write a short application note from Samuel Adefila for each remote role below. It goes in the job board's application form or cover letter box. Hiring managers skim, so the first line must show he read the listing.

Rules:
- No subject line. Open with "Hi," (or "Hi [Company] team,")
- Under 130 words
- Name the one thing in the listing that matches Samuel best (Framer, Webflow, WordPress, Shopify, landing pages, UI design) and give one concrete example of similar work
- Mention he works remotely from Nigeria on GMT+1, which overlaps fully with UK and European hours
- Point to his portfolio at adefilasamuel.com
- End with one easy next step (a short call, or a small paid test task)
- Sign off "Samuel"
- Never claim a skill, tool or years of experience the listing asks for unless Samuel's profile above shows it

${VOICE}

Return ONLY valid JSON: {"ID": "note text", ...}`,

  tender: `For each public tender below, write a short plain-English brief for Samuel Adefila, followed by an opening paragraph he can adapt for his bid. Titles and scope may be in German: translate them.

Format (plain text, no headings, no bullets):
- First paragraph, starting "What they want:": one or two sentences on what the buyer is asking for, in English.
- Second paragraph, starting "Before you bid:": one or two sentences on what to check first, based only on the notice (bid language, deadline, whether it looks like a small website job or a large framework). Never invent requirements the notice does not show.
- Third paragraph, starting "Opening for your bid:": three or four sentences in Samuel's voice, in the bid language if the notice names only German, otherwise English. Restate the buyer's goal, name one concrete thing he would do for it, and mention his portfolio at adefilasamuel.com.
- Under 170 words in total.

${VOICE}

Return ONLY valid JSON: {"ID": "brief text", ...}`,

  places: `Write outreach from Samuel Adefila to each local business below. He found them on Google Maps and looked at their website. "Findings" lists what's wrong, or that they have no website. "Site text" is text scraped from their site.

Step 1, find the person. Look in the business name and site text for the owner, founder, principal or lead practitioner.
- Only use a name when it's clear they run the place: "founded by", "owner", "principal", "Dr. X" at a solo practice, "Hi, I'm X", or a business named after a person (e.g. "Sarah Kim Interiors").
- Never guess or pick a random staff member. If unsure, leave name empty.

Step 2, write the message.
- Greeting: "Hi [FirstName]," when you found a person (use "Hi Dr. [LastName]," for doctors and dentists). If no person but it's clearly a team, "Hi [Business name] team,". Otherwise "Hi there,".
- If Channel is EMAIL: line 1 is "Subject: ..." (under 7 words, about their business, no clickbait), blank line, then body under 110 words.
- If Channel is DM: no subject line, under 65 words. It goes out as an Instagram, Facebook or LinkedIn message.
- Open the way the "Angle" line says. Every business gets a different angle on purpose, so the batch never reads like one template.
- Do not mention star ratings or review counts unless the angle is REPUTATION. Never open with "X reviews at Y stars".
- Lead with the "Idea to offer": a simple system that saves them time or brings in customers, described in plain words and tied to their kind of business. Not every business needs a new website, so do not pitch a website first.
- Then, only if it fits naturally, mention ONE website issue from the findings in plain words (e.g. "on a phone the text is tiny"). Never use words like HTTPS, SEO, viewport, load time, optimisation or automation.
- No website: you may add that people who find them on Google have nowhere to click through to, but keep the idea as the main point.
- Offer ONE easy next step and vary it between messages: a short one-page note of ideas for their business, a quick demo of how it would work for them, or a ten-minute call. Don't reuse "no strings attached" in every message.
- Vary length (some messages 60 words, some closer to 100) and sentence rhythm. Write it the way Samuel would type it himself, not as a sales script.
- Sign off "Samuel" and on the next line "adefilasamuel.com".
- Close the body with one short opt-out line before the sign-off, phrased naturally, e.g. "If it's not something you need, just say so and I won't follow up."
- Never state anything that isn't in the findings or site text.

${VOICE}

Return ONLY valid JSON: {"ID": {"name": "First Last or empty string", "role": "Owner / Founder / Dentist etc, or empty string", "message": "..."}, ...}`,

  newco: `Write a short, warm note from Samuel Adefila to the director of each newly registered UK company below. They set the company up in the last few weeks. Samuel builds websites and simple systems that save small businesses time.

Rules:
- Greet the director by first name ("Hi Sarah,"). If Director is unknown, use "Hi there,".
- Open by congratulating them on starting the company, naturally and briefly. Don't say how you found them beyond "saw you recently set up [Company]".
- Lead with the "Idea to offer": setting it up from day one saves them time as they grow. Mention that a simple site helps them look established only as a second point, if at all.
- If they have a website with issues: mention ONE issue from the findings in plain words.
- Offer one easy next step: a short note of ideas for their business, or a short call.
- If Channel is EMAIL: line 1 "Subject: ..." (under 7 words), blank line, body under 100 words, sign off "Samuel" then "adefilasamuel.com".
- If Channel is LINKEDIN: no subject, under 280 characters in total (LinkedIn connection note limit), sign off "Samuel".
- Close with one short opt-out line when Channel is EMAIL.
- Never state anything that isn't in the findings.

${VOICE}

Return ONLY valid JSON: {"ID": {"name": "", "role": "", "message": "..."}, ...}`,
};

type Draft = { message: string; name?: string; role?: string };

async function draftBatch(batch: Lead[], kind: DraftKind): Promise<Map<string, Draft>> {
  // Random start per batch: neighbours differ, and a rewrite gets a fresh angle.
  const angleBase = Math.floor(Math.random() * PLACES_ANGLES.length);
  const block = batch.map((l, i) => describe(l, i, kind, angleBase)).join('\n\n---\n\n');
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
  for (const kind of ['freelancer', 'places', 'newco', 'remote', 'tender'] as DraftKind[]) {
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
    : lead.source === 'remote' ? 'a short follow-up to the hiring manager about his application'
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
