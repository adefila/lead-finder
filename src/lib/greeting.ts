// Last check on a drafted message before it is saved: a broken greeting (a placeholder, "undefined", a business name
// or a whole sentence where a first name should be) is replaced with a plain "Hi there,". Only English "Hi ..." lines are
// touched; the body is never rewritten.
const PLACEHOLDER = /\[[^\]]{1,40}\]|\{\{?[^}]{1,40}\}?\}|\b(undefined|null|NaN|unknown|n\/a)\b/i;
const NAME_WORD = /^(?:Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Prof\.?|[\p{Lu}][\p{L}'’-]{1,24})$/u;

export function hasPlaceholder(text: string): boolean {
  return PLACEHOLDER.test(text);
}

const PLAIN_GREETING: Record<string, string> = { en: 'Hi there,', nl: 'Hallo,', no: 'Hei,', fr: 'Bonjour,', de: 'Hallo,', es: 'Hola,', pt: 'Olá,', it: 'Buongiorno,' };

// A message with no greeting line at all gets a plain one in its own language, right under the subject.
export function ensureGreeting(message: string, lang = 'en'): string {
  const lines = message.split('\n');
  const s = lines.findIndex(l => /^subject:/i.test(l.trim()));
  const i = lines.findIndex((l, k) => k > s && l.trim());
  if (s === -1 || i === -1) return message;
  const first = lines[i].trim();
  if (first.length < 60 && first.endsWith(',')) return message;
  lines.splice(i, 0, PLAIN_GREETING[lang] ?? PLAIN_GREETING.en, '');
  return lines.join('\n');
}

// BookedEZ paid out US dollars. Translated drafts sometimes turn "$10K" into "10.000 euro": put it back.
export function fixCurrency(message: string): string {
  return message.replace(/(?:10[.,\s  ]?000|tienduizend|dix mille|zehntausend|diez mil|dez mil|diecimila|ti tusen)\s*(?:euros?|€)/gi, '$10,000');
}

export function fixGreeting(message: string): string {
  const lines = message.split('\n');
  const i = lines.findIndex(l => l.trim() && !/^subject:/i.test(l.trim()));
  if (i === -1) return message;
  const m = lines[i].trim().match(/^Hi\b(.*),$/i);
  if (!m) return message;
  const who = m[1].trim();
  if (!who || /^there$/i.test(who)) return message;
  const words = who.split(/\s+/);
  const ok = !PLACEHOLDER.test(who) && (
    (/team$/i.test(who) && words.length <= 4) ||
    (words.length <= 3 && words.every(w => NAME_WORD.test(w)))
  );
  if (ok) return message;
  lines[i] = 'Hi there,';
  return lines.join('\n');
}
