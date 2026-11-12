// Your profile for matching: the text of your CV or portfolio, and what is read out of it. Nothing here calls a paid
// service. Files are read with free open-source libraries, and only the extracted text is kept (never the file).

export interface Profile {
  text: string;
  skills: string[];
  titles: string[];
  years: number | null;
  source: string;        // "CV.pdf", "pasted text" or the portfolio link
  updatedAt: string;
}

// name, how it is written, and how much it matters for a match (tools Samuel is hired for weigh most)
export const SKILLS: { name: string; re: RegExp; weight: number }[] = [
  { name: 'Framer', re: /\bframer\b/i, weight: 3 },
  { name: 'Webflow', re: /\bwebflow\b/i, weight: 3 },
  { name: 'Figma', re: /\bfigma\b/i, weight: 2 },
  { name: 'UI/UX design', re: /\bui\s*\/\s*ux\b|\bux\s*\/\s*ui\b|\bui\b.{0,12}\bux\b|user (interface|experience)|\b(ux|ui) design/i, weight: 2 },
  { name: 'Product design', re: /product design/i, weight: 2 },
  { name: 'Design systems', re: /design systems?/i, weight: 2 },
  { name: 'Prototyping', re: /prototyp/i, weight: 1 },
  { name: 'Wireframing', re: /wireframe|wireframing/i, weight: 1 },
  { name: 'User research', re: /user research|usability test/i, weight: 1 },
  { name: 'Branding', re: /\bbranding\b|brand identity/i, weight: 1 },
  { name: 'Landing pages', re: /landing[- ]pages?/i, weight: 2 },
  { name: 'Marketing websites', re: /marketing (site|website|page)s?/i, weight: 2 },
  { name: 'Web design', re: /web ?design/i, weight: 2 },
  { name: 'Front-end', re: /front[- ]?end/i, weight: 2 },
  { name: 'React', re: /\breact(\.js|js)?\b/i, weight: 2 },
  { name: 'Next.js', re: /\bnext\.?js\b/i, weight: 2 },
  { name: 'TypeScript', re: /\btypescript\b/i, weight: 2 },
  { name: 'JavaScript', re: /\bjavascript\b/i, weight: 2 },
  { name: 'HTML/CSS', re: /\bhtml\b|\bcss\b/i, weight: 1 },
  { name: 'Tailwind', re: /\btailwind/i, weight: 1 },
  { name: 'Node.js', re: /\bnode(\.js|js)?\b/i, weight: 1 },
  { name: 'Supabase', re: /\bsupabase\b/i, weight: 1 },
  { name: 'Firebase', re: /\bfirebase\b/i, weight: 1 },
  { name: 'PostgreSQL', re: /postgres/i, weight: 1 },
  { name: 'REST APIs', re: /\brest(ful)? ?apis?\b|\bapis?\b/i, weight: 1 },
  { name: 'Python', re: /\bpython\b/i, weight: 1 },
  { name: 'GSAP', re: /\bgsap\b/i, weight: 1 },
  { name: 'Framer Motion', re: /framer motion/i, weight: 1 },
  { name: 'Three.js / WebGL', re: /three\.?js|webgl/i, weight: 1 },
  { name: 'Motion design', re: /motion design|animation/i, weight: 1 },
  { name: 'WordPress', re: /\bwordpress\b/i, weight: 2 },
  { name: 'Shopify', re: /\bshopify\b/i, weight: 2 },
  { name: 'Headless CMS', re: /headless|contentful|sanity|strapi|payload cms|\bcms\b/i, weight: 1 },
  { name: 'SEO', re: /\bseo\b|search engine optimi[sz]ation/i, weight: 1 },
  { name: 'Analytics', re: /\bga4\b|google analytics|analytics/i, weight: 1 },
  { name: 'A/B testing', re: /a\/b test|\bcro\b|conversion (rate )?optimi[sz]ation/i, weight: 1 },
  { name: 'Accessibility', re: /accessib|\bwcag\b/i, weight: 1 },
  { name: 'Responsive design', re: /responsive/i, weight: 1 },
  { name: 'Web performance', re: /web performance|core web vitals|page speed|lighthouse/i, weight: 1 },
  { name: 'No-code', re: /no-?code|low-?code/i, weight: 2 },
  { name: 'Git', re: /\bgit(hub)?\b/i, weight: 1 },
  { name: 'Agile', re: /\bagile\b|\bscrum\b/i, weight: 1 },
];

const MAX_CHARS = 60_000;

const clean = (t: string) => t.replace(/\u0000/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_CHARS);

const stripHtml = (html: string) => html
  .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<\/(p|li|h\d|div|section|br)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"');

// A PDF, a Word file (.docx) or a plain text file.
export async function textFromFile(name: string, buf: Uint8Array): Promise<string> {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });
    return clean(String(text));
  }
  if (lower.endsWith('.docx')) {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
    return clean(result.value);
  }
  if (/\.(txt|md|markdown|html?)$/.test(lower)) {
    const raw = Buffer.from(buf).toString('utf8');
    return clean(/\.html?$/.test(lower) ? stripHtml(raw) : raw);
  }
  throw new Error('Use a PDF, a Word file (.docx) or a text file');
}

// A portfolio link: the visible text of that page.
export async function textFromUrl(url: string): Promise<string> {
  let u: URL;
  try { u = new URL(url); } catch { throw new Error('That does not look like a web address'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Use a web address starting with https://');
  const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadFinder/1.0)' }, signal: AbortSignal.timeout(12_000) }).catch(() => null);
  if (!res || !res.ok) throw new Error('Could not open that link');
  const type = res.headers.get('content-type') ?? '';
  if (!/html|text/.test(type)) throw new Error('That link is not a web page. Upload the file instead');
  return clean(stripHtml(await res.text()));
}

const TITLE = /\b((?:senior|lead|principal|staff|junior)\s+)?((?:web|front[- ]?end|full[- ]?stack|product|ui\s*\/?\s*ux|ui|ux|graphic|visual|brand|framer|webflow|software|creative)\s+(?:designer|developer|engineer))\b/gi;

// Years of experience: "5+ years", or the spread of the dates in the CV.
function yearsOf(text: string): number | null {
  const said = [...text.matchAll(/\b(\d{1,2})\+?\s*(?:years?|yrs)\b(?:'?\s*of)?\s*(?:professional |work |industry )?(?:experience)?/gi)]
    .map(m => Number(m[1])).filter(n => n >= 1 && n <= 40);
  if (said.length) return Math.max(...said);
  const now = new Date().getFullYear();
  const spans = [...text.matchAll(/\b(19[89]\d|20[0-2]\d)\b/g)].map(m => Number(m[1])).filter(y => y <= now);
  if (!spans.length) return null;
  const first = Math.min(...spans);
  return now - first >= 1 && now - first <= 40 ? now - first : null;
}

export function extractProfile(text: string, source: string): Profile {
  const skills = SKILLS.filter(s => s.re.test(text)).map(s => s.name);
  const titles = [...new Set([...text.slice(0, 6000).matchAll(TITLE)].map(m => `${m[1] ?? ''}${m[2]}`.toLowerCase().replace(/\s+/g, ' ').trim()))].slice(0, 6);
  return { text, skills, titles, years: yearsOf(text), source, updatedAt: new Date().toISOString() };
}
