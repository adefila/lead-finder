// What a demo page shows, how it is cleaned up, and a few real examples. A lead's demo is generated as this data (see
// demogen.ts): words and pictures come from the business's own website, the look is chosen to suit the business, and one
// idea from the business's own world runs through every section.

// modern: the default for business-to-business (calm, centred, rounded). console and blueprint are the Datum-style looks,
// kept for construction, engineering and industrial businesses.
export type Look = 'modern' | 'console' | 'blueprint';
export interface Pin { label: string; x: number; y: number }   // x and y are percentages of the picture

export interface DemoContent {
  look: Look;
  brand: { name: string; word: string; accent: string; accentLit: string; accentInk: string; onAccent: string; deep: string; deep2: string; tint: string; onLit: string; btn: string; btnHover: string };
  tz: string | null;                                // a time zone puts a live clock in the strip
  centre: string;                                   // the middle of the strip, e.g. "Perth" or "Geraldton and Perth"
  status: string;                                   // the left of the strip
  meter: 'percent' | 'page';                        // the right of the strip: how far down you are
  nav: string[];
  hero: { kicker: string; lines: string[]; sub: string; cta: string; secondary: string };
  images: { hero: string | null; band: string | null; side: string | null };
  badges: string[];
  ticker: string[];
  statement: string;
  // Modern look: a line above the headline, a line under the button, and three real facts about the business
  trust: string;
  micro: string;
  factsTitle: string;
  factsSub: string;
  facts: { value: string; label: string; note: string }[];
  // Modern look: real client names for the strip under the hero, the word to colour in the statement, and optional
  // sections that only appear when the site gives the material (results, partners, articles, social links)
  clients: string[];
  // Modern look: the problem the customer has, three plain pain points, and one line that leads into the services
  problem: { badge: string; title: string; body: string; points: { title: string; body: string }[]; bridge: string };
  highlight: string;
  results: { value: string; label: string; client: string }[];
  partners: string[];
  posts: { title: string; url: string }[];
  socials: { name: string; url: string }[];
  // The idea: what the services are called and how they are numbered ("L1 IT support", "§2 Business cases")
  names: { idea: string; levels: string; process: string; why: string; faq: string; start: string; prefix: string };
  levelsTitle: string;
  levels: { name: string; body: string; image: 'hero' | 'band' | 'side'; pins: Pin[] }[];
  processTitle: string;
  process: { title: string; body: string }[];
  whyTitle: string;
  why: { title: string; body: string }[];
  quotes: { text: string; name: string; company: string }[];
  coverageTitle: string;
  coverage: Pin[];
  faqTitle: string;
  faq: { q: string; a: string }[];
  closing: { title: string; body: string; cta: string; fields: string[] };
  footer: { blurb: string; columns: { title: string; links: string[] }[]; place: string; site: string };
  since: number | null;
}

// ─── Colour: make sure text on the brand colour, and the brand colour as text, are readable ───

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
};
const toHex = ([r, g, b]: number[]) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex).map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (hex: string, to: number, t: number) => toHex(rgb(hex).map(v => v + (to - v) * t));

export function brandColours(accent: string, paper = '#e8edf1', dark = '#0a1118') {
  const a = /^#[0-9a-f]{6}$/i.test(accent) ? accent.toLowerCase() : '#1b94c9';
  const onAccent = contrast(a, '#04121a') >= contrast(a, '#ffffff') ? '#04121a' : '#ffffff';
  let ink = a; for (let i = 0; i < 12 && contrast(ink, paper) < 4.8; i++) ink = mix(ink, 0, 0.12);       // text on light
  let lit = a; for (let i = 0; i < 12 && contrast(lit, dark) < 4.8; i++) lit = mix(lit, 255, 0.12);      // text on dark
  const deep = mix(a, 0, 0.84), deep2 = mix(a, 0, 0.76), tint = mix(a, 255, 0.93);
  // Buttons: white text on a dark shade of the brand colour, at least 5.5:1
  let btn = a; for (let i = 0; i < 9 && contrast(btn, '#ffffff') < 5.5; i++) btn = mix(btn, 0, 0.1);
  const btnHover = mix(btn, 0, 0.2);
  const onLit = contrast(lit, '#04121a') >= contrast(lit, '#ffffff') ? '#04121a' : '#ffffff';
  return { accent: a, accentInk: ink, accentLit: lit, onAccent, deep, deep2, tint, onLit, btn, btnHover };
}

