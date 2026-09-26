export const SESSION_COOKIE = 'lf_session';

// The cookie holds a hash, never the password. Changing DASHBOARD_PASSWORD logs every device out.
export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`${password}:${process.env.CRON_SECRET ?? ''}:lead-finder-session`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
