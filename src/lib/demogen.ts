import Anthropic from '@anthropic-ai/sdk';
import type { Lead } from '@/types/lead';
import { scanSite, type SiteScan } from '@/lib/sitescan';
import { brandColours, finishDemo, type DemoContent } from '@/lib/demo';

// Builds a lead's demo page: read their site, ask the model to write the demo as data (only from what the site says),
// then clean it up (finishDemo: no dashes, safe lengths, readable colours). Used by the "Create demo" button.

const MODEL = process.env.DEMO_MODEL ?? 'claude-haiku-5-5';

const SCHEMA = `{
  "look": "modern" | "console" | "blueprint",
  "brand": { "name": "full business name", "word": "short name for the logo, one word", "accent": "#rrggbb" },
  "tz": "IANA time zone of their city, e.g. Australia/Perth, or null",
  "centre": "their city or area, shown in the top strip",
  "status": "a short strip phrase true to their world (2-3 words), e.g. All systems normal, Bid response, Open for business",
  "meter": "percent" | "page",
  "nav": ["4 short section names that match the sections below"],
  "hero": { "kicker": "what they do, 3 items joined by ' · '", "lines": ["2 short headline lines, max 4 words each"], "sub": "1-2 sentences, from the site", "cta": "their own call to action", "secondary": "short" },
  "images": { "hero": index into IMAGES or null, "band": index or null, "side": index or null },
  "badges": ["3 short true labels"],
  "ticker": ["5-6 short true phrases from the site"],
  "trust": "one short line above the headline, true to the site, e.g. Supporting Perth businesses since 2007",
  "micro": "one short line under the main button, true to the site, e.g. Free consultation · Perth and metro",
  "factsTitle": "a calm headline for three fact cards", "factsSub": "one sentence from the site",
  "facts": [ { "value": "a number or short word that the site really supports, e.g. 4 or APMP", "label": "2-3 words", "note": "one sentence from the site" } ],
  "statement": "one sentence, taken or tightened from the site's own words, max 18 words",
  "names": { "idea": "section name", "levels": "what the services are called as a group", "process": "...", "why": "...", "faq": "Questions", "start": "...", "prefix": "1-2 characters to number the services, e.g. L, S, §, P" },
  "levelsTitle": "headline for the services section",
  "levels": [ { "name": "service", "body": "1-2 sentences from the site", "image": "hero" | "band" | "side", "pins": [ { "label": "3-4 word phrase from the site", "x": 6-94, "y": 6-94 } ] } ],
  "processTitle": "...", "process": [ { "title": "short", "body": "one sentence" } ],
  "whyTitle": "...", "why": [ { "title": "short", "body": "one sentence, from the site" } ],
  "quotes": [ { "text": "a real client quote from QUOTES, shortened only by cutting sentences, never reworded", "name": "...", "company": "..." } ],
  "coverageTitle": "or empty", "coverage": [ { "label": "place", "x": 6-94, "y": 6-94 } ],
  "faqTitle": "...", "faq": [ { "q": "...", "a": "answer using only what the site says" } ],
  "closing": { "title": "a question or invitation in their voice", "body": "one line", "cta": "...", "fields": ["Your name", "Work email", "a third field that fits their service"] },
  "footer": { "blurb": "one sentence", "columns": [ { "title": "...", "links": ["..."] } ], "place": "city, state or country", "site": "their domain" },
  "clients": ["real client or customer names the site mentions, up to 6, or an empty list"],
  "contrast": { "title": "a calm headline, e.g. The difference, max 6 words", "other": ["3-4 short frustrations people commonly have with providers of this kind, generic, no names, no numbers"], "with": ["3-4 short statements of how THIS business works, each backed by the site material, same order as the frustrations"] },
  "problem": { "badge": "2 words, e.g. The problem", "title": "a calm headline naming the trouble their customers have, max 9 words", "body": "1-2 sentences on why that trouble happens, in plain words", "points": [ { "title": "3-4 words", "body": "one sentence, what the customer experiences" } ], "bridge": "one sentence that leads into what the business does about it" },
  "highlight": "one word from the statement to colour in",
  "results": [ { "value": "a figure the site really states", "label": "what it measures", "client": "who" } ],
  "partners": ["partner or technology names the site lists, otherwise []"],
  "posts": [ { "title": "an article title from ARTICLES", "url": "its url from ARTICLES" } ],
  "socials": [ { "name": "linkedin|facebook|instagram|youtube|twitter", "url": "from SOCIALS" } ],
  "since": year or null
}`;

