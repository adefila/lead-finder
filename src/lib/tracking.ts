import crypto from 'crypto';

export const APP_URL = process.env.APP_URL ?? 'https://lead-finder-one-self.vercel.app';

export type SendVia = 'gmail' | 'mail' | 'bid';

function sign(id: string, via: SendVia): string {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error('CRON_SECRET is not set');
  return crypto.createHmac('sha256', secret).update(`${id}:${via}`).digest('hex').slice(0, 24);
}

export function verifySig(id: string, via: SendVia, sig: string): boolean {
  const expected = Buffer.from(sign(id, via));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// Link that marks the lead as contacted, then forwards to Gmail, the mail app or the project page.
export function sendLink(id: string, via: SendVia): string {
  const q = new URLSearchParams({ id, via, sig: sign(id, via) });
  return `${APP_URL}/api/go?${q}`;
}
