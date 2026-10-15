import Anthropic from '@anthropic-ai/sdk';
import { unstable_cache } from 'next/cache';
import type { Lead } from '@/types/lead';
import { displayName, LANGUAGE_NAME, leadLanguage, leadStory, systemsFor, type LeadLang } from '@/lib/leadview';

// Every piece of text on a lead's one-page note. Built in English, then translated once for
// businesses written to in Dutch, Norwegian or French, and saved, so a note is only ever
// translated the first time (the outbox does it right after sending, before anyone opens it).
export interface NoteCopy {
  eyebrow: string;
  sub: string;
  workingTitle: string;
  workingText: string;
  setupTitle: string;
  setupLead: string;
  systems: string[];
  siteTitle: string;
  siteLead: string;
  problems: string[];
  fixes: string[];
  aboutTitle: string;
  aboutText: string;
  emailMe: string;
  seeWork: string;
  closing: string;
  mailSubject: string;
}

const LOCALE: Record<LeadLang, string> = { en: 'en-GB', nl: 'nl-NL', no: 'nb-NO', fr: 'fr-LU' };

export function englishNoteCopy(lead: Lead): NoteCopy {
  const name = displayName(lead);
  const story = leadStory(lead);
  const place = lead.company.split(' · ').slice(1).join(' · ') || lead.company;
  const rating = story.other.find(o => /stars from \d+/i.test(o))?.replace(/\.$/, '');
  return {
    eyebrow: 'A few ideas for your business',
    // The month is added after translation, in the reader's language (see noteCopy).
    sub: `${place} · Prepared by Samuel Adefila`,
    workingTitle: rating ? 'What is already working' : '',
    workingText: rating
      ? `Customers rate you ${rating.replace(/ Google reviews$/, ' reviews on Google')}. The ideas below are about turning that reputation into more bookings, with less of your time spent chasing.`
      : '',
    setupTitle: 'What I would set up for you',
    setupLead: 'Small systems that save you time and bring in more customers. I set each one up for you, and after that it runs on its own.',
    systems: systemsFor(lead),
    siteTitle: 'Your website',
    siteLead: 'A few things I noticed, and how I would fix them.',
    problems: story.ownerProblems,
    fixes: story.fixes,
    aboutTitle: 'About me',
    aboutText: 'I am Samuel. I build websites and simple systems that save small businesses time. You deal with me directly from the first call to launch, and I keep things simple: a clear price up front, and nothing you need to be technical to use.',
    emailMe: 'Email me',
    seeWork: 'See my work',
    closing: 'Or just reply to my email. No pressure, and this note is yours to keep either way.',
    mailSubject: `Ideas for ${name}`,
  };
}

async function translate(copy: NoteCopy, lang: LeadLang): Promise<NoteCopy> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return copy;
  const client = new Anthropic({ apiKey: key });
  const register = lang === 'nl' ? 'Use "u" (polite form).' : lang === 'fr' ? 'Use "vous".' : 'Use "du/dere" as is normal in Norwegian business writing.';
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `Translate every string value in this JSON into ${LANGUAGE_NAME[lang]} for a small business owner reading a one-page note from a freelancer. ${register}
- Natural, plain, warm business language, as a native speaker would write it. Not word for word.
- Keep names, numbers, dates' meaning, "Samuel Adefila", "Samuel", "Google" and "adefilasamuel.com" as they are.
- Keep the same keys, the same number of items in each list, and empty strings empty.
- No em dashes.
Return ONLY the JSON.

${JSON.stringify(copy)}`,
    }],
  });
  const block = msg.content[0];
  const text = block.type === 'text' ? block.text : '';
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const out = JSON.parse(json) as Partial<NoteCopy>;
  // Anything missing or malformed falls back to the English text for that piece.
  const merged = { ...copy };
  for (const k of Object.keys(copy) as (keyof NoteCopy)[]) {
    const v = out[k];
    if (Array.isArray(copy[k])) {
      if (Array.isArray(v) && v.length === (copy[k] as string[]).length && v.every(s => typeof s === 'string')) (merged[k] as string[]) = v as string[];
    } else if (typeof v === 'string' && (v || !copy[k])) {
      (merged[k] as string) = v;
    }
  }
  return merged;
}

// Saved per lead and language: translated once, then reused for every view.
const translatedNote = unstable_cache(
  async (_leadId: string, lang: LeadLang, english: NoteCopy) => translate(english, lang),
  ['note-copy-v1'],
  { revalidate: false },
);

export async function noteCopy(lead: Lead): Promise<{ copy: NoteCopy; lang: LeadLang; locale: string }> {
  const lang = leadLanguage(lead);
  const english = englishNoteCopy(lead);
  const withMonth = (c: NoteCopy, l: LeadLang): NoteCopy =>
    ({ ...c, sub: `${c.sub}, ${new Date().toLocaleDateString(LOCALE[l], { month: 'long', year: 'numeric' })}` });
  if (lang === 'en') return { copy: withMonth(english, 'en'), lang, locale: LOCALE.en };
  try {
    const copy = await translatedNote(lead.id, lang, english);
    return { copy: withMonth(copy, lang), lang, locale: LOCALE[lang] };
  } catch (e) {
    console.error('[note] translation failed, showing English:', (e as Error).message);
    return { copy: withMonth(english, 'en'), lang: 'en', locale: LOCALE.en };
  }
}