// ─── Cleaning what the model returns ───

const noDash = (s: string) => s.replace(/\s*[—–]\s*/g, ', ').replace(/\s{2,}/g, ' ').trim();
const str = (v: unknown, max: number, fallback = '') => (typeof v === 'string' && v.trim() ? noDash(v).slice(0, max) : fallback);
const list = <T,>(v: unknown, n: number, f: (x: unknown) => T | null): T[] => (Array.isArray(v) ? v.map(f).filter((x): x is T => x !== null).slice(0, n) : []);
const pct = (v: unknown, d: number) => (typeof v === 'number' && v >= 6 && v <= 94 ? Math.round(v) : d);
const pins = (v: unknown, n: number): Pin[] => list(v, n, p => {
  const o = p as Record<string, unknown>; const label = str(o?.label, 40);
  return label ? { label, x: pct(o.x, 40), y: pct(o.y, 45) } : null;
});

export function finishDemo(raw: Record<string, unknown>, images: (string | null)[] = []): DemoContent {
  const r = raw as Record<string, Record<string, unknown> & unknown[]>;
  const brand = (r.brand ?? {}) as Record<string, string>;
  const name = str(brand.name, 60, 'Your business');
  const hero = (r.hero ?? {}) as Record<string, unknown>;
  const names = (r.names ?? {}) as Record<string, string>;
  const closing = (r.closing ?? {}) as Record<string, unknown>;
  const footer = (r.footer ?? {}) as Record<string, unknown>;
  const img = (v: unknown) => (typeof v === 'number' && images[v]) ? images[v] : null;
  const imgs = (r.images ?? {}) as Record<string, unknown>;
  const levels = list(r.levels, 5, l => {
    const o = l as Record<string, unknown>; const n = str(o?.name, 40); const body = str(o?.body, 240);
    if (!n || !body) return null;
    const im = o.image === 'band' || o.image === 'side' ? o.image : 'hero';
    return { name: n, body, image: im as 'hero' | 'band' | 'side', pins: pins(o.pins, 3) };
  });
  return {
    look: r.look === ('blueprint' as never) ? 'blueprint' : r.look === ('console' as never) ? 'console' : 'modern',
    brand: { name, word: str(brand.word, 24, name.split(' ')[0]), ...brandColours(brand.accent) },
    tz: typeof r.tz === 'string' && r.tz && !/^(null|none)$/i.test(r.tz) ? r.tz : null,
    centre: str(r.centre, 40), status: str(r.status, 40, 'Open for business'),
    meter: r.meter === ('page' as never) ? 'page' : 'percent',
    nav: list(r.nav, 4, x => str(x, 18) || null),
    hero: {
      kicker: str(hero.kicker, 60), lines: list(hero.lines, 3, x => str(x, 28) || null), sub: str(hero.sub, 260),
      cta: str(hero.cta, 40, 'Get in touch'), secondary: str(hero.secondary, 30, 'See what we do'),
    },
    images: { hero: img(imgs.hero), band: img(imgs.band), side: img(imgs.side) },
    badges: list(r.badges, 3, x => str(x, 32) || null),
    ticker: list(r.ticker, 8, x => str(x, 36) || null),
    statement: str(r.statement, 160),
    trust: str(r.trust, 80), micro: str(r.micro, 80), factsTitle: str(r.factsTitle, 70), factsSub: str(r.factsSub, 180),
    facts: list(r.facts, 3, f => { const o = f as Record<string, unknown>; const v = str(o?.value, 14), l = str(o?.label, 28); return v && l ? { value: v, label: l, note: str(o.note, 150) } : null; }),
    clients: list(r.clients, 8, x => str(x, 40) || null), highlight: str(r.highlight, 24),
    problem: (() => {
      const p = (r.problem ?? {}) as Record<string, unknown>;
      const points = list(p.points, 3, x => { const o = x as Record<string, unknown>; const t = str(o?.title, 40), b = str(o?.body, 190); return t && b ? { title: t, body: b } : null; });
      return { badge: str(p.badge, 24, 'The problem'), title: str(p.title, 70), body: str(p.body, 240), points: points.length >= 2 ? points : [], bridge: str(p.bridge, 160) };
    })(),
    results: list(r.results, 4, x => { const o = x as Record<string, unknown>; const v = str(o?.value, 12), l = str(o?.label, 40); return v && l ? { value: v, label: l, client: str(o.client, 40) } : null; }),
    partners: list(r.partners, 12, x => str(x, 36) || null),
    posts: list(r.posts, 3, x => { const o = x as Record<string, unknown>; const t = str(o?.title, 110); const u = typeof o?.url === 'string' && /^https?:/i.test(o.url) ? o.url : ''; return t ? { title: t, url: u } : null; }),
    socials: list(r.socials, 5, x => { const o = x as Record<string, unknown>; const n = str(o?.name, 16).toLowerCase(); const u = typeof o?.url === 'string' && /^https?:/i.test(o.url) ? o.url : ''; return n && u ? { name: n, url: u } : null; }),
    names: {
      idea: str(names.idea, 24, 'The idea'), levels: str(names.levels, 24, 'Services'), process: str(names.process, 24, 'The process'),
      why: str(names.why, 24, 'Why us'), faq: str(names.faq, 24, 'Questions'), start: str(names.start, 24, 'Start'), prefix: str(names.prefix, 3, ''),
    },
    levelsTitle: str(r.levelsTitle, 60), levels,
    processTitle: str(r.processTitle, 60),
    process: list(r.process, 5, p => { const o = p as Record<string, unknown>; const t = str(o?.title, 40), b = str(o?.body, 200); return t && b ? { title: t, body: b } : null; }),
    whyTitle: str(r.whyTitle, 50),
    why: list(r.why, 3, p => { const o = p as Record<string, unknown>; const t = str(o?.title, 40), b = str(o?.body, 200); return t && b ? { title: t, body: b } : null; }),
    quotes: list(r.quotes, 4, q => { const o = q as Record<string, unknown>; const t = str(o?.text, 220), n = str(o?.name, 40); return t && n ? { text: t, name: n, company: str(o.company, 50) } : null; }),
    coverageTitle: str(r.coverageTitle, 50), coverage: pins(r.coverage, 4),
    faqTitle: str(r.faqTitle, 50),
    faq: list(r.faq, 4, p => { const o = p as Record<string, unknown>; const q = str(o?.q, 100), a = str(o?.a, 260); return q && a ? { q, a } : null; }),
    closing: { title: str(closing.title, 70, 'Let us talk.'), body: str(closing.body, 160), cta: str(closing.cta, 40, 'Get in touch'), fields: list(closing.fields, 3, x => str(x, 36) || null) },
    footer: {
      blurb: str(footer.blurb, 200), place: str(footer.place, 60), site: str(footer.site, 60),
      columns: list(footer.columns, 2, c => { const o = c as Record<string, unknown>; const t = str(o?.title, 20); const l = list(o?.links, 5, x => str(x, 28) || null); return t && l.length ? { title: t, links: l } : null; }),
    },
    since: typeof r.since === 'number' ? r.since : null,
  };
}

