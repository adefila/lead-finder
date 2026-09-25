import { NextRequest, NextResponse } from 'next/server';
import { getLeadById, updateLeadStatus } from '@/lib/supabase';
import { gmailComposeUrl, mailtoUrl, splitDraft } from '@/lib/compose';
import { verifySig, type SendVia } from '@/lib/tracking';

export const dynamic = 'force-dynamic';

const VIAS: SendVia[] = ['gmail', 'mail', 'bid'];

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const id = p.get('id') ?? '';
  const via = p.get('via') as SendVia;
  const home = new URL('/', req.nextUrl.origin);

  if (!id || !VIAS.includes(via) || !verifySig(id, via, p.get('sig') ?? '')) return NextResponse.redirect(home);

  const lead = await getLeadById(id);
  if (!lead) return NextResponse.redirect(home);

  if ((lead.status ?? 'new') === 'new') {
    const error = await updateLeadStatus(id, 'approved');
    if (error) console.error('[go] could not mark contacted:', error);
  }

  const { subject, body } = splitDraft(lead.proposal ?? '');
  if (via === 'bid') return NextResponse.redirect(lead.url || home);
  if (!lead.contactEmail) return NextResponse.redirect(home);
  const target = via === 'gmail'
    ? gmailComposeUrl(lead.contactEmail, subject, body)
    : mailtoUrl(lead.contactEmail, subject, body);
  return NextResponse.redirect(target);
}
