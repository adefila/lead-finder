import { NextRequest, NextResponse } from 'next/server';
import { getLeadById, updateLead } from '@/lib/supabase';
import { generateColdEmails } from '@/lib/claude';
import { analyzeWebsite } from '@/lib/enrich';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { id } = await req.json() as { id?: string };
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const lead = await getLeadById(id);
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  // Re-read the site so the owner's name can be found again (site text isn't stored).
  const website = lead.contactLinks?.website;
  if (lead.source === 'places' && website) {
    const report = await analyzeWebsite(website).catch(() => null);
    if (report?.siteText) lead.siteText = report.siteText;
  }
  if (lead.contactName === lead.title) lead.contactName = undefined;

  const [drafted] = await generateColdEmails([lead]);
  if (!drafted?.proposal) return NextResponse.json({ error: 'Could not write a new draft' }, { status: 500 });

  const patch = {
    draft_email: drafted.proposal,
    contact_name: drafted.contactName ?? null,
    contact_title: drafted.contactTitle ?? null,
  };
  const error = await updateLead(id, patch);
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({ proposal: drafted.proposal, contactName: drafted.contactName, contactTitle: drafted.contactTitle });
}