// ─── Real examples, worded from each business's own website, used to check the designs (development only) ───

const A = 'https://ascendit.com.au/wp-content/uploads/2017/07';
const ASCEND = finishDemo({
  look: 'console', brand: { name: 'Ascend Business Technology', word: 'Ascend', accent: '#1b94c9' },
  tz: 'Australia/Perth', centre: 'Perth', status: 'All systems normal', meter: 'percent',
  nav: ['Levels', 'Process', 'Clients', 'FAQ'],
  hero: { kicker: 'IT support · Cloud · Infrastructure', lines: ['IT that stays', 'out of your way.'], sub: 'Perth businesses have called Ascend for IT support, cloud and infrastructure since 2007. Plain-English answers from people who already know your setup.', cta: 'Get a free IT consultation', secondary: 'See the four levels' },
  images: { hero: 0, band: 1, side: 2 },
  badges: ['Helpdesk online', 'Cloud backups running', 'Devices up to date'],
  ticker: ['Since 2007', 'Perth CBD and metro', 'Plain-English answers', 'One accountable team', 'Free IT consultation', 'Support, cloud, infrastructure'],
  statement: 'We take care of your IT, leaving you more time to focus on what you do best.',
  names: { idea: 'The idea', levels: 'The levels', process: 'The process', why: 'Why people stay', faq: 'Questions', start: 'Start', prefix: 'L' },
  levelsTitle: 'Four levels of looking after you.',
  levels: [
    { name: 'IT support', body: 'A dedicated team on hand to keep business running smoothly, so a broken laptop never becomes a lost afternoon.', image: 'hero', pins: [{ label: 'On hand when it breaks', x: 32, y: 40 }, { label: 'Business keeps running', x: 68, y: 62 }] },
    { name: 'Consulting', body: 'Technology that is powerful, reliable and, above all, easy to use, set up to grow with you instead of against you.', image: 'side', pins: [{ label: 'Powerful', x: 30, y: 34 }, { label: 'Reliable', x: 56, y: 56 }, { label: 'Easy to use', x: 74, y: 30 }] },
    { name: 'Cloud', body: 'Secure cloud and hybrid cloud, on locally hosted data centres with carrier-grade connectivity underneath.', image: 'band', pins: [{ label: 'Locally hosted data centres', x: 28, y: 42 }, { label: 'Carrier-grade connectivity', x: 58, y: 66 }, { label: 'Hybrid cloud', x: 78, y: 36 }] },
    { name: 'Infrastructure', body: 'Tried-and-tested systems, designed and put in by the people who will still be around to look after them.', image: 'band', pins: [{ label: 'Designed and put in', x: 40, y: 38 }, { label: 'Tried and tested', x: 70, y: 58 }] },
  ],
  processTitle: 'How a first conversation goes.',
  process: [
    { title: 'Talk to us', body: 'Book a free IT consultation and tell the team what is slowing yours down.' },
    { title: 'We work out what you need', body: 'The team works closely with you to identify your specific IT requirements.' },
    { title: 'Options in plain words', body: 'You get a range of options explained in down-to-earth terms, so the decision is an informed one.' },
    { title: 'Then we look after it', body: 'Support, cloud or infrastructure, managed centrally, with one team accountable for all of it.' },
  ],
  whyTitle: 'Why people stay.',
  why: [
    { title: 'Experience', body: 'Technicians with years behind them, so you get an answer, not a ticket number.' },
    { title: 'Centrally managed', body: 'Every part of your IT is looked after in one place, including the small details that usually slip through.' },
    { title: 'Total customer satisfaction', body: 'A policy that applies to every job, however big or small.' },
  ],
  quotes: [
    { text: 'They help us with advice, recommendations and service, and they look after us brilliantly.', name: 'Jamie Roden', company: 'Squires Real Estate' },
    { text: 'We have found Ascend to be flexible, respectful, responsive and knowledgeable.', name: 'Lyn Tomlinson', company: 'Richard Noble & Company' },
    { text: 'They are nice guys too. We would highly recommend them.', name: 'Stacey Falls', company: 'Weeding Women' },
  ],
  coverageTitle: 'Perth first. Interstate too.',
  coverage: [{ label: 'Perth CBD', x: 46, y: 38 }, { label: 'Metro area', x: 70, y: 60 }, { label: 'Interstate', x: 18, y: 28 }],
  faqTitle: 'Questions, answered plainly.',
  faq: [
    { q: 'Do you only work with businesses in the Perth CBD?', a: 'Perth CBD and the wider metro area are home, and Ascend looks after clients interstate as well.' },
    { q: 'Is the first consultation really free?', a: 'Yes. Book a free IT consultation and tell the team what is slowing yours down.' },
    { q: 'Will someone explain things without the jargon?', a: 'That is the aim. Ascend presents the options in down-to-earth terms so you can make an informed decision.' },
  ],
  closing: { title: 'Something slowing your team down?', body: 'Tell us. We will say what we would do, in plain words.', cta: 'Get a free IT consultation', fields: ['Your name', 'Work email', 'What is slowing you down?'] },
  footer: { blurb: 'Business IT support, consulting, cloud and infrastructure for small and medium businesses in Perth and beyond.', columns: [{ title: 'Four levels', links: ['IT support', 'Consulting', 'Cloud', 'Infrastructure'] }, { title: 'Ascend', links: ['Process', 'Clients', 'FAQ'] }], place: 'Perth, Western Australia', site: 'ascendit.com.au' },
  since: 2007,
}, [`${A}/page-title-home.jpg`, `${A}/panel-perth-city.jpg`, `${A}/panel-clients.jpg`]);

