import * as cheerio from 'cheerio';

// Reads a business's own website for the demo: what it says, what it shows and what colour it uses.
// Free: plain page fetches, no model involved.

export interface SiteScan {
  url: string;
  title: string;
  description: string;
  nav: string[];
  headings: string[];
  paragraphs: string[];
  bullets: string[];
  quotes: { text: string; by: string }[];
  images: string[];            // best first, absolute URLs
  colors: string[];            // brand colours, most used first
  since: number | null;
  lang: string;
  socials: { name: string; url: string }[];
  articles: { title: string; url: string }[];
  logo: string | null;                          // the business's own logo, absolute URL
  brandColor: string | null;                    // the colour the business is actually known by (logo, then stylesheet variables)
  clientLogos: { name: string; url: string }[]; // logos in the site's own clients or partners strip
}

// The logo: the image in the header that is named or classed as a logo, else the site's touch icon.
function findLogo($: cheerio.CheerioAPI, base: string): string | null {
  const pick = (sel: string): string | null => {
    for (const el of $(sel).toArray()) {
      const u = abs($(el).attr('src') ?? $(el).attr('data-src'), base);
      if (u && !/sprite|payment|flag/i.test(u)) return u;
    }
    return null;
  };
  const home = (el: Parameters<typeof $>[0]) => { const a = $(el).closest('a'); const h = a.attr('href') ?? ''; return !!a.length && (h === '/' || h === '' || h === './' || (() => { try { return new URL(h, base).pathname === '/'; } catch { return false; } })()); };
  const bad = /charter|award|member|accredit|certif|iso[-_ ]?\d|partner|client|badge|trust|women|stamp|seal|cyber[-_ ]?essentials|gold|silver|acclogo|affiliate|sector|icon|arrow|back-to|search|menu|burger|close|social|chevron|supplier|government|hmg|framework|cloud-?supplier/i;
  const stem = (() => { try { return new URL(base).hostname.replace(/^www\./, '').split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, ''); } catch { return ''; } })();
  const found = $('img').toArray().map(el => ({ el, u: abs($(el).attr('src') ?? $(el).attr('data-src'), base), label: `${$(el).attr('src') ?? ''} ${$(el).attr('alt') ?? ''} ${$(el).attr('class') ?? ''}` }))
    .filter(x => x.u && !/sprite|payment|flag/i.test(x.u) && !bad.test(x.label))
    .map(x => ({ ...x, score: (home(x.el) ? 5 : 0) + (/logo/i.test(x.label) ? 4 : 0) + ($(x.el).closest('header, nav, [class*="header" i], [class*="logo" i]').length ? 3 : 0) }))
    .filter(x => x.score >= 4 && (home(x.el) || /logo/i.test(x.label) || (stem.length > 3 && x.label.toLowerCase().replace(/[^a-z0-9]/g, '').includes(stem)))).sort((x, y) => y.score - x.score);
  const fromImg = found[0]?.u ?? null;
  if (fromImg) return fromImg;
  const icons = $('link[rel~="apple-touch-icon"], link[rel~="icon"][type="image/png"], link[rel~="icon"][type="image/svg+xml"], link[rel~="icon"]').toArray()
    .map(l => ({ u: abs($(l).attr('href'), base), size: parseInt(($(l).attr('sizes') ?? '0').split('x')[0]) || 0 }))
    .filter((i): i is { u: string; size: number } => !!i.u && !/\.ico(\?|$)/i.test(i.u)).sort((a, b) => b.size - a.size);
  return icons[0]?.u ?? null;
}

// Logos in a section the site calls clients, customers, partners or trusted-by.
function findClientLogos($: cheerio.CheerioAPI, base: string): { name: string; url: string }[] {
  const out: { name: string; url: string }[] = [];
  $('[class*="client" i], [class*="customer" i], [class*="partner" i], [class*="trusted" i], [class*="brands" i], [id*="client" i], [id*="partner" i]').each((_, sec) => {
    $(sec).find('img').each((__, i) => {
      const url = abs($(i).attr('src') ?? $(i).attr('data-src'), base);
      const name = clean($(i).attr('alt') ?? '').replace(/\s*logo\s*$/i, '');
      if (!url || !name || name.length > 40 || /logo$/i.test(name) && name.length < 6 || out.some(o => o.url === url || o.name.toLowerCase() === name.toLowerCase())) return;
      out.push({ name, url });
    });
  });
  return out.slice(0, 10);
}

