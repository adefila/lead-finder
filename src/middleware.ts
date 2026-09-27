import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, hasSession, hasTimerSecret } from '@/lib/session';

// Reachable without logging in: the login itself, the digest's email logo, and the
// signed links inside digest emails (they carry their own signature).
const PUBLIC = ['/login', '/api/login', '/email-logo.png', '/api/go'];
// Called by timers with "Authorization: Bearer CRON_SECRET". Only the exact secret gets through.
const TIMER_ROUTES = ['/api/cron', '/api/outbox'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const password = process.env.DASHBOARD_PASSWORD?.trim();
  if (!password) return NextResponse.next();

  if (PUBLIC.some(p => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (TIMER_ROUTES.includes(pathname) && hasTimerSecret(req.headers.get('authorization'))) return NextResponse.next();

  if (await hasSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Log in to Lead Finder first' }, { status: 401 });
  const login = new URL('/login', req.url);
  if (pathname !== '/') login.searchParams.set('next', pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon).*)'],
};
