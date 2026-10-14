import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders, createEnquiryLead, parseEnquiry } from '@/lib/inbound';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Your website's contact form posts here: a Framer form webhook, or the embed snippet.
// Optional CAPTURE_SECRET: when set, the request must carry it as ?key=... or the x-capture-key header.
export async function POST(req: NextRequest) {
  const cors = corsHeaders(req.headers.get('origin'));
  const secret = process.env.CAPTURE_SECRET;
  if (secret && req.nextUrl.searchParams.get('key') !== secret && req.headers.get('x-capture-key') !== secret) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 401, headers: cors });
  }

  let raw: unknown;
  const type = req.headers.get('content-type') ?? '';
  try {
    raw = type.includes('form') ? Object.fromEntries((await req.formData()).entries()) : JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: 'Could not read the form' }, { status: 400, headers: cors });
  }

  const parsed = parseEnquiry(raw);
  // Spam gets a normal "thanks" so bots learn nothing.
  if ('error' in parsed) {
    return parsed.error === 'spam'
      ? NextResponse.json({ ok: true }, { headers: cors })
      : NextResponse.json({ error: parsed.error }, { status: 400, headers: cors });
  }
  await createEnquiryLead(parsed);
  return NextResponse.json({ ok: true }, { headers: cors });
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}
