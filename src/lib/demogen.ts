import Anthropic from '@anthropic-ai/sdk';
import type { Lead } from '@/types/lead';
import { scanSite, type SiteScan } from '@/lib/sitescan';
import { finishDemo, type DemoContent } from '@/lib/demo';

// Builds a lead's demo page: read their site, ask the model to write the demo as data (only from what the site says),
// then clean it up (finishDemo: no dashes, safe lengths, readable colours). Used by the "Create demo" button.

const MODEL = process.env.DEMO_MODEL ?? 'claude-sonnet-5-5';

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
  "highlight": "one word from the statement to colour in",
  "results": [ { "value": "a figure the site really states", "label": "what it measures", "client": "who" } ] (only if the site states real results, otherwise []),
  "partners": ["partner or technology names the site lists, otherwise []"],
  "posts": [ { "title": "an article title from ARTICLES", "url": "its url from ARTICLES" } ] (otherwise []),
  "socials": [ { "name": "linkedin|facebook|instagram|youtube|twitter", "url": "from SOCIALS" } ] (otherwise []),
  "since": year or null
}`;

const RULES = `Rules, all strict:
- Use ONLY facts that are in the site material below. If the site does not say it, do not write it. No invented numbers, awards, clients, years, prices or guarantees.
- Write plain, specific, human sentences. No marketing filler (elevate, leverage, seamless, unlock, cutting-edge, game-changer, delighted). No em dashes or en dashes anywhere. No exclamation marks.
- Keep each text short. Headline lines are short enough to fit four words each.
- Pick ONE idea from the business's own world and carry it through the names, the status and the numbering. Examples: an IT firm climbs levels (L1 to L4); a tender writer works through a submission (§1 to §3); a process consultancy takes steps (S1 to S4). Choose what is true to THIS business.
- look: use "modern" for almost every business-to-business company (consulting, IT, software, finance, legal, agencies, training, services). Use "blueprint" ONLY for construction, engineering, architecture, manufacturing and other industrial businesses. Use "console" ONLY for developer tools, infrastructure and data products that would suit a dark technical look.
- facts: exactly 3, each a REAL fact from the site (a year they started, a number of services, a place, a certification). Never invent a statistic.
- accent: use one of the BRAND COLOURS if one suits, otherwise pick a confident colour that fits the business. It must be a hex colour like #1b94c9.
- images: choose by index from IMAGES. Prefer photographs (jpg, jpeg, webp). Use null when none fit. Never invent a URL.
- clients, results, partners, posts and socials: ONLY what the site itself shows. If the site shows none, return an empty list. Never invent a name, a figure or a link.
- quotes: copy real quotes only; if QUOTES is empty, return an empty list.
- 3 to 4 services in levels, 3 to 4 steps in process, 3 things in why, 3 questions in faq. Pins are short phrases already used on the site.
- tz: the time zone of the business's city, or null if you are unsure.
Return ONLY the JSON object.`;

export interface DemoResult { demo: DemoContent; scan: SiteScan }

export async function generateDemo(lead: Lead): Promise<DemoResult | { error: string }> {
  const site = lead.contactLinks?.website;
  if (!site) return { error: 'This lead has no website to read' };
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { error: 'The model key is not set' };
  const scan = await scanSite(site);
  if (!scan) return { error: 'Could not open their website' };
  if (scan.paragraphs.length < 2 && scan.headings.length < 3) return { error: 'Their site has too little text to build a demo from' };

  const material = [
    `BUSINESS: ${lead.title}`,
    `WHERE: ${lead.company}`,
    `SITE: ${scan.url}`,
    `TITLE: ${scan.title}`,
    scan.description && `DESCRIPTION: ${scan.description}`,
    `BRAND COLOURS: ${scan.colors.join(', ') || 'none found'}`,
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

  const client = new Anthropic({ apiKey: key });
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 6000,
    messages: [{ role: 'user', content: `Write a concept website for this business as one JSON object, in exactly this shape:\n${SCHEMA}\n\n${RULES}\n\nSITE MATERIAL\n${material}` }],
  });
  const block = msg.content[0];
  const text = block.type === 'text' ? block.text : '';
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    const demo = finishDemo(raw, scan.images);
    if (!demo.hero.lines.length || demo.levels.length < 2) return { error: 'The model returned too little to build a page' };
    return { demo, scan };
  } catch {
    return { error: 'The model returned something that could not be read' };
  }
}
