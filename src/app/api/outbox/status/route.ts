import { NextResponse } from 'next/server';
import { outboxStatus } from '@/lib/outbox';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await outboxStatus());
}
