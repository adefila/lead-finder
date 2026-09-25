import { NextResponse } from 'next/server';
import { gmailConfigured, syncGmail } from '@/lib/gmail';
import { getSetting } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const [email, lastSync, token] = gmailConfigured()
    ? await Promise.all([getSetting('gmail_email'), getSetting('gmail_last_sync'), getSetting('gmail_refresh_token')])
    : [null, null, null];
  return NextResponse.json({ configured: gmailConfigured(), connected: !!token, email, lastSync });
}

export async function POST() {
  const result = await syncGmail();
  return NextResponse.json(result, { status: result.error ? 502 : 200 });
}
