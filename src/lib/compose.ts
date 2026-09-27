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

// Adds one line linking to the lead's one-page note, before the "no worries if not" line
// and the sign-off. Safe to call twice.
const OPT_OUT_LINE = /not something you need|just say so|won't follow up|will not follow up|not for you|no worries|not the right time|let me know if not/i;

export function withCheckLink(body: string, link?: string): string {
  if (!link || body.includes('/check/')) return body;
  const line = `I put together a short one-page note with a few ideas for you:\n${link}`;
  const paras = body.trimEnd().split(/\n\s*\n/);
  let at = paras.findIndex(p => /^Samuel\b/.test(p.trim()));
  if (at < 0) at = paras.length;
  if (at > 0 && OPT_OUT_LINE.test(paras[at - 1])) at -= 1;
  paras.splice(at, 0, line);
  return paras.join('\n\n');
}

// One plain-text signature on every email the app sends. Plain text, one link, no images:
// that keeps it friendly to spam filters.
export const SIGNATURE = 'Samuel Adefila\nWebsites and simple systems for small businesses\nadefilasamuel.com';

// Swaps the draft's short sign-off ("Samuel", maybe followed by the website) for the full
// signature, or adds it if the draft has none. Safe to call twice.
export function withSignature(body: string): string {
  const text = body.trimEnd();
  if (text.endsWith(SIGNATURE)) return text;
  const lines = text.split('\n');
  const at = lines.map(l => l.trim()).lastIndexOf('Samuel');
  const tail = at >= 0 ? lines.slice(at + 1).map(l => l.trim()).filter(Boolean) : [];
  const isSignOff = at >= 0 && tail.length <= 2 && tail.every(l => /adefilasamuel\.com/i.test(l));
  const main = isSignOff ? lines.slice(0, at).join('\n').trimEnd() : text;
  return `${main}\n\n${SIGNATURE}`;
}
