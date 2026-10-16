import Anthropic from '@anthropic-ai/sdk';
import type { Lead } from '@/types/lead';
import { humanize } from '@/lib/compose';
import { systemsFor, hasCheck, leadLanguage, LANGUAGE_NAME } from '@/lib/leadview';

const MODEL = 'claude-haiku-4-5-20251001';

const SAMUEL = `
Samuel Adefila is a Top-Rated Framer developer (Upwork, 100% Job Success Score, 50+ sites delivered).
He specialises in: Figma-to-Framer conversions, landing pages, marketing sites, SaaS websites, portfolio sites, startup homepages, template customisation, Webflow migrations to Framer.
He also does UI/UX and product design in Figma, and front-end product engineering.
Typical turnaround: 14 days. Portfolio: adefilasamuel.com.
He works with startups, SaaS companies, agencies, solo founders, and anyone who needs a polished web presence fast.
For local businesses he also sets up simple systems that save time: online booking with reminders, quote and enquiry forms that go straight to the owner's phone, automatic review requests, and follow-up on quiet quotes. Many local businesses need one of these more than a new website.
Good lead signals: needs a website, landing page, or redesign; mentions Framer/Figma/Webflow/no-code; is a founder or early-stage startup; launching a product; needs a designer or front-end developer for web.
`.trim();

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// ─── Job lead scoring ────────────────────────────────────────────────────────

// Leads below this score are not saved, and saved ones still in To contact move to Skipped.
export const MIN_FIT = Number(process.env.MIN_FIT_SCORE ?? 65);
const SCORE_BATCH = 40;

