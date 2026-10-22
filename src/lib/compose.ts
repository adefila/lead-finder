export function splitDraft(draft: string): { subject: string; body: string } {
  const match = draft.match(/^\s*Subject:\s*(.*)\n+/i);
  if (!match) return { subject: '', body: draft.trim() };
  return { subject: match[1].trim(), body: draft.slice(match[0].length).trim() };
}

export function gmailComposeUrl(to: string, subject: string, body: string): string {
  const e = encodeURIComponent;
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${e(to)}&su=${e(subject)}&body=${e(body)}`;
}

export function mailtoUrl(to: string, subject: string, body: string): string {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Drafts must read like a person typed them: no em/en dashes, no curly-quote artifacts.
export function humanize(text: string): string {
  return text
    .replace(/\s*[—–]\s*(?=\d)/g, '-')
    .replace(/\s+[—–]\s+/g, ', ')
    .replace(/[—–]/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

type Lang = 'en' | 'nl' | 'no' | 'fr';

// The line that introduces the one-page note, and the words its link hides behind in HTML.
const NOTE_INTRO: Record<Lang, { line: string; linkText: string; before: string }> = {
  en: { line: 'I put together a short one-page note with a few ideas for you:', before: 'I put together a', linkText: 'short one-page note with a few ideas for you' },
  nl: { line: 'Ik heb een korte notitie van één pagina met een paar ideeën voor u gemaakt:', before: 'Ik heb een', linkText: 'korte notitie van één pagina met een paar ideeën voor u gemaakt' },
  no: { line: 'Jeg har laget et kort notat på én side med noen ideer til dere:', before: 'Jeg har laget et', linkText: 'kort notat på én side med noen ideer til dere' },
  fr: { line: "J'ai préparé une courte note d'une page avec quelques idées pour vous :", before: "J'ai préparé une", linkText: "courte note d'une page avec quelques idées pour vous" },
};

// Adds one line linking to the lead's one-page note, before the "no worries if not" line
// and the sign-off. Safe to call twice.
const OPT_OUT_LINE = /not something you need|just say so|won't follow up|will not follow up|not for you|no worries|not the right time|let me know if not|geen probleem|laat het (me|mij) (gerust )?weten|niet voor u|ikke noe problem|bare si fra|ikke for dere|pas de souci|aucun (souci|problème)|dites-le-moi|n'hésitez pas à me le dire|je ne vous relancerai pas|niets voor u|niet iets voor u|mail ik u niet meer|noe for (deg|dere)|si fra|ikke å svare|sender jeg ikke mer|ne vous intéresse pas|pas utile pour vous|pas besoin de répondre/i;

export function withCheckLink(body: string, link?: string, lang: Lang = 'en'): string {
  if (!link || body.includes(link) || /\/(check|n)\/[\w-]/.test(body)) return body;
  const line = `${NOTE_INTRO[lang].line}\n${link}`;
  const paras = body.trimEnd().split(/\n\s*\n/);
  let at = paras.findIndex(p => /^Samuel\b/.test(p.trim()));
  if (at < 0) at = paras.length;
  if (at > 0 && OPT_OUT_LINE.test(paras[at - 1])) at -= 1;
  paras.splice(at, 0, line);
  return paras.join('\n\n');
}

// One plain-text signature on every email the app sends. Plain text, one link, no images:
// that keeps it friendly to spam filters. The middle line follows the email's language.
const TAGLINE: Record<Lang, string> = {
  en: 'Websites and simple systems for small businesses',
  nl: 'Websites en eenvoudige systemen voor kleine bedrijven',
  no: 'Nettsider og enkle systemer for små bedrifter',
  fr: 'Sites web et systèmes simples pour les petites entreprises',
};
// Job applications and emails to hiring managers are signed with a job title instead.
const JOB_TAGLINE = 'Web Developer & Framer Designer';
// Business pitches sign with the page written for them; everything else with the homepage.
export const BUSINESS_PATH = '/local-business';
const SITE_LINES = ['adefilasamuel.com', `adefilasamuel.com${BUSINESS_PATH}`];
const signatureFor = (lang: Lang, forJob = false, forBusiness = false) =>
  `Samuel Adefila\n${forJob ? JOB_TAGLINE : TAGLINE[lang]}\nadefilasamuel.com${forBusiness && !forJob ? BUSINESS_PATH : ''}`;
export const SIGNATURE = signatureFor('en');

// Swaps the draft's short sign-off ("Samuel", maybe followed by the website) for the full
// signature, or adds it if the draft has none. Safe to call twice.
export function withSignature(body: string, lang: Lang = 'en', forJob = false, forBusiness = false): string {
  const SIGNATURE = signatureFor(lang, forJob, forBusiness);
  const text = body.trimEnd();
  if (text.endsWith(SIGNATURE)) return text;
  // A draft that already carries a full signature (either address) gets the right address
  for (const t of [...Object.values(TAGLINE), JOB_TAGLINE]) {
    for (const site of SITE_LINES) {
      const old = `Samuel Adefila\n${t}\n${site}`;
      if (text.endsWith(old)) return `${text.slice(0, -old.length).trimEnd()}\n\n${SIGNATURE}`;
    }
  }
  const lines = text.split('\n');
  const at = lines.map(l => l.trim()).lastIndexOf('Samuel');
  const tail = at >= 0 ? lines.slice(at + 1).map(l => l.trim()).filter(Boolean) : [];
  // The draft's own sign-off ("Samuel" then adefilasamuel.com) is dropped so the signature is not doubled. The model
  // sometimes puts the opt-out line AFTER that sign-off ("Not interested? Just let me know..."): keep that line,
  // moved above the signature, instead of leaving the old sign-off in the middle of the email.
  const siteLines = tail.filter(l => /adefilasamuel\.com/i.test(l));
  const otherLines = tail.filter(l => !/adefilasamuel\.com/i.test(l));
  const isSignOff = at >= 0 && tail.length <= 4 && otherLines.length <= 2 && otherLines.every(l => l.length <= 200)
    && (siteLines.length > 0 || otherLines.length === 0);
  const main = isSignOff ? [lines.slice(0, at).join('\n').trimEnd(), ...otherLines].filter(Boolean).join('\n\n') : text;
  return `${main}\n\n${SIGNATURE}`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// A plain-looking HTML copy of the email: same words, but the note link hides behind
// friendly text ("a short one-page note") instead of a long web address. No images,
// no colours, so it still reads like a person typed it.
// siteUrl: a tracked link to use for "adefilasamuel.com", so a visit from this email is recorded.
export function toHtml(text: string, siteUrl = 'https://adefilasamuel.com'): string {
  const paras = text.trim().split(/\n\s*\n/).map(p => {
    for (const intro of Object.values(NOTE_INTRO)) {
      if (!p.startsWith(intro.line)) continue;
      const url = p.slice(intro.line.length).trim();
      if (/^https?:\/\/\S+$/.test(url)) return `${esc(intro.before)} <a href="${esc(url)}">${esc(intro.linkText)}</a>.`;
    }
    return esc(p)
      .replace(/(https?:\/\/[^\s<]+)/g, u => `<a href="${u}">${u.replace(/^https?:\/\//, '')}</a>`)
      .replace(/(^|\n|\s)(adefilasamuel\.com(?:\/local-business)?)(?=\s|$)/g, `$1<a href="${esc(siteUrl)}">$2</a>`)
      .replace(/\n/g, '<br>');
  });
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${paras.map(p => `<p style="margin:0 0 14px">${p}</p>`).join('')}</div>`;
}
