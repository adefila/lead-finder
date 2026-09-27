import crypto from 'crypto';
import type { Lead } from '@/types/lead';
import { displayName } from '@/lib/leadview';

export const APP_URL = process.env.APP_URL ?? 'https://lead-finder-one-self.vercel.app';

export type SendVia = 'gmail' | 'mail' | 'bid';
type Purpose = SendVia | 'check';

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