const CL = 'https://images.squarespace-cdn.com/content/v1/5d2c04030b71620001b07660';
const CLAYTON = finishDemo({
  look: 'blueprint', brand: { name: 'Clayton Consulting', word: 'Clayton', accent: '#c2410c' },
  tz: null, centre: 'Geraldton and Perth, WA', status: 'Bid response', meter: 'page',
  nav: ['Services', 'Process', 'Clients', 'FAQ'],
  hero: { kicker: 'Grants · Tenders · Business cases', lines: ['We write', 'to win.'], sub: 'APMP-certified grant and tender writing for businesses across Perth and regional Western Australia. Competitive submissions, written for you.', cta: 'Get help with your submission', secondary: 'See the services' },
  images: { hero: 0, band: 1, side: 0 },
  badges: ['APMP certified', 'Grants', 'Tenders'],
  ticker: ['APMP certified', 'Grants', 'Tenders', 'Business cases', 'Geraldton and Perth', 'Regional WA'],
  statement: 'Short on time? Not sure where to start with the application you downloaded?',
  names: { idea: 'The brief', levels: 'The services', process: 'The submission', why: 'Why Clayton', faq: 'Questions', start: 'Lodge', prefix: '§' },
  levelsTitle: 'Three documents we write to win.',
  levels: [
    { name: 'Grant writing', body: 'We help you find suitable grants and write competitive applications that get results, from equipment upgrades to major expansion projects.', image: 'hero', pins: [{ label: 'Find suitable grants', x: 36, y: 38 }, { label: 'Competitive applications', x: 64, y: 62 }] },
    { name: 'Business cases', body: 'Told to prepare a business case and not sure where to start? We prepare a strong one that aligns with government policy and shows robust economic modelling.', image: 'band', pins: [{ label: 'Aligned with policy', x: 30, y: 40 }, { label: 'Economic modelling', x: 62, y: 60 }] },
    { name: 'Tender and bid writing', body: 'Tender documents can be daunting after a hard day of work. We take the load off and help you submit compelling bids that stand out.', image: 'hero', pins: [{ label: 'Compelling bids', x: 44, y: 36 }, { label: 'Load off your shoulders', x: 66, y: 64 }] },
  ],
  processTitle: 'From the document you downloaded to a bid that stands out.',
  process: [
    { title: 'You send the brief', body: 'The grant, the tender or the business case request, and your deadline.' },
    { title: 'We read it properly', body: 'The criteria, the policy it sits under and where your business can score.' },
    { title: 'We write it with you', body: 'A competitive submission built around your business and your evidence.' },
    { title: 'You lodge with confidence', body: 'A bid that is clear, complete and ready to stand out.' },
  ],
  whyTitle: 'Why businesses choose Clayton.',
  why: [
    { title: 'APMP certified', body: 'Certified by the Association of Proposal Management Professionals, an international mark of expertise in writing winning proposals.' },
    { title: 'Regional, like you', body: 'Based in Geraldton, so we understand regional business challenges. We get it because we live it.' },
    { title: 'Clients who win', body: 'From Kalbarri to Dongara, the Wheatbelt and the Kimberley, clients have secured significant funding.' },
  ],
  quotes: [],
  coverageTitle: 'Perth, Geraldton and across Western Australia.',
  coverage: [{ label: 'Perth', x: 30, y: 62 }, { label: 'Geraldton', x: 22, y: 38 }, { label: 'Kimberley', x: 64, y: 22 }],
  faqTitle: 'Questions, answered plainly.',
  faq: [
    { q: 'Do you only work in Perth?', a: 'Geraldton and Perth are home, and Clayton helps customers all over Western Australia.' },
    { q: 'What do you write?', a: 'Grant applications, business cases, and tender and bid submissions.' },
    { q: 'Why does APMP certification matter?', a: 'It is an international certification that shows expertise in writing winning proposals.' },
  ],
  closing: { title: 'Ready to win your next grant or tender?', body: 'Leave a message and we will get back to you.', cta: 'Get help with your submission', fields: ['Your name', 'Email', 'What are you applying for?'] },
  footer: { blurb: 'APMP-certified grant, tender and business case writing for Western Australian businesses.', columns: [{ title: 'Services', links: ['Grant writing', 'Business cases', 'Tender and bid writing'] }, { title: 'Clayton', links: ['Process', 'FAQ'] }], place: 'Geraldton and Perth, Western Australia', site: 'claytonconsultingwa.com.au' },
  since: null,
}, [`${CL}/bebadd7f-843c-4c39-a48b-570d3e18cb3f/Priscilla+Clayton+-+full+size+%286%29+%281%29.jpg?format=2500w`, `${CL}/1565433516551-13SQSZSZ9EGULI4SN6WU/image-asset.jpeg?format=2500w`]);