// The most common saturated colour in an image (the logo), read at a tiny size. Null when it cannot be read.
async function logoColour(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 3_000_000) return null;
    const sharp = (await import('sharp')).default;
    const { data, info } = await sharp(buf, { density: 96 }).resize(48, 48, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const bins = new Map<string, number>();
    for (let i = 0; i < data.length; i += info.channels) {
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
      if (a < 200) continue;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max - min < 45 || max < 50 || min > 225) continue;
      const k = [r, g, b].map(v => Math.round(v / 24) * 24).join(',');
      bins.set(k, (bins.get(k) ?? 0) + 1);
    }
    const top = [...bins.entries()].sort((x, y) => y[1] - x[1])[0];
    if (!top || top[1] < 12) return null;
    return '#' + top[0].split(',').map(v => Math.min(255, Number(v)).toString(16).padStart(2, '0')).join('');
  } catch { return null; }
}

const UA = 'Mozilla/5.0 (compatible; LeadFinder/1.0)';
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

async function get(url: string, max = 1_500_000): Promise<{ text: string; url: string } | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,text/css,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    return { text: (await res.text()).slice(0, max), url: res.url };
  } catch { return null; }
}

const abs = (src: string | undefined, base: string): string | null => {
  if (!src) return null;
  const clean = src.replace(/&quot;|&#34;|&amp;/g, m => (m === '&amp;' ? '&' : '')).replace(/^["'s]+|["'s]+$/g, '');
  if (!clean || clean.startsWith('data:')) return null;
  try { return new URL(clean, base).toString(); } catch { return null; }
};

// Colours that say something about the brand: not white, black or grey.
function hexColors(css: string): string[] {
  const count = new Map<string, number>();
  for (const m of css.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
    let h = m[1].toLowerCase();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max - min < 40 || max < 60 || min > 215) continue;      // greys, near black, near white
    count.set(`#${h}`, (count.get(`#${h}`) ?? 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 4);
}

export async function scanSite(url: string): Promise<SiteScan | null> {
  const page = await get(url);
  if (!page) return null;
  const $ = cheerio.load(page.text);
  const base = page.url;

  const meta = (n: string) => $(`meta[property="${n}"], meta[name="${n}"]`).attr('content') ?? '';
  const themeColor = meta('theme-color');
  const logo = findLogo($, base);
  const clientLogos = findClientLogos($, base);
  $('script, style, noscript, svg, iframe, form').each((_, e) => { if (e.tagName === 'style') return; $(e).remove(); });

  const nav = [...new Set($('nav a, header a').map((_, a) => clean($(a).text())).get().filter(t => t && t.length < 28))].slice(0, 12);
  const headings = $('h1, h2, h3').map((_, h) => clean($(h).text())).get().filter(t => t.length > 2 && t.length < 120).slice(0, 40);
  const paragraphs = $('p').map((_, p) => clean($(p).text())).get().filter(t => t.length >= 60 && t.length < 600).slice(0, 30);
  const bullets = $('li').map((_, l) => clean($(l).text())).get().filter(t => t.length > 12 && t.length < 100).slice(0, 40);

  const quotes: { text: string; by: string }[] = [];
  $('blockquote, [class*="testimonial"], [class*="quote"]').each((_, e) => {
    const text = clean($(e).find('p').first().text() || $(e).text());
    const by = clean($(e).find('cite, footer, [class*="author"], [class*="name"], strong').first().text());
    if (text.length >= 40 && text.length < 360 && !quotes.some(q => q.text === text)) quotes.push({ text: text.replace(by, '').trim(), by });
  });

  // Social profiles and recent articles, only as the site itself links them
  const socials: { name: string; url: string }[] = [];
  const articles: { title: string; url: string }[] = [];
  $('a[href]').each((_, a) => {
    const href = abs($(a).attr('href'), base); if (!href) return;
    const host = new URL(href).hostname.replace(/^www\./, '');
    const net = /(linkedin|facebook|instagram|youtube|twitter|x)\.com$/.exec(host)?.[1];
    if (net && !socials.some(x => x.name === net) && new URL(href).pathname.length > 1) socials.push({ name: net === 'x' ? 'twitter' : net, url: href });
    const text = clean($(a).text());
    if (host === new URL(base).hostname.replace(/^www\./, '') && /\/(blog|news|insights?|articles?|posts?)\/[^/]+/i.test(new URL(href).pathname) && text.length >= 18 && text.length <= 110 && !articles.some(x => x.url === href)) articles.push({ title: text, url: href });
  });

  // Pictures: skip logos, icons and tiny images; prefer wide ones and names that sound like a hero.
  const scored = new Map<string, number>();
  const add = (src: string | undefined, bonus = 0) => {
    const u = abs(src, base);
    if (!u || /\.(svg|ico|gif)(\?|$)/i.test(u) || /logo|icon|sprite|avatar|favicon|flag|badge|payment/i.test(u)) return;
    scored.set(u, Math.max(scored.get(u) ?? 0, bonus + (/hero|banner|header|cover|team|office|about|home|panel|slider/i.test(u) ? 3 : 0) + (/\.(jpe?g|webp|avif)(\?|$)/i.test(u) ? 1 : 0)));
  };
  add(meta('og:image'), 6);
  $('img').each((_, i) => {
    const w = Number($(i).attr('width') ?? 0), h = Number($(i).attr('height') ?? 0);
    if ((w && w < 200) || (h && h < 120)) return;
    const srcset = $(i).attr('srcset');
    const best = srcset ? srcset.split(',').map(s => s.trim().split(/\s+/)).sort((a, b) => parseInt(b[1] ?? '0') - parseInt(a[1] ?? '0'))[0]?.[0] : undefined;
    add(best ?? $(i).attr('data-src') ?? $(i).attr('src'), w >= 600 ? 3 : 1);
  });
  const style = page.text;
  for (const m of style.matchAll(/url\(["']?([^"')]+\.(?:jpe?g|png|webp)[^"')]*)["']?\)/gi)) add(m[1], 2);

  // The stylesheet is where brand colours usually live.
  let css = $('style').text() + ' ' + (page.text.match(/style="[^"]*"/g) ?? []).join(' ');
  const sheets = $('link[rel="stylesheet"]').map((_, l) => abs($(l).attr('href'), base)).get().filter(Boolean).slice(0, 2) as string[];
  const sheetUrls: [string, string][] = [];
  for (const s of sheets) { const c = await get(s, 400_000); if (c) { css += ' ' + c.text; sheetUrls.push([c.text, c.url]); } }
  for (const [text, from] of sheetUrls) for (const m of text.matchAll(/url(([^)]+.(?:jpe?g|webp)[^)]*))/gi)) { const u = abs(m[1], from); if (u) add(u, 2); }
  const colors = [...new Set([...(themeColor && /^#/.test(themeColor) && hexColors(themeColor).length ? [themeColor.toLowerCase()] : []), ...hexColors(css)])].slice(0, 4);

  // The exact brand colour: the logo's own colour first, then a stylesheet variable named for the brand, then theme-color.
  const fromVar = [...css.matchAll(/--[\w-]*(?:primary|brand|accent|main|theme)[\w-]*\s*:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b/gi)].map(m => m[1].toLowerCase())
    .map(h => (h.length === 4 ? '#' + h.slice(1).split('').map(c => c + c).join('') : h)).find(h => hexColors(h).length > 0) ?? null;
  const fromLogo = logo ? await logoColour(logo) : null;
  const brandColor = fromLogo ?? fromVar ?? colors[0] ?? null;
  if (brandColor && !colors.includes(brandColor)) colors.unshift(brandColor);

  const text = `${headings.join(' ')} ${paragraphs.join(' ')}`;
  const sinceM = text.match(/\b(?:since|est\.?|established|founded(?: in)?)\s*(19\d{2}|20[0-2]\d)\b/i);

  return {
    url: base, title: clean($('title').text()), description: clean(meta('description') || meta('og:description')),
    nav, headings, paragraphs, bullets, quotes: quotes.slice(0, 5),
    images: [...scored.entries()].sort((a, b) => b[1] - a[1]).map(([u]) => u).slice(0, 12),
    colors, since: sinceM ? Number(sinceM[1]) : null, lang: $('html').attr('lang') ?? 'en',
    socials: socials.slice(0, 5), articles: articles.slice(0, 6),
    logo, brandColor, clientLogos,
  };
}
