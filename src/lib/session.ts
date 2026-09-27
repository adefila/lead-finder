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

// Timer routes accept either the exact timer secret or a logged-in session. Nothing else.
export function hasTimerSecret(authorization: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && !!authorization && safeEqual(authorization, `Bearer ${secret}`);
}

export async function hasSession(cookie: string | undefined): Promise<boolean> {
  const password = process.env.DASHBOARD_PASSWORD?.trim();
  return !!password && !!cookie && safeEqual(cookie, await sessionToken(password));
}

export async function isAllowed(req: { headers: Headers; cookies: { get(name: string): { value: string } | undefined } }): Promise<boolean> {
  return hasTimerSecret(req.headers.get('authorization')) || hasSession(req.cookies.get(SESSION_COOKIE)?.value);
}
