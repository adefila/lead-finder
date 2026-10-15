import { NextResponse } from 'next/server';
import { outboxAudit } from '@/lib/outbox';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Today's sending, as the app counted it and as the mailbox's Sent folder shows it.
export async function GET() {
  return NextResponse.json(await outboxAudit());
}
