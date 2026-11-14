import type { Lead } from '@/types/lead';

// Labels the style of a message's first line, so reply rates can be compared by style without storing anything
// extra on each lead. It reads the saved draft, so it also works on every email already sent.
export const OPENING_LABELS = ['Noticed something real', 'Proof first', 'Offer first', 'About you', 'Customer scene', 'Other'] as const;
export type Opening = typeof OPENING_LABELS[number];

const GREETING = /^(hi|hello|hey|dear|hallo|bonjour|hej|hola|goedendag)\b/i;

export function firstLine(draft: string): string {
  const paras = draft.replace(/\r/g, '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  if (paras[0]?.toLowerCase().startsWith('subject:')) paras.shift();
  if (paras[0] && paras[0].length < 60 && (GREETING.test(paras[0]) || paras[0].endsWith(','))) paras.shift();
  return paras[0] ?? '';
}

export function openingOf(draft: string): Opening {
  const p = firstLine(draft);
  if (!p) return 'Other';
  if (/^(I'?m|I am|My name)\b/i.test(p)) return 'About you';
  if (/^(the last|i('ve| have)? )?.{0,40}\b(built|rebuilt|designed|redesigned|audited|delivered)\b/i.test(p) && /\b(I|my)\b/.test(p.slice(0, 60))) return 'Proof first';
  if (/^(I'?d like to|I (set|can|will|build|rebuild|make)|At a fixed price)/i.test(p)) return 'Offer first';
  if (/\b(\d(\.\d)?\s*(stars?|rating)|rating|reviews?|rated|years)\b/i.test(p)) return 'Noticed something real';
  if (!/^I\b/.test(p) && !/\bcould\b/i.test(p) && /\b(sells?|serves?|offers?|runs|lists|opens with|homepage|customers are)\b/i.test(p)) return 'Noticed something real';
  if (/^(It'?s|When|A |An |People|Someone|Right now|Imagine)|\bcould (book|tell|say|get|see)\b/i.test(p)) return 'Customer scene';
  return 'Other';
}

export type OpeningRow = { label: Opening; sent: number; replied: number; examples: string[] };

export function openingTable(leads: Lead[]): OpeningRow[] {
  const rows = new Map<Opening, OpeningRow>(OPENING_LABELS.map(l => [l, { label: l, sent: 0, replied: 0, examples: [] }]));
  for (const l of leads) {
    if (!l.proposal || !l.lastSentAt || !['approved', 'replied', 'won', 'lost'].includes(l.status ?? '')) continue;
    const row = rows.get(openingOf(l.proposal))!;
    row.sent++;
    if (l.status === 'replied' || l.status === 'won') row.replied++;
    if (row.examples.length < 2) row.examples.push(firstLine(l.proposal).slice(0, 140));
  }
  return [...rows.values()].filter(r => r.sent > 0);
}
