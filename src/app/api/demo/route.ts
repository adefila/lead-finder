import { NextRequest, NextResponse } from 'next/server';
import { deleteDemo, getDemo, getLeadById, saveDemo, updateLead } from '@/lib/supabase';
import { generateDemo } from '@/lib/demogen';
import { demoLink } from '@/lib/tracking';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Where you look at the demo before anything is sent. ?me=1 means "this is you": the view is not counted as the lead opening it.
const previewUrl = (lead: { id: string; title: string; source: string }) => `${demoLink(lead)}?me=1`;

// The state of a lead's demo.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const lead = await getLeadById(id);
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  const demo = lead.contactLinks?.demo ? await getDemo(id) : null;
  return NextResponse.json({ status: demo ? lead.contactLinks?.demo : null, look: demo?.look ?? null, url: demo ? previewUrl(lead) : null, hasWebsite: !!lead.contactLinks?.website, source: lead.contactLinks?.demoSource ?? null });
}

// Build (or rebuild) the demo from the lead's own website. It starts as a draft: nothing goes in an email until you approve it.
export async function POST(req: NextRequest) {
  const { id } = await req.json() as { id?: string };
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const lead = await getLeadById(id);
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  try {
    const result = await generateDemo(lead, { generic: true });
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 422 });
    const error = await saveDemo(id, result.demo);
    if (error) return NextResponse.json({ error }, { status: 500 });
    await updateLead(id, { contact_links: { ...lead.contactLinks, demo: 'draft', demoLook: result.demo.look, demoSource: result.generic ? 'generic' : 'site' } });
    return NextResponse.json({ status: 'draft', look: result.demo.look, url: previewUrl(lead) });
  } catch (e) {
    console.error('[demo] build failed:', e);
    return NextResponse.json({ error: 'Could not build the demo. Try again in a moment' }, { status: 500 });
  }
}

// Approve it for the email, or take it back to a draft.
export async function PATCH(req: NextRequest) {
  const { id, approve } = await req.json() as { id?: string; approve?: boolean };
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const lead = await getLeadById(id);
  if (!lead || !lead.contactLinks?.demo) return NextResponse.json({ error: 'There is no demo for this lead' }, { status: 404 });
  const error = await updateLead(id, { contact_links: { ...lead.contactLinks, demo: approve ? 'approved' : 'draft' } });
  return error ? NextResponse.json({ error }, { status: 500 }) : NextResponse.json({ status: approve ? 'approved' : 'draft' });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id?: string };
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const lead = await getLeadById(id);
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  await deleteDemo(id);
  const { demo: _demo, demoLook: _look, ...rest } = lead.contactLinks ?? {};
  void _demo; void _look;
  await updateLead(id, { contact_links: Object.keys(rest).length ? rest : null });
  return NextResponse.json({ ok: true });
}