const SW = 'https://www.simpleway.com.au/wp-content/uploads/2021';
const SIMPLEWAY = finishDemo({
  look: 'console', brand: { name: 'SimpleWay Consulting', word: 'SimpleWay', accent: '#1e87f0' },
  tz: 'Australia/Perth', centre: 'Perth', status: 'Process running', meter: 'percent',
  nav: ['Steps', 'Process', 'Why us', 'FAQ'],
  hero: { kicker: 'Business process · Systems · Training', lines: ['Fewer steps.', 'Better business.'], sub: 'SimpleWay finds where your business can improve, proposes solutions that increase accuracy and efficiency, and saves costs. One point of contact, not a stack of consultants.', cta: 'Improve my processes', secondary: 'See how it works' },
  images: { hero: 1, band: 0, side: 1 },
  badges: ['One point of contact', 'Tailored to you', 'Quality assured'],
  ticker: ['Efficiency', 'One point of contact', 'Strategic approach', 'Quality assurance', 'Perth, Western Australia'],
  statement: 'Leave it to us and we will manage all your business needs, so you do not have to deal with multiple consultants.',
  names: { idea: 'The idea', levels: 'The steps', process: 'The process', why: 'Why SimpleWay', faq: 'Questions', start: 'Start', prefix: 'S' },
  levelsTitle: 'Four steps from messy to simple.',
  levels: [
    { name: 'Process improvement', body: 'We analyse your company procedures to identify the improvements, then implement them.', image: 'band', pins: [{ label: 'Analyse procedures', x: 34, y: 40 }, { label: 'Implement improvements', x: 66, y: 60 }] },
    { name: 'Systems integration', body: 'We integrate your systems so that all of them talk to each other.', image: 'hero', pins: [{ label: 'Systems that talk', x: 40, y: 42 }, { label: 'One joined-up view', x: 66, y: 58 }] },
    { name: 'Company procedures', body: 'We develop your procedures with easy-to-understand infographics for employees.', image: 'band', pins: [{ label: 'Infographics', x: 36, y: 36 }, { label: 'Easy to follow', x: 64, y: 62 }] },
    { name: 'Training', body: 'Training in the new procedures, plus Microsoft Word and Excel, with handy tips, tricks and shortcuts.', image: 'hero', pins: [{ label: 'New procedures', x: 38, y: 40 }, { label: 'Word and Excel', x: 64, y: 60 }] },
  ],
  processTitle: 'How we work with you.',
  process: [
    { title: 'Find the gaps', body: 'We identify areas of improvement in your business.' },
    { title: 'Propose solutions', body: 'Solutions that increase accuracy and efficiency and save costs, tailored to your company.' },
    { title: 'Put them in place', body: 'Through one personalised point of contact, with the help of our local partners.' },
    { title: 'Keep the quality up', body: 'We strive for quality and attention to detail at every step.' },
  ],
  whyTitle: 'Why SimpleWay.',
  why: [
    { title: 'Efficiency', body: 'Improve your business processes and increase productivity.' },
    { title: 'One point of contact', body: 'You will not have to deal with multiple companies to improve your business.' },
    { title: 'Strategic approach', body: 'Tailored to your company\'s specific requirements.' },
  ],
  quotes: [],
  coverageTitle: '', coverage: [],
  faqTitle: 'Questions, answered plainly.',
  faq: [
    { q: 'Where do you work?', a: 'SimpleWay has a presence in Perth, Western Australia, and assists clients to improve their business operations.' },
    { q: 'Will I deal with several consultants?', a: 'No. You get a personalised single point of contact, thanks to partnerships with small local businesses.' },
  ],
  closing: { title: 'Want your business to run simpler?', body: 'Tell us what takes too many steps today.', cta: 'Improve my processes', fields: ['Your name', 'Work email', 'Which process is slow?'] },
  footer: { blurb: 'Business consultants in Perth, Western Australia, improving business operations.', columns: [{ title: 'Steps', links: ['Process improvement', 'Systems integration', 'Company procedures', 'Training'] }, { title: 'SimpleWay', links: ['Process', 'Why us', 'FAQ'] }], place: 'Perth, Western Australia', site: 'simpleway.com.au' },
  since: null,
}, [`${SW}/07/SW_Business-improvement-strategies-1.png`, `${SW}/06/Working-Space.png`]);

