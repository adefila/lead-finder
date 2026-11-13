import type { Lead } from '@/types/lead';

// What the appointment-reminders demo shows for one business: its own name and town, and a few example services for its
// kind of business. The services are placeholders (the page says so), so nothing in the demo is a claim about the business.
export interface ReminderContent { business: string; place: string; noun: string; services: string[] }

const KINDS: [RegExp, string, string[]][] = [
  [/\bdent|orthodont/i, 'appointment', ['Check-up and clean', 'Consultation', 'Follow-up visit']],
  [/physio|chiro|osteo|therap/i, 'appointment', ['First assessment', 'Treatment session', 'Follow-up session']],
  [/vet\b|veterin|animal/i, 'appointment', ['Check-up', 'Vaccination', 'Consultation']],
  [/salon|hair|barber|nail|beauty|spa|massage|skin/i, 'booking', ['Consultation', 'Treatment', 'Follow-up']],
  [/gym|fitness|yoga|pilates/i, 'booking', ['Intro session', 'Class', 'One-to-one session']],
  [/optic|eye/i, 'appointment', ['Eye test', 'Contact lens check', 'Frame fitting']],
];

export function reminderContent(lead: Pick<Lead, 'title' | 'company'>): ReminderContent {
  const trade = `${lead.company} ${lead.title}`;
  const hit = KINDS.find(([re]) => re.test(trade));
  const place = lead.company.split(' · ').slice(1).join(' · ').split(',')[0]?.trim() ?? '';
  return {
    business: lead.title.replace(/\s+(ltd|limited|llc|inc|pte\.?\s*ltd\.?|pty\.?\s*ltd\.?)\.?$/i, '').trim(),
    place,
    noun: hit?.[1] ?? 'appointment',
    services: hit?.[2] ?? ['First visit', 'Consultation', 'Follow-up'],
  };
}