const RULES = `Rules, all strict:
- Use ONLY facts that are in the site material below. If the site does not say it, do not write it. No invented numbers, awards, clients, years, prices or guarantees.
- Write plain, specific, human sentences. No marketing filler (elevate, leverage, seamless, unlock, cutting-edge, game-changer, delighted). No em dashes or en dashes anywhere. No exclamation marks.
- Keep each text short. Headline lines are short enough to fit four words each.
- Pick ONE idea from the business's own world and carry it through the names, the status and the numbering. Examples: an IT firm climbs levels (L1 to L4); a tender writer works through a submission (§1 to §3); a process consultancy takes steps (S1 to S4). Choose what is true to THIS business.
- look: use "modern" for almost every business-to-business company (consulting, IT, software, finance, legal, agencies, training, services). Use "blueprint" ONLY for construction, engineering, architecture, manufacturing and other industrial businesses. Use "console" ONLY for developer tools, infrastructure and data products that would suit a dark technical look.
- facts: exactly 3, each a REAL fact from the site (a year they started, a number of services, a place, a certification). Never invent a statistic.
- accent: use the first of the BRAND COLOURS (it is the business's real colour). Only if none are listed, pick a confident colour that fits the business, as a hex colour like #1b94c9.
- images: choose by index from IMAGES. Prefer photographs (jpg, jpeg, webp). Use null when none fit. Never invent a URL.
- clients: use the names in CLIENT LOGOS first (they are shown with their real logos), then names from the text.
- clients, results, partners, posts and socials: ONLY what the site itself shows. If the site shows none, return an empty list. Never invent a name, a figure or a link.
- Every sentence you write must be backed by a sentence in the site material. Do not add reassurances or claims the site does not make (for example "no obligation", "built on referrals", "happy clients", "award-winning").
- hero.lines: write two short lines in your own words about what the business does for its customer. Do not just copy the site's headings.
- quotes: if QUOTES has entries, include up to 3 of them (the name goes in "name", and the company if the quote text or site names it, otherwise ""). Copy real quotes only; if QUOTES is empty, return an empty list.
- 3 to 4 services in levels, 3 to 4 steps in process, 3 things in why, 3 questions in faq. Pins are short phrases already used on the site.
- tz: the time zone of the business's city, or null if you are unsure.
- problem: exactly 3 points. Describe the trouble the business's customers have BEFORE they hire it, using the site's own wording where it describes this. No numbers or percentages unless the site states them. Do not mention the business by name in the problem section.
- contrast: 3 or 4 pairs. "other" lines are common frustrations with providers of this kind (never name or accuse a real company). "with" lines are how this business works, each from the site, no claims the site does not make.
- levels[].pins: 3 short phrases per service, taken from the site (they become the lines of a small interface card), never invented.
Return ONLY the JSON object.`;

export interface DemoResult { demo: DemoContent; scan: SiteScan | null; generic: boolean }

const GENERIC_RULES = `Rules, all strict. There is NO website to read, only the business name, its place and a short description, so this is a generic concept:
- Say only what any business of this kind plainly does. No years, numbers, awards, clients, prices, guarantees, reviews, partners or claims of any kind.
- Describe services neutrally, in plain words, as a customer would search for them. Do not say "trusted", "experienced", "leading", "best", "family run", "affordable" or similar.
- hero.lines: two short lines about what the business does for its customer. No em dashes or en dashes, no exclamation marks.
- images: all null. clients, results, partners, posts, socials, quotes and coverage: empty lists. since: null. tz: null unless the city is obvious.
- facts: exactly 3, none of them numbers or statistics: a place served, a kind of service, a way to get in touch. Use words only.
- look: "modern" unless the business is construction, engineering or industrial (then "blueprint").
- accent: pick a calm confident colour that suits the trade, as a hex colour.
- footer.site: empty string. Use the business name and place given.
- problem: exactly 3 points describing the trouble a customer of this kind of business has, in plain neutral words, no numbers, no statistics, no promises.
- contrast: 3 pairs: "other" = common frustrations with providers of this kind, "with" = how the business plainly works, neutral, no claims, no numbers.
- levels[].pins: 3 short neutral phrases per service (what that service covers), no claims.
- 3 services, 3 process steps, 3 things in why (each a neutral statement of how the business works, not a boast), 3 questions in faq with careful answers that make no promises.
Return ONLY the JSON object.`;

const BANNED = /(award[- ]winning|guarantee[ds]?|no obligation|happy clients?|trusted by|years of experience|market[- ]leading|number one|#1|best in|cheapest|lowest price|100%|satisfaction|certified|built on referrals|referrals)/i;

async function ask(client: Anthropic, prompt: string): Promise<Record<string, unknown> | null> {
  // One retry: the first answer sometimes has a stray comment or is cut short.
  for (let attempt = 0; attempt < 2; attempt++) {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 9000,
      messages: [{ role: 'user', content: attempt ? `${prompt}\n\nYour last answer could not be parsed as JSON. Answer again with the JSON object only.` : prompt }],
    });
    // The answer may start with a thinking block: take every text block, not just the first block.
    const text = msg.content.map(b => (b.type === 'text' ? b.text : '')).join('');
    const raw = parseModelJson(text);
    if (raw) return raw;
    console.error(`[demo] unreadable answer (attempt ${attempt + 1}, stop=${msg.stop_reason}, ${text.length} chars): ${text.slice(0, 160).replace(/\s+/g, ' ')} ... ${text.slice(-120).replace(/\s+/g, ' ')}`);
  }
  return null;
}

