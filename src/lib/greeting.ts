// Last check on a drafted message before it is saved: a broken greeting (a placeholder, "undefined", a business name
// or a whole sentence where a first name should be) is replaced with a plain "Hi there,". Only English "Hi ..." lines are
// touched; the body is never rewritten.
const PLACEHOLDER = /\[[^\]]{1,40}\]|\{\{?[^}]{1,40}\}?\}|\b(undefined|null|NaN|unknown|n\/a)\b/i;
const NAME_WORD = /^(?:Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Prof\.?|[\p{Lu}][\p{L}'’-]{1,24})$/u;

export function hasPlaceholder(text: string): boolean {
  return PLACEHOLDER.test(text);
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
