import { NextResponse } from 'next/server';
import { sendTestAlert } from '@/lib/email';

export const dynamic = 'force-dynamic';

// Sends one test alert to your own inbox (behind the dashboard login).
export async function POST() {
  try {
    const r = await sendTestAlert();
    return NextResponse.json({ ok: true, from: r.from, to: r.to, via: r.via });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
