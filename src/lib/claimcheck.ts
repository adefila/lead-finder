import type { Lead } from '@/types/lead';
import { siteCorpus } from '@/lib/enrich';
import { templateDraft } from '@/lib/templatedraft';
import { splitDraft } from '@/lib/compose';

// A first email must not say a business lacks something its own site has. Drafts are written from the start of the homepage, so a
// line like "I couldn't find pricing" can be wrong when pricing sits one click away. Just before sending, the whole site is read again
// (see siteCorpus) and every "I couldn't find X" / "there is no X" in the draft is checked against it. If the site does have X the email
// is not sent: a template without that claim is tried, and if there is none the lead goes back to To contact with the reason written on it.

const TOPICS: { name: string; claim: RegExp; evidence: RegExp }[] = [
  { name: 'pricing', claim: /pric|packages?|plans?\b|\bcosts?\b|\brates?\b|tarif|prijz|priser/i, evidence: /\b(pricing|prices?|price list|packages?|plans?|per month|\/mo\b|from [£$€]\s?\d|[£$€]\s?\d{2,}|tarifs?|prijzen|priser)\b/i },
  { name: 'case studies', claim: /case stud|client results|results|testimonial|success stor|proof|portfolio|client work|projects?\b|reviews?\b|references?/i, evidence: /(case stud(y|ies)|testimonials?|success stor(y|ies)|our clients|client results|portfolio|our (work|projects)|projects|references|klantcases|kundecaser|cas clients)/i },
  { name: 'a way to book or ask for a quote', claim: /book|schedul|appointment|\bdemo\b|quote|enquir|get in touch|contact (form|page)|way in|call\b/i, evidence: /(book (a|your|now)|schedule (a|your)|request (a |your )?(quote|demo|call|callback)|get (a |your )?(free )?quote|free quote|free consultation|calendly|appointment|offerte aanvragen|devis|rendez-vous|tilbud|<form|enquiry form|contact form)/i },
  { name: 'services', claim: /services?\b|what (they|you) (do|offer)|offer(s|ing)?\b|solutions?\b/i, evidence: /(our services|what we do|services|solutions|diensten|tjenester)/i },
  { name: 'an about or team page', claim: /about|team\b|who (is|are)|people\b/i, evidence: /(about us|our team|meet the team|about|team|over ons|om oss|à propos)/i },
  { name: 'a blog or news', claim: /blog|news|articles?|insights?\b/i, evidence: /(blog|news|articles|insights|nieuws|nyheter|actualités)/i },
];

// "I couldn't find X", "there is no X on the page", "doesn't show X", "lacks X": the thing the email says is missing.
const ABSENT = [
  /\b(?:couldn['’]?t|could not|can['’]?t|cannot|didn['’]?t|did not|wasn['’]?t able to)\s+(?:find|see|spot|locate)\s+(?:a |an |any |the )?([^.;:\n]{3,70})/gi,
  /\b(?:there (?:is|was|are) no|with no|without (?:a |any )?|no (?:clear |obvious |visible )?)([^.;:\n]{3,60}?)(?: on | in | from | for | so |,|\.|$)/gi,
  /\b(?:doesn['’]?t|does not|don['’]?t|do not)\s+(?:have|show|list|mention|include|offer)\s+(?:a |an |any )?([^.;:\n]{3,60})/gi,
  /\b(?:lacks?|missing)\s+(?:a |an |any )?([^.;:\n]{3,60})/gi,
];

export function missingClaims(body: string): string[] {
  const out: string[] = [];
  for (const re of ABSENT) for (const m of body.matchAll(re)) out.push(m[1].trim());
  return out;
}

export interface Gate { ok: true; draft?: string }
export interface Held { ok: false; reason: string }

export async function claimGate(lead: Lead, draft: string): Promise<Gate | Held> {
  const website = lead.contactLinks?.website;
  const claims = missingClaims(splitDraft(draft).body);
  if (!website || !claims.length) return { ok: true };
  const corpus = await siteCorpus(website);
  if (!corpus) return { ok: true };            // site not readable now: nothing to contradict the draft with
  const wrong = (text: string): string | null => {
    for (const c of missingClaims(splitDraft(text).body)) {
      const topic = TOPICS.find(t => t.claim.test(c) && t.evidence.test(corpus));
      if (topic) return `the email says "${c.slice(0, 60)}" but the site has ${topic.name}`;
    }
    return null;
  };
  const problem = wrong(draft);
  if (!problem) return { ok: true };
  // A template written from the whole site's text claims a gap only when it is really absent.
  const alt = templateDraft({ ...lead, siteText: corpus });
  if (alt && !wrong(alt)) return { ok: true, draft: alt };
  return { ok: false, reason: `Held: ${problem}. Redraft it, or write one that fits their site.` };
}