// The same three businesses in the Modern look, to compare with the Datum-style looks above.
const asModern = (d: DemoContent, extra: Partial<DemoContent>, accent?: string): DemoContent => ({
  ...d, ...extra, look: 'modern', brand: accent ? { ...d.brand, ...brandColours(accent) } : d.brand,
});
const ASCEND_M = asModern(ASCEND, {
  problem: {
    badge: 'The problem', title: 'IT keeps pulling you away from the business.',
    body: 'When nobody owns the technology, small problems turn into lost hours and the same questions to a different support line each time.',
    points: [
      { title: 'Support that starts over', body: 'Every call begins with explaining your setup again to someone who has never seen it.' },
      { title: 'Tools that do not fit', body: 'Cloud, email and security bought piece by piece, each from a different supplier.' },
      { title: 'Nobody who owns it', body: 'When something breaks, it is unclear who is responsible for fixing it.' },
    ],
    bridge: 'Ascend gives small and medium businesses one team that knows the setup and looks after all of it.',
  },
  highlight: 'time', clients: ['Squires Real Estate', 'Richard Noble & Company', 'Weeding Women', 'Lawnswood Pet Cremation', 'Coterra Environment'],
  trust: 'Supporting Perth businesses since 2007', micro: 'Free consultation · Perth CBD and metro',
  factsTitle: 'IT that fits the way you work.', factsSub: 'Ascend looks after IT, cloud and infrastructure for small and medium businesses, with one accountable team.',
  facts: [
    { value: '19', label: 'Years in Perth', note: 'Supporting Perth businesses since 2007.' },
    { value: '4', label: 'Services', note: 'IT support, consulting, cloud and infrastructure, looked after by one team.' },
    { value: '1', label: 'Accountable team', note: 'Centrally managed, so the small details do not slip through.' },
  ],
});
const CLAYTON_M = asModern(CLAYTON, {
  highlight: 'start', clients: ['Seaspray Holiday Park Dongara', 'Mid West Horticulture Grower Group', 'Rainbow Jungle Kalbarri'],
  trust: 'APMP-certified, based in Geraldton and Perth', micro: 'Grants · Tenders · Business cases',
  factsTitle: 'Written to win.', factsSub: 'Grant, tender and business case writing for businesses across Western Australia.',
  facts: [
    { value: 'APMP', label: 'Certified', note: 'An international certification in writing winning proposals.' },
    { value: '3', label: 'Document types', note: 'Grants, business cases, and tender and bid submissions.' },
    { value: 'WA', label: 'Statewide', note: 'Based in Geraldton and Perth, helping customers all over Western Australia.' },
  ],
}, '#0f766e');
const SIMPLEWAY_M = asModern(SIMPLEWAY, {
  highlight: 'manage', clients: [],
  trust: 'Business consultants in Perth, Western Australia', micro: 'One point of contact · Tailored to you',
  factsTitle: 'Simpler processes, one point of contact.', factsSub: 'SimpleWay finds where your business can improve and proposes solutions that increase accuracy and efficiency.',
  facts: [
    { value: '4', label: 'Areas of focus', note: 'Process improvement, systems integration, company procedures and training.' },
    { value: '1', label: 'Point of contact', note: 'No juggling multiple consultants to improve your business.' },
    { value: 'Perth', label: 'Based in WA', note: 'Business consultants with a presence in Perth, Western Australia.' },
  ],
});

