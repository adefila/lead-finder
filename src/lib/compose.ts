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

// Adds one line linking to the lead's website check, just above the sign-off. Safe to call twice.
export function withCheckLink(body: string, link?: string): string {
  if (!link || body.includes('/check/')) return body;
  const line = `I put together a short one-page note with a few ideas for you:\n${link}`;
  const lines = body.trimEnd().split('\n');
  const signOff = lines.map(l => l.trim()).lastIndexOf('Samuel');
  if (signOff < 0) return `${body.trimEnd()}\n\n${line}`;
  const before = lines.slice(0, signOff).join('\n').trimEnd();
  return `${before}\n\n${line}\n\n${lines.slice(signOff).join('\n')}`;
}