// opts.generic: if the site cannot be read (or there is none), write a neutral concept from the name and place alone.
export async function generateDemo(lead: Lead, opts: { generic?: boolean } = {}): Promise<DemoResult | { error: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { error: 'The model key is not set' };
  const site = lead.contactLinks?.website;
  let scan: SiteScan | null = null;
  if (site) {
    scan = await scanSite(site);
    if (scan && scan.paragraphs.length < 2 && scan.headings.length < 3) scan = null;
  }
  if (!scan && !opts.generic) return { error: site ? 'Could not read their website, or it has too little text' : 'This lead has no website to read' };

  const client = new Anthropic({ apiKey: key });
  const tail = `- Output valid JSON only: double-quoted keys and strings, no comments, no trailing commas, no text before or after the object. Where the shape shows alternatives with |, write just one of them.`;
  let prompt: string;
  if (scan) {
    const material = [
      `BUSINESS: ${lead.title}`,
      `WHERE: ${lead.company}`,
      `SITE: ${scan.url}`,
      `TITLE: ${scan.title}`,
      scan.description && `DESCRIPTION: ${scan.description}`,
      `BRAND COLOURS: ${scan.colors.join(', ') || 'none found'}`,
      scan.clientLogos.length ? `CLIENT LOGOS: ${scan.clientLogos.map(l => l.name).join(', ')}` : '',
      scan.since ? `STARTED: ${scan.since}` : '',
      `NAV: ${scan.nav.join(' | ')}`,
      `HEADINGS:\n${scan.headings.map(h => `- ${h}`).join('\n')}`,
      `PARAGRAPHS:\n${scan.paragraphs.map(p => `- ${p}`).join('\n')}`,
      scan.bullets.length ? `LIST ITEMS:\n${scan.bullets.map(b => `- ${b}`).join('\n')}` : '',
      `QUOTES:\n${scan.quotes.length ? scan.quotes.map(q => `- "${q.text}" (${q.by})`).join('\n') : '(none)'}`,
      scan.socials.length ? `SOCIALS:\n${scan.socials.map(x => `- ${x.name}: ${x.url}`).join('\n')}` : '',
      scan.articles.length ? `ARTICLES:\n${scan.articles.map(x => `- ${x.title} | ${x.url}`).join('\n')}` : '',
      `IMAGES:\n${scan.images.map((u, i) => `${i}: ${u}`).join('\n') || '(none)'}`,
    ].filter(Boolean).join('\n\n');
    prompt = `Write a concept website for this business as one JSON object, in exactly this shape:\n${SCHEMA}\n\n${RULES}\n${tail}\n\nSITE MATERIAL\n${material}`;
  } else {
    const material = [`BUSINESS: ${lead.title}`, `WHERE: ${lead.company}`, lead.description ? `NOTES: ${lead.description.replace(/\s+/g, ' ').slice(0, 300)}` : ''].filter(Boolean).join('\n');
    prompt = `Write a concept website for this business as one JSON object, in exactly this shape:\n${SCHEMA}\n\n${GENERIC_RULES}\n${tail}\n\nWHAT WE KNOW\n${material}`;
  }

  // A claim the site does not make is not allowed: on a hit, ask once more with that phrase named, then give up.
  const siteText = scan ? JSON.stringify(scan).toLowerCase() : '';
  let demo: DemoContent | null = null;
  let note = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await ask(client, note ? `${prompt}\n\n${note}` : prompt);
    if (!raw) return { error: 'The model returned something that could not be read' };
    const made = finishDemo(raw, scan?.images ?? []);
    if (!scan) made.images = { hero: null, band: null, side: null };
    if (!made.hero.lines.length || made.levels.length < 2) return { error: 'The model returned too little to build a page' };
    const hit = JSON.stringify(made).match(new RegExp(BANNED.source, 'gi'))?.filter(h => !siteText.includes(h.toLowerCase()));
    if (!hit?.length) { demo = made; break; }
    note = `Your last answer used claims the material does not make (${[...new Set(hit.map(h => h.toLowerCase()))].join(', ')}). Write it again without them, and without anything like them. Also: no referrals, no "happy clients".`;
  }
  if (!demo) return { error: 'The text kept making claims it should not' };
  // The business's own logo and exact brand colour, and the site's own logos for the clients it names.
  if (scan) {
    if (scan.logo) demo.brand.logo = scan.logo;
    if (scan.brandColor) demo.brand = { ...demo.brand, ...brandColours(scan.brandColor) };
    const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
    demo.clientLogos = scan.clientLogos.filter(l => demo!.clients.some(n => norm(n).includes(norm(l.name)) || norm(l.name).includes(norm(n))));
  }
  return { demo, scan, generic: !scan };
}

// The first complete JSON object in the text, tolerating code fences and trailing commas.
function parseModelJson(text: string): Record<string, unknown> | null {
  const t = text.replace(/```(?:json)?/gi, '');
  const start = t.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < t.length; i++) {
    const ch = t[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) return null;
  const slice = t.slice(start, end + 1);
  for (const candidate of [slice, slice.replace(/,\s*([}\]])/g, '$1')]) {
    try { return JSON.parse(candidate) as Record<string, unknown>; } catch { /* try the next form */ }
  }
  return null;
}