// Development only: Ascend with the optional sections filled with clearly marked placeholder material, to check their layout.
const ASCEND_FULL = asModern(ASCEND_M, {
  results: [{ value: '2007', label: 'Supporting Perth since', client: 'Ascend' }, { value: '4', label: 'Services, one team', client: 'Ascend' }, { value: '24/7', label: 'Availability, as one client puts it', client: 'Stacey Falls' }],
  partners: ['Placeholder partner', 'Placeholder partner', 'Placeholder partner', 'Placeholder partner', 'Placeholder partner', 'Placeholder partner'],
  posts: [{ title: 'Placeholder article title one', url: '' }, { title: 'Placeholder article title two', url: '' }, { title: 'Placeholder article title three', url: '' }],
  socials: [{ name: 'linkedin', url: 'https://example.com' }, { name: 'facebook', url: 'https://example.com' }],
});

export const SAMPLE_DEMOS: Record<string, DemoContent> = {
  'ascend-full': ASCEND_FULL,
  sample: ASCEND, 'sample-clayton': CLAYTON, 'sample-simpleway': SIMPLEWAY,
  'ascend-modern': ASCEND_M, 'ascend-plain': { ...ASCEND_M, images: { hero: null, band: null, side: null }, quotes: [] }, 'clayton-modern': CLAYTON_M, 'simpleway-modern': SIMPLEWAY_M,
};
export const SAMPLE_DEMO = ASCEND;
