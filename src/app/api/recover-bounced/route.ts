import { NextResponse } from 'next/server';
import { recoverWronglyBounced } from '@/lib/recover';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Brings back leads that were marked as bounced for a reason other than a dead address.
export async function POST() {
  try {
    return NextResponse.json(await recoverWronglyBounced());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
