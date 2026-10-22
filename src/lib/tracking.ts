import crypto from 'crypto';
import type { Lead } from '@/types/lead';
import { displayName, isBusinessPitch, leadLanguage, nicheOf, isJobLead } from '@/lib/leadview';

export const APP_URL = process.env.APP_URL ?? 'https://lead-finder-one-self.vercel.app';

export type SendVia = 'gmail' | 'mail' | 'bid';
type Purpose = SendVia | 'check' | 'visit';

function sign(id: string, via: Purpose): string {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error('CRON_SECRET is not set');
  return crypto.createHmac('sha256', secret).update(`${id}:${via}`).digest('hex').slice(0, 24);
}

export function verifySig(id: string, via: Purpose, sig: string): boolean {
  const expected = Buffer.from(sign(id, via));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// Link that marks the lead as contacted, then forwards to Gmail, the mail app or the project page.
export function sendLink(id: string, via: SendVia): string {
  const q = new URLSearchParams({ id, via, sig: sign(id, via) });
  return `${APP_URL}/api/go?${q}`;
}

// Where the one-page notes live. Set NOTES_URL to a neutral address (for example
// https://notes.adefilasamuel.com) so prospects never see "leads" in the link.
const NOTES_URL = (process.env.NOTES_URL ?? APP_URL).replace(/\/+$/, '');

function noteCode(id: string): string {
  return sign(id, 'check').slice(0, 12);
}

export function noteKeyMatches(id: string, code: string): boolean {
  const expected = Buffer.from(noteCode(id));
  const given = Buffer.from(code);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// Short, readable address of a lead's one-page note: /n/green-dental-4f9a2c1b07aa
export function noteLink(lead: { id: string; title: string; source: string }): string {
  const slug = displayName(lead as Lead).toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || 'note';
  return `${NOTES_URL}/n/${slug}-${noteCode(lead.id)}`;
}

// Tracked link to your portfolio for one lead's emails: /v/green-dental-4f9a2c1b07aa records the
// visit, then forwards to adefilasamuel.com.
export const SITE_URL = 'https://adefilasamuel.com';

// Local businesses and new companies land on the page written for them; jobs and everyone else on the homepage.
// The page is translated, so a Dutch, Norwegian or French lead gets ?lang= and sees it in the same language as the
// email, whatever country their IP says. English leads get the plain address.
//
// Every link also carries utm_ tags, so Google Analytics can tell your emails apart from "direct" visits and show
// which kind of business and which letter brought them: source = outreach_email (the link in the email) or
// outreach_note (the button on the one-page note), medium = email, campaign = local-business / job-application /
// general, content = the kind of business (see nicheOf). No names, emails or addresses ever go into a link.
export function siteDestination(lead: Lead, via: 'email' | 'note' = 'email'): string {
  const business = isBusinessPitch(lead);
  const params = new URLSearchParams();
  const lang = leadLanguage(lead);
  if (business && lang !== 'en') params.set('lang', lang);
  params.set('utm_source', via === 'note' ? 'outreach_note' : 'outreach_email');
  params.set('utm_medium', 'email');
  params.set('utm_campaign', business ? 'local-business' : isJobLead(lead) ? 'job-application' : 'general');
  params.set('utm_content', nicheOf(lead));
  return `${business ? `${SITE_URL}/local-business` : SITE_URL}?${params.toString()}`;
}

function visitCode(id: string): string {
  return sign(id, 'visit').slice(0, 12);
}

export function visitKeyMatches(id: string, code: string): boolean {
  const expected = Buffer.from(visitCode(id));
  const given = Buffer.from(code);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export function siteLink(lead: { id: string; title: string; source: string }): string {
  const slug = displayName(lead as Lead).toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || 'site';
  return `${NOTES_URL}/v/${slug}-${visitCode(lead.id)}`;
}
