import { NextRequest, NextResponse } from 'next/server';
import { deleteLeads, getLeads, markFollowedUp, updateLead, updateLeadStatus } from '@/lib/supabase';
import { LEAD_STATUSES, type LeadStatus } from '@/types/lead';
import { hasCheck, withWorkingLinks } from '@/lib/leadview';
import { checkLink } from '@/lib/tracking';

export const dynamic = 'force-dynamic';

export async function GET() {
  const leads = await getLeads();
  return NextResponse.json(leads.map(withWorkingLinks).map(l => (hasCheck(l) ? { ...l, checkUrl: checkLink(l.id) } : l)));
}

export async function PATCH(req: NextRequest) {
  const { id, status, action, proposal, contactEmail } = await req.json() as { id?: string; status?: string; action?: string; proposal?: unknown; contactEmail?: unknown };
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  // An email address you got on a call or by DM.
  if (contactEmail !== undefined) {
    const email = typeof contactEmail === 'string' ? contactEmail.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) {
      return NextResponse.json({ error: 'That does not look like an email address' }, { status: 400 });
    }
    const emailError = await updateLead(id, { contact_email: email, send_error: null });
    if (emailError) return NextResponse.json({ error: emailError }, { status: 500 });
    if (status === undefined && action === undefined) return NextResponse.json({ ok: true });
  }

  // Save an edited draft first, so a queued email goes out exactly as it was last edited.
  if (proposal !== undefined) {
    if (typeof proposal !== 'string' || proposal.length > 6000) {
      return NextResponse.json({ error: 'Draft must be text under 6000 characters' }, { status: 400 });
    }
    const draftError = await updateLead(id, { draft_email: proposal });
    if (draftError) return NextResponse.json({ error: draftError }, { status: 500 });
  }

  let error: string | null;
  if (action === 'followed_up') {
    error = await markFollowedUp(id);
  } else if (LEAD_STATUSES.includes(status as LeadStatus)) {
    error = await updateLeadStatus(id, status as LeadStatus);
  } else {
    return NextResponse.json({ error: 'Invalid status or action' }, { status: 400 });
  }

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { ids } = await req.json() as { ids?: unknown };
  if (!Array.isArray(ids) || !ids.length || ids.length > 500 || !ids.every(i => typeof i === 'string' && i.length < 200)) {
    return NextResponse.json({ error: 'Send 1-500 lead ids' }, { status: 400 });
  }
  const error = await deleteLeads(ids as string[]);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: ids.length });
}
