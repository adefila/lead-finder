import type { Lead } from '@/types/lead';

// What the appointment-reminders demo shows for one business: its own name and town, and which set of example services fits
// its kind of business (the words themselves, in the business's language, live in remindcopy.ts). The services are
// placeholders and the page says so, so nothing in the demo is a claim about the business.
export interface ReminderContent { business: string; place: string; kind: string }

const KINDS: [RegExp, string][] = [
  [/\bdent|orthodont|tandarts|tannlege|dentiste|zahn|dentista/i, 'dentist'],
  [/physio|chiro|osteo|therap|fysio|kiropraktor|kinésith|kinesi/i, 'physio'],
  [/vet\b|veterin|animal|dierenarts|veterinær|tierarzt/i, 'vet'],
  [/salon|hair|barber|nail|beauty|spa\b|massage|skin|kapper|frisør|coiffeur|friseur|peluquer|parrucch/i, 'salon'],
  [/gym|fitness|yoga|pilates/i, 'gym'],
  [/optic|eye|opticien|optiker/i, 'optic'],
];

export function reminderContent(lead: Pick<Lead, 'title' | 'company'>): ReminderContent {
  const trade = `${lead.company} ${lead.title}`;
  const place = lead.company.split(' · ').slice(1).join(' · ').split(',')[0]?.trim() ?? '';
  return {
    business: lead.title.replace(/\s+(ltd|limited|llc|inc|pte\.?\s*ltd\.?|pty\.?\s*ltd\.?|b\.?v\.?|as|gmbh)\.?$/i, '').trim(),
    place,
    kind: KINDS.find(([re]) => re.test(trade))?.[1] ?? 'other',
  };
}