// Scores every lead 0-100. Done in batches so a long list never cuts the answer short. A lead
// whose batch fails comes back without a score: it is not saved this time and is tried again
// on the next search.
export async function scoreJobs(jobs: Lead[]): Promise<Lead[]> {
  if (!jobs.length) return [];
  console.log(`[claude] Scoring ${jobs.length} leads in batches of ${SCORE_BATCH}...`);
  const batches: Lead[][] = [];
  for (let i = 0; i < jobs.length; i += SCORE_BATCH) batches.push(jobs.slice(i, i + SCORE_BATCH));
  const scores = new Map<string, number>();
  for (let i = 0; i < batches.length; i += 3) {
    const results = await Promise.all(batches.slice(i, i + 3).map(b => scoreBatch(b).catch(e => {
      console.error('[claude] scoring batch failed:', (e as Error).message);
      return new Map<string, number>();
    })));
    results.forEach(m => m.forEach((v, k) => scores.set(k, v)));
  }
  const unscored = jobs.filter(j => !scores.has(j.id)).length;
  if (unscored) console.warn(`[claude] ${unscored} leads got no score; they will be tried again next search`);
  return jobs
    .map(j => ({ ...j, score: scores.get(j.id) }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

async function scoreBatch(jobs: Lead[]): Promise<Map<string, number>> {
  const input = jobs.map(j => ({
    id: j.id,
    source: j.source,
    title: j.title,
    context: j.company,
    description: j.description.slice(0, 500),
    hasEmail: !!j.contactEmail,
    hasPhone: !!j.contactPhone,
  }));

  const msg = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `You are ranking leads for this freelancer:
${SAMUEL}

Score each lead 0-100 for how good a fit it is for Samuel: how likely it is to turn into paid work he is well suited to and would win.

Be strict. Samuel only wants his best-fit leads, and only leads scoring ${MIN_FIT} or more are kept.
- ${MIN_FIT}-100: clearly a strong fit. You could name the specific reason in one sentence (the exact niche skill the role asks for, or the clear website or system problem this business has and can afford to fix).
- 50-${MIN_FIT - 1}: plausible but generic, unclear, or missing something important. These are dropped.
- Below 50: a poor fit, a long shot, or not really his kind of work.
Most leads in a batch should score below ${MIN_FIT}. When unsure, score lower.

For source "remote" (a remote job or contract from a job board, open to someone based in Nigeria): hands-on Framer, Webflow, landing page, marketing website, product design, UI/UX or product engineering roles score high (70-90). Generic senior software engineering or roles needing deep backend skills score lower. A listing that names the UK, Germany or Australia adds points.

For source "job" (a full-time role in Samuel's niche; the description starts "Open to: ..." for a remote role open to someone in Nigeria, or "Relocation: <country>" for an on-site role abroad that offers visa sponsorship or relocation): hands-on Framer, Webflow, landing page, marketing website, product design, UI/UX or product engineering roles score high (70-90). Relocation roles in the UK, Ireland, Canada, Australia, the Netherlands or Luxembourg add points. Generic senior software engineering or roles needing deep backend skills score lower. A listing that asks for existing work authorisation scores low (10-30).

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

  const c = msg.content[0];
  const match = c?.type === 'text' ? c.text.match(/\[[\s\S]*\]/) : null;
  if (!match) throw new Error('no JSON in the answer');
  const scored = JSON.parse(match[0]) as { id: string; score: number }[];
  return new Map(scored.filter(s => typeof s.score === 'number').map(s => [s.id, Math.max(0, Math.min(100, Math.round(s.score)))]));
}

// ─── Outreach drafts ─────────────────────────────────────────────────────────

type DraftKind = 'job' | 'places' | 'newco' | 'remote' | 'inbound' | 'visitor';

function draftKind(l: Lead): DraftKind {
  if (l.source === 'places' || l.source === 'osm') return 'places';
  if (l.source === 'companies_house') return 'newco';
  if (l.source === 'remote') return 'remote';
  if (l.source === 'website') return 'inbound';
  if (l.source === 'visitor') return 'visitor';
  return 'job';
}

// Each local-business message uses a different fact as the one-line "why I'm writing to you".
const PLACES_ANGLES = [
  'SITE DETAIL: something specific from their site text (a service they offer, how they take bookings or enquiries, how long they have been running).',
  'CUSTOMER VIEW: what a customer can or can\'t do when they find them on a phone today (book, ask for a quote, see prices).',
  'LOCAL: their town or neighbourhood and the people there looking for their kind of business.',
  'THEIR GOAL: what a business like theirs wants more of (bookings, calls, enquiries, walk-ins), tied to one thing you noticed.',
  'REPUTATION: how customers talk about them (review count or rating). Only use this if the findings mention reviews.',
];

// How the first line grabs them. Rotated separately from the angle, so pairs never repeat.
// None of them opens with "I'm a web developer": the reader cares about their business first.
const HOOKS = [
  'OUTCOME: open with what would change for their customers, using the business name. A statement, not a question. E.g. "Bright Smile\'s patients could book a check-up at 10pm and get a reminder text the day before."',
  'PROOF: open with the proof point most relevant to them, then connect it to them in the next sentence. E.g. "The last booking app I designed paid out over $10K to its users in its first month. I\'d like to set up something simpler for Bright Smile." Do not repeat a proof point later in the message.',
  'OFFER: open with the offer itself in one plain line. E.g. "I\'d like to set up online booking for Bright Smile, at a fixed price and live in two weeks."',
  'CUSTOMER MOMENT: open with one short, concrete moment from a customer\'s day, in two short sentences at most. E.g. "It\'s 10pm and someone nearby wants a check-up next week. Right now they have to wait until morning to call Bright Smile."',
];

function angleFor(l: Lead, slot: number): string {
  const hasReviews = /review/i.test(l.description);
  const pool = hasReviews ? PLACES_ANGLES : PLACES_ANGLES.slice(0, -1);
  return pool[slot % pool.length];
}

function describe(l: Lead, i: number, kind: DraftKind, angleBase = 0, hookBase = 0): string {
  if (kind === 'places') {
    const channel = l.contactEmail ? 'EMAIL' : 'DM';
    return [
      `BUSINESS ${i + 1} (ID: ${l.id}):`,
      `Channel: ${channel}`,
      `Language: ${LANGUAGE_NAME[leadLanguage(l)]}`,
      `Hook: ${HOOKS[(hookBase + i) % HOOKS.length]}`,
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
  if (kind === 'inbound') {
    return [
      `ENQUIRY ${i + 1} (ID: ${l.id}):`,
      `From: ${l.contactName ?? 'unknown'} <${l.contactEmail}>`,
      `Company or name: ${l.title}`,
      `Details: ${l.company}`,
      `Their website: ${l.contactLinks?.website ?? 'none given'}`,
      `What they wrote: ${l.description.slice(0, 1500)}`,
    ].join('\n');
  }
  if (kind === 'visitor') {
    return [
      `COMPANY ${i + 1} (ID: ${l.id}):`,
      `Company: ${l.title}`,
      `Website: ${l.contactLinks?.website ?? 'none'}`,
      `Site text: ${(l.siteText ?? 'none').slice(0, 1500)}`,
    ].join('\n');
  }
  return [
    `ROLE ${i + 1} (ID: ${l.id}):`,
    `Channel: ${l.contactEmail ? `EMAIL to ${l.contactEmail}` : 'APPLICATION'}`,
    `Role: ${l.title}`,
    `Company, country and terms: ${l.company}`,
    `Listing: ${l.description.slice(0, 900)}`,
    l.contactEmail ? `Company site text: ${(l.siteText ?? 'none').slice(0, 1500)}` : '',
  ].filter(Boolean).join('\n');
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

// How every cold message is built: a short, confident introduction of Samuel with one
// offer and one proof point. The long "observation, why it matters, free advice" shape read
// like every other cold email and every blog template, so it is gone.
const PROOF = `Proof points (true, use at most ONE per message and vary which):
- Top Rated on Upwork, 100% Job Success, 50+ projects delivered.
- He designed BookedEZ, a booking app that paid out over $10K to artists and event organisers in its first month.
- He built the landing page for The Initial, a consultancy, and its founder got 5+ new clients from it.`;

const APPROACH = `Approach (a pitch, short and direct, applies to every cold message):
- This is Samuel introducing himself and making one clear offer. It is not an essay about their business and not free advice.
- Body under 80 words (DMs under 50). Three or four very short paragraphs.
- Build it in this order:
  1. The hook: the first line after the greeting, written in the style on the "Hook" line (OUTCOME when there is no Hook line). Never open with who Samuel is ("I'm a web developer", "My name is") and never write his name in the body: it is already on the email address and the sign-off.
  2. Why them: ONE short sentence with one concrete fact from the findings or site text, stated neutrally (e.g. "Right now bookings are by phone only."). Never criticise their site or whoever built it. Skip it if the hook already used that fact.
  3. The offer: what he would set up for them, in one or two sentences, with "fixed price" and "live in two weeks" where they fit. Who he is can come here as a short clause at most (e.g. "I set these up for small clinics").
  4. One proof point from the list below, in one short sentence, unless the hook was PROOF.
  5. One direct question as the call to action (e.g. "Shall I show you how it would look for Bright Smile?").
- Confident and friendly, never apologetic or salesy. Never explain at length why something matters, never lecture, no statistics, no "a lot of people...", no "did you know".
- Never sound like a template: no "I can help you grow", "increase your revenue", "take your business to the next level", "my services", "packages", "affordable", "free consultation", "limited time", "I'd love to", "hop on a call", "let me know your thoughts", and no lists of services.

${PROOF}

Example of the shape (for a dentist with no online booking). Do not copy its wording or topic:
"Hi Dr. Okafor,

Bright Smile's patients could book a check-up at 10pm and get a reminder text the day before.

Right now bookings are by phone only. I set up online booking for small clinics, at a fixed price and live in two weeks.

I also designed BookedEZ, a booking app that paid out over $10K in its first month.

Shall I show you how it would look for Bright Smile?"`;

const PROMPTS: Record<DraftKind, string> = {
  job: `Write a message from Samuel Adefila for each role below. Each is full-time: either remote and open to someone in Nigeria (the listing starts "Open to:"), or on-site abroad with visa sponsorship or relocation support (the listing starts "Relocation:"). Hiring managers and founders skim, so the first line must show he read the listing.

If Channel is APPLICATION, it goes in the job board's application form or cover letter box:
- No subject line. Open with "Hi," (or "Hi [Company] team,")
- Under 130 words
- End with one easy next step (a short call, or a small paid test task)
- Sign off "Samuel"
- Return an empty name and role.

If Channel is EMAIL, it is a direct pitch to the company, sent to the address shown (a hiring inbox, a named person, or the general inbox):
- Step 1, find the person. Look in "Company site text" for the founder, co-founder, CEO, or the person who runs hiring (head of people, talent, HR, recruiter). Only use a name the text clearly ties to that role. Never guess. If the address is clearly one person's (e.g. jane@ or jane.doe@) and the text names that person, use them. Otherwise leave name empty.
- Line 1 is "Subject: ..." (under 7 words, about the role or the work, no clickbait), blank line, then the body.
- Greeting: "Hi [FirstName]," when you found a person, else "Hi [Company] team,".
- Open by saying he saw they are hiring for the role. Then be useful before asking for anything: name what the role is really there to fix for them (for example, a marketing site that the team can't update quickly, or design that can't keep up with the product), and how Samuel would approach the first few weeks, in one or two sentences. If the company site text shows something specific related to the role, mention it as an observation, never as criticism.
- Then the offer, plainly: he can take on that work now, as a hire or on a contract basis so they can start sooner.
- Under 120 words. Close with one short opt-out line before the sign-off, e.g. "If the role is already filled, just say so and I won't follow up."
- Offer one easy next step (a short call, or a small paid test task).
- Sign off "Samuel" and on the next line "adefilasamuel.com".

For both channels:
- Name the one thing in the listing that matches Samuel best (Framer, Webflow, landing pages, marketing sites, product design, UI/UX, product engineering) and give one concrete example of similar work
- Remote role: you may mention he works remotely from Nigeria on GMT+1. Relocation role: say in one short sentence that he is ready to relocate to the role's city and would need the visa sponsorship the listing offers. Never claim he already has the right to work there.
- Point to his portfolio at adefilasamuel.com
- Never claim a skill, tool or years of experience the listing asks for unless Samuel's profile above shows it
- Never invent specific projects, clients, dates or results. Only mention work that is in Samuel's profile above

${VOICE}

Return ONLY valid JSON: {"ID": {"name": "First Last or empty string", "role": "Founder / CEO / Head of Talent etc, or empty string", "message": "..."}, ...}`,

  remote: `Write a short application note from Samuel Adefila for each remote role below. It goes in the job board's application form or cover letter box. Hiring managers skim, so the first line must show he read the listing.

Rules:
- No subject line. Open with "Hi," (or "Hi [Company] team,")
- Under 130 words
- Name the one thing in the listing that matches Samuel best (Framer, Webflow, landing pages, marketing sites, product design, UI/UX, product engineering) and give one concrete example of similar work
- Mention he works remotely from Nigeria on GMT+1, which overlaps fully with UK and European hours
- Point to his portfolio at adefilasamuel.com
- End with one easy next step (a short call, or a small paid test task)
- Sign off "Samuel"
- Never claim a skill, tool or years of experience the listing asks for unless Samuel's profile above shows it
- Never invent specific projects, clients, dates or results. Only mention work that is in Samuel's profile above

${VOICE}

Return ONLY valid JSON: {"ID": "note text", ...}`,

  inbound: `Each person below filled in the contact form on Samuel Adefila's website, adefilasamuel.com. Write Samuel's reply to each one. They came to him, so this is a warm reply, not a pitch.

Rules:
- Line 1 is "Subject: Re: your enquiry" or a short subject naming their project (under 7 words). Blank line, then the body.
- Greet them by first name if you have it ("Hi Sarah,"), else "Hi there,".
- Thank them in a few words, then show you read what they wrote: restate their goal in one sentence, in your own words.
- Whatever service they asked for (Framer, Webflow, Shopify, WordPress, a redesign, an app, branding, SEO or anything else), treat it as work Samuel is happy to take on. Never decline, never say it is outside his focus or not his specialty, never steer them to a different platform or service, and never suggest someone else. The goal of this reply is to learn more about their project.
- Show genuine interest, then ask two or three short questions to understand the project better. Pick the ones their message has not answered: what the business does and who it is for, what they want the site or product to achieve, rough scope (pages or features), any designs or content they already have, their timeline, and their budget range.
- Only if their message already makes the scope clear, add one sentence on how Samuel would approach it. Never quote a price or a timeline in this first reply.
- Offer a short call as the next step and ask which day suits them.
- Under 150 words. Sign off "Samuel" and on the next line "adefilasamuel.com".
- No opt-out line: they wrote first.
- Never state anything they did not say.

${VOICE}

Return ONLY valid JSON: {"ID": {"name": "", "role": "", "message": "..."}, ...}`,

  visitor: `Write a short first email from Samuel Adefila to each company below. Their team has been looking at his portfolio, but NEVER mention or hint at that (no "noticed you visited", "saw you on my site"): write it as an ordinary introduction based on their website.

Rules:
- Step 1, find the person: look in "Site text" for the founder, CEO, or head of marketing. Only use a name the text clearly ties to that role, else leave name empty.
- Line 1 "Subject: ..." (under 7 words, about their business), blank line, body under 100 words.
- Greeting "Hi [FirstName]," or "Hi [Company] team,".
- Follow the Approach below. The offer is one concrete thing for their website (a landing page for one offer, a faster marketing site, one page made clearer). Never invent problems the site text does not show.
- One easy next step (a short call, or a free one-page sketch of the idea for their homepage).
- Close with a short opt-out line, then sign off "Samuel" and "adefilasamuel.com".

${APPROACH}

${VOICE}

Return ONLY valid JSON: {"ID": {"name": "", "role": "", "message": "..."}, ...}`,

  places: `Write outreach from Samuel Adefila to each local business below. He found them on Google Maps and looked at their website. "Findings" lists what's wrong, or that they have no website. "Site text" is text scraped from their site.

Step 1, find the person. Look in the business name and site text for the owner, founder, principal or lead practitioner.
- Only use a name when it's clear they run the place: "founded by", "owner", "principal", "Dr. X" at a solo practice, "Hi, I'm X", or a business named after a person (e.g. "Sarah Kim Interiors").
- Never guess or pick a random staff member. If unsure, leave name empty.

Step 2, write the message.
- Greeting: "Hi [FirstName]," when you found a person (use "Hi Dr. [LastName]," for doctors and dentists). If no person but it's clearly a team, "Hi [Business name] team,". Otherwise "Hi there,".
- If Channel is EMAIL: line 1 is "Subject: ..." (under 6 words, naming what he would set up for them, e.g. "Online booking for Bright Smile", no clickbait), blank line, then body under 80 words.
- If Channel is DM: no subject line, under 50 words. It goes out as an Instagram, Facebook or LinkedIn message.
- Follow the Approach below. The "Angle" line picks the one fact used for "why them". Every business gets a different angle on purpose, so the batch never reads like one template.
- Do not mention star ratings or review counts unless the angle is REPUTATION. Never open with "X reviews at Y stars".
- The idea in the message is the "Idea to offer": a simple system that saves them time or brings in customers, described in plain words and tied to their kind of business. Not every business needs a new website, so do not pitch a website first.
- Never use words like HTTPS, SEO, viewport, load time, optimisation or automation. A website issue from the findings can be the "why them" fact, in plain words, but only if the angle points there.
- Vary the closing question between messages: showing a quick demo for their business, sending a short example, or a ten-minute call.
- A link to a one-page note of ideas for them is added under your message automatically. Never offer to send a note and never mention it yourself.
- Vary length (some messages 50 words, some closer to 80) and sentence rhythm. Write it the way Samuel would type it himself.
- Sign off "Samuel" and on the next line "adefilasamuel.com".
- Close the body with one short opt-out line before the sign-off, phrased naturally, e.g. "If it's not something you need, just say so and I won't follow up."
- Never state anything that isn't in the findings or site text.

Language (strict):
- Write the whole message, including the subject text, greeting, opt-out line and sign-off, in the language on the business's "Language" line, as a native speaker would write a short business email. Not a word-for-word translation of English.
- Keep the literal "Subject:" prefix in English (the app reads it), then the subject text in the business's language.
- Dutch: greet with "Hallo [FirstName]," or "Beste [FirstName],", and use "u" throughout. Norwegian (Bokmål): "Hei [FirstName],", use "du/dere". French: "Bonjour [FirstName]," when you found a first name, otherwise just "Bonjour,". Never write "Madame, Monsieur" together or guess someone's gender. Use "vous" throughout. With no person, greet the team in that language (e.g. "Hallo team van X,", "Hei,", "Bonjour,").
- The opt-out line must mean "if this isn't for you, just say so and I won't email again". Natural examples (vary the wording, keep the meaning):
  Dutch: "Is dit niets voor u, laat het me dan gerust weten, dan mail ik u niet meer."
  Norwegian: "Er ikke dette noe for deg, er det bare å si fra, så sender jeg ikke mer."
  French: "Si cela ne vous intéresse pas, dites-le-moi simplement et je ne vous relancerai pas."
- The rules below about banned words and phrasing apply to their equivalents in that language too.
- Questions must be grammatical and natural for a native speaker. French: "Voulez-vous que je vous envoie…?", "Est-ce que cela vous aiderait…?", never "Aimerais-je…?". Dutch: "Zou het u helpen als…?". Norwegian: "Vil det hjelpe om…?".

${APPROACH}

${VOICE}

Return ONLY valid JSON: {"ID": {"name": "First Last or empty string", "role": "Owner / Founder / Dentist etc, or empty string", "message": "..."}, ...}`,

  newco: `Write a short, warm note from Samuel Adefila to the director of each newly registered UK company below. They set the company up in the last few weeks. Samuel builds websites and simple systems that save small businesses time.

Rules:
- Greet the director by first name ("Hi Sarah,"). If Director is unknown, use "Hi there,".
- Open by congratulating them on starting the company, naturally and briefly. Don't say how you found them beyond "saw you recently set up [Company]".
- Then follow the Approach below, with the "Idea to offer" as the offer: what setting it up from day one saves them as they start taking customers.
- If they have a website with issues: mention ONE issue from the findings in plain words.
- Offer one easy next step: a short note of ideas for their business, or a short call.
- If Channel is EMAIL: line 1 "Subject: ..." (under 7 words), blank line, body under 100 words, sign off "Samuel" then "adefilasamuel.com".
- If Channel is LINKEDIN: no subject, under 280 characters in total (LinkedIn connection note limit), sign off "Samuel".
- Close with one short opt-out line when Channel is EMAIL.
- Never state anything that isn't in the findings.

${APPROACH}

${VOICE}

Return ONLY valid JSON: {"ID": {"name": "", "role": "", "message": "..."}, ...}`,
};

type Draft = { message: string; name?: string; role?: string };

async function draftBatch(batch: Lead[], kind: DraftKind): Promise<Map<string, Draft>> {
  // Random start per batch: neighbours differ, and a rewrite gets a fresh angle.
  const angleBase = Math.floor(Math.random() * PLACES_ANGLES.length);
  const hookBase = Math.floor(Math.random() * HOOKS.length);
  const block = batch.map((l, i) => describe(l, i, kind, angleBase, hookBase)).join('\n\n---\n\n');
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

const INFORMAL_DUTCH = /\b(je|jij|jou|jouw|jullie|jezelf)\b/i;

// Rewrites a Dutch email so it addresses the reader with "u" everywhere, fixing spelling on the
// way, and changes nothing else.
async function politeDutch(message: string): Promise<string> {
  const msg = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content: `Herschrijf deze zakelijke e-mail zodat de lezer overal met "u" en "uw" wordt aangesproken (nooit "je", "jij", "jouw", "jou" of "jullie"). Pas de werkwoorden daarop aan en verbeter spelfouten. Verander verder niets: dezelfde inhoud, dezelfde regels, dezelfde "Subject:" regel en dezelfde afsluiting. Geef alleen de e-mail terug.

${message}`,
    }],
  });
  const block = msg.content[0];
  const text = block.type === 'text' ? humanize(block.text.trim()) : '';
  return text && !INFORMAL_DUTCH.test(text) ? text : message;
}

export async function generateColdEmails(leads: Lead[]): Promise<Lead[]> {
  if (!leads.length) return [];
  console.log(`[claude] Drafting outreach for ${leads.length} leads...`);

  const drafts = new Map<string, Draft>();
  const BATCH = 5;
  for (const kind of ['job', 'places', 'newco', 'remote', 'inbound', 'visitor'] as DraftKind[]) {
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

  // Dutch drafts must use "u" throughout; the model sometimes slips into "je".
  for (const l of leads) {
    const d = drafts.get(l.id);
    if (d && leadLanguage(l) === 'nl' && INFORMAL_DUTCH.test(d.message)) {
      d.message = await politeDutch(d.message).catch(() => d.message);
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
  const channel = lead.contactEmail ? 'an email reply in the same thread'
    : lead.source === 'job' || lead.source === 'remote' ? 'a short follow-up to the hiring manager about his application'
    : 'a short DM';
  const person = lead.contactName && lead.contactName !== lead.title ? lead.contactName : '';
  // They opened the one-page note: build this follow-up around one idea from it.
  const ideas = lead.noteOpenedAt && hasCheck(lead) ? systemsFor(lead) : [];
  const noteBlock = ideas.length ? `

His first email linked a one-page note with these ideas for their business. They have looked at it but not replied:
${ideas.map(i => `- ${i}`).join('\n')}

For this follow-up:
- Pick the ONE idea above that fits their business best and say in one or two sentences how it would work for them day to day (who does what, what they no longer have to do). Be concrete, no jargon.
- Then make an easy offer: a 10-minute call, or a short video walking through it for their business. End with a simple yes/no question.
- Never say or hint that you know they opened or read the note (no "I saw you looked at", "noticed you checked"). Write as if it is a natural next step.` : '';

  const prompt = `Samuel Adefila contacted this lead${since ? ` ${since} days ago` : ''} and hasn't heard back. Write follow-up number ${number} of 2, sent as ${channel}.

Lead: ${lead.title} (${lead.company})${person ? `\nPerson: ${person}${lead.contactTitle ? `, ${lead.contactTitle}` : ''}` : ''}
What we know: ${lead.description.slice(0, 400)}

His first message:
"""
${lead.proposal ?? ''}
"""${noteBlock}

Rules:
- No subject line. Start with exactly the same greeting line as the first message (same name, same title, e.g. "Hi Dr. Lee," stays "Hi Dr. Lee,").
- Plain words only: never technical terms such as HTTPS, SSL, certificate, SEO, viewport, load time or automation.
- Never ask whether they read, saw or had time for the earlier message, in any language (not "did you see my email", "je me demandais si vous aviez eu le temps de lire", "heeft u mijn bericht gezien", "fikk du lest"). Go straight to the new useful point.
- If you ask a question, end it with a question mark.
- Follow-up 1: under 60 words. Don't repeat the first message. Give them one new, genuinely useful thing they can use even if they never hire Samuel (a small tip tied to their business, or a second idea), then offer to help. End with a yes/no question.
- Follow-up 2: under 45 words. Polite last check-in. Say you won't keep emailing, and leave the door open.
- Never guilt-trip ("just bumping this", "did you see my email", "following up on my last email"). No fake urgency. It should read like a helpful note, not a chase.
- Sign off "Samuel".${leadLanguage(lead) !== 'en' ? `
- Write it entirely in ${LANGUAGE_NAME[leadLanguage(lead)]}, as a native speaker would, with the same form of address as his first message${leadLanguage(lead) === 'nl' ? ' ("u", never "je" or "jij")' : leadLanguage(lead) === 'fr' ? ' ("vous", never "tu")' : ''}.` : ''}

${VOICE}

Return ONLY the message text.`;

  const msg = await getClient().messages.create({
    model: MODEL,
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });
  const c = msg.content[0];
  const text = c.type === 'text' ? humanize(c.text.replace(/^"""|"""$/g, '')) : '';
  const polite = leadLanguage(lead) === 'nl' && INFORMAL_DUTCH.test(text) ? await politeDutch(text).catch(() => text) : text;
  return withFirstGreeting(polite, lead.proposal ?? '');
}

// Follow-ups open with exactly the greeting line of the first message ("Hi Dr. Lee," stays
// "Hi Dr. Lee,", never "Hi Sam,"), whatever the model wrote.
function withFirstGreeting(followUp: string, firstMessage: string): string {
  const body = firstMessage.replace(/^\s*Subject:.*\n+/i, '');
  const first = body.split('\n')[0]?.trim() ?? '';
  const isGreeting = (line: string) => /^\S.{0,60},$/.test(line.trim());
  if (!first || !isGreeting(first)) return followUp;
  const lines = followUp.split('\n');
  if (isGreeting(lines[0] ?? '')) lines[0] = first;
  return lines.join('\n');
}
