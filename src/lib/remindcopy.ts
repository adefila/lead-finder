import Anthropic from '@anthropic-ai/sdk';
import type { LeadLang } from '@/lib/leadview';
import { LANGUAGE_NAME } from '@/lib/leadview';
import { getRemindCopy, saveRemindCopy } from '@/lib/supabase';

// Every word on the appointment-reminders demo. English is written here; every other language is translated once by the
// model and kept (one row per language), so a Dutch clinic sees Dutch and nobody pays for the same translation twice.
// Placeholders in curly brackets are filled in by the page: {business} {service} {when} {time} {place}.

export interface ReminderCopy {
  tag: string; h1: string; intro: string;
  step1: string; step2: string; step3: string;
  labelWhat: string; labelDay: string; labelTime: string;
  days: [string, string, string];            // chip labels
  whens: [string, string, string];           // "tomorrow at", used inside a sentence, followed by the time
  book: string; again: string; freeSlot: string;
  statusBooked: string; statusReminded: string; statusConfirmed: string; statusMove: string;
  note: string; empty: string;
  msgBooked: string; msgReminder: string; msgConfirmed: string; msgMove: string;
  justNow: string; dayBefore: string;
  jump: string; replyC: string; replyR: string; doneC: string; doneR: string;
  closeTitle: string; closeBody: string; yes: string; whatsapp: string; footer: string;
  services: Record<string, [string, string, string]>;
}

export const EN_COPY: ReminderCopy = {
  tag: 'Demo: appointment reminders',
  h1: 'Fewer forgotten appointments, without chasing anyone.',
  intro: 'Here is how it would work for {business}. Book an example appointment, then see what your customer receives.',
  step1: 'The customer books online', step2: 'You see it, and nobody has to chase', step3: 'The customer gets texts',
  labelWhat: 'What for', labelDay: 'Day', labelTime: 'Time',
  days: ['Tomorrow', 'In 2 days', 'In 3 days'],
  whens: ['tomorrow at', 'the day after tomorrow at', 'in three days at'],
  book: 'Book this appointment', again: 'Start again', freeSlot: 'Free slot',
  statusBooked: 'Booked', statusReminded: 'Reminder sent', statusConfirmed: 'Confirmed', statusMove: 'Asked to reschedule',
  note: 'Example only. The texts below are simulated and nothing is sent.',
  empty: 'Book an appointment to see the texts.',
  msgBooked: '{business}: your {service} is booked: {when} {time}. We will text you a reminder before.',
  msgReminder: 'Reminder from {business}: your {service} is tomorrow at {time}. Reply C to confirm or R to reschedule.',
  msgConfirmed: 'Thank you, you are confirmed. See you tomorrow at {time}.',
  msgMove: 'No problem. Choose a new time here and we will move you: (a link to your calendar)',
  justNow: 'Just now', dayBefore: 'The day before, 10:00',
  jump: 'Jump to the day before', replyC: 'Reply C', replyR: 'Reply R',
  doneC: 'Confirmed. Nothing for you to do.', doneR: 'The slot is yours to offer again.',
  closeTitle: 'Want this for {business}?',
  closeBody: 'I set it up with your own services, your hours and your wording. I would start with your booking page and the two reminder texts.',
  yes: 'Reply YES', whatsapp: 'WhatsApp me',
  footer: 'Concept for {business}{place}, by Samuel Adefila. Not live.',
  services: {
    dentist: ['Check-up and clean', 'Consultation', 'Follow-up visit'],
    physio: ['First assessment', 'Treatment session', 'Follow-up session'],
    vet: ['Check-up', 'Vaccination', 'Consultation'],
    salon: ['Consultation', 'Treatment', 'Follow-up'],
    gym: ['Intro session', 'Class', 'One-to-one session'],
    optic: ['Eye test', 'Contact lens check', 'Frame fitting'],
    other: ['First visit', 'Consultation', 'Follow-up'],
  },
};

export const fmt = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? '');

const tokens = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
// A translation is only used when it has every key, in the same shape, with the placeholders intact.
function valid(en: unknown, tr: unknown): boolean {
  if (typeof en === 'string') return typeof tr === 'string' && tr.trim().length > 0 && tokens(en) === tokens(tr);
  if (Array.isArray(en)) return Array.isArray(tr) && tr.length === en.length && en.every((e, i) => valid(e, tr[i]));
  if (en && typeof en === 'object') return !!tr && typeof tr === 'object' && Object.keys(en).every(k => valid((en as Record<string, unknown>)[k], (tr as Record<string, unknown>)[k]));
  return false;
}

const REGISTER: Record<LeadLang, string> = {
  en: '', nl: 'Address the reader with "u".', no: 'Use "dere" for the business.', fr: 'Use "vous".', de: 'Use "Sie".', es: 'Use "usted".', pt: 'Use a formal register, never "tu".', it: 'Use "Lei".',
};

export async function getReminderCopy(lang: LeadLang): Promise<ReminderCopy> {
  if (lang === 'en') return EN_COPY;
  const saved = await getRemindCopy(lang).catch(() => null);
  if (saved && valid(EN_COPY, saved)) return saved as ReminderCopy;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return EN_COPY;
  try {
    const msg = await new Anthropic({ apiKey: key }).messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: `Translate the text of this small web page into ${LANGUAGE_NAME[lang]}, as a native speaker writing for a local clinic or salon. It is a demo of text-message appointment reminders, and the "msg" strings are the SMS texts a customer receives. ${REGISTER[lang]}
Rules: keep every key exactly; keep every {placeholder} exactly as written, and in every string that has it; keep "C" and "R" as the reply letters in the reminder and reply buttons unless the language uses other common letters for confirm and reschedule; never use em dashes or en dashes; short natural phrases; the "whens" values must read naturally before a time like 11:30 ("tomorrow at"); the "services" are common names of those services.
Return ONLY the JSON object.

${JSON.stringify(EN_COPY)}` }],
    });
    const text = msg.content.map(b => (b.type === 'text' ? b.text : '')).join('');
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const tr = JSON.parse(json) as unknown;
    if (!valid(EN_COPY, tr)) { console.error(`[remind] translation to ${lang} had a wrong shape`); return EN_COPY; }
    await saveRemindCopy(lang, tr as ReminderCopy).catch(() => undefined);
    return tr as ReminderCopy;
  } catch (e) {
    console.error('[remind] translation failed:', e);
    return EN_COPY;
  }
}
