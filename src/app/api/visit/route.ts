import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders, recordCompanyVisit, SITE_ORIGINS } from '@/lib/inbound';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Page-view beacon from the script on your website (/t.js). Looks up the company behind the
// visitor's network and turns business visitors into leads. Nothing is stored for home or
// mobile connections.
//
// Two ways in: the browser beacon from /t.js, or your website's own server forwarding the visit
// with the x-capture-key header (then the visitor's IP and browser come in the body).
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  const cors = corsHeaders(origin);
  const secret = process.env.CAPTURE_SECRET;
  const forwarded = !!secret && req.headers.get('x-capture-key') === secret;
  if (!forwarded && (!cors['Access-Control-Allow-Origin'] || !SITE_ORIGINS.includes(origin ?? ''))) return new NextResponse(null, { status: 204, headers: cors });

  let body: { path?: unknown; referrer?: unknown; ip?: unknown; ua?: unknown } = {};
  try { body = JSON.parse(await req.text()); } catch { /* empty beacon */ }
  const ip = forwarded && typeof body.ip === 'string' ? body.ip
    : (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || '';
  await recordCompanyVisit({
    ip,
    ua: forwarded && typeof body.ua === 'string' ? body.ua : req.headers.get('user-agent') ?? '',
    path: typeof body.path === 'string' ? body.path : '/',
    referrer: typeof body.referrer === 'string' ? body.referrer.slice(0, 200) : '',
  }).catch(e => console.error('[visit] failed:', (e as Error).message));
  return new NextResponse(null, { status: 204, headers: cors });
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}
