import { NextRequest, NextResponse } from 'next/server';
import { deleteDemo, getDemo, getLeadById, saveDemo, updateLead } from '@/lib/supabase';
import { generateDemo } from '@/lib/demogen';
import { demoLink, emailLink } from '@/lib/tracking';
import { getReminderCopy } from '@/lib/remindcopy';
import { leadLanguage } from '@/lib/leadview';

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
  const reminders = lead.contactLinks?.demoKind === 'reminders';
  const demo = lead.contactLinks?.demo && !reminders ? await getDemo(id) : null;
  const has = !!demo || (reminders && !!lead.contactLinks?.demo);
  return NextResponse.json({ status: has ? lead.contactLinks?.demo : null, look: reminders ? 'reminders' : demo?.look ?? null, url: has ? previewUrl(lead) : null, hasWebsite: !!lead.contactLinks?.website, source: lead.contactLinks?.demoSource ?? null, kind: reminders ? 'reminders' : null });
}

// Build (or rebuild) the demo from the lead's own website. It starts as a draft: nothing goes in an email until you approve it.
export async function POST(req: NextRequest) {
  const { id, kind } = await req.json() as { id?: string; kind?: string };
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const lead = await getLeadById(id);
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  // The appointment-reminders demo is built from the lead's name and kind of business: no model, instant, free.
  if (kind === 'reminders') {
    await deleteDemo(id);
    // Translate the page's words now (once per language, kept), so it opens at once for the lead.
    await getReminderCopy(leadLanguage(lead)).catch(() => undefined);
    const error = await updateLead(id, { contact_links: { ...lead.contactLinks, demo: 'draft', demoLook: 'reminders', demoKind: 'reminders' } });
    return error ? NextResponse.json({ error }, { status: 500 }) : NextResponse.json({ status: 'draft', look: 'reminders', url: previewUrl(lead), kind: 'reminders' });
  }
  try {
    const result = await generateDemo(lead, { generic: true });
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 422 });
    const error = await saveDemo(id, result.demo);
    if (error) return NextResponse.json({ error }, { status: 500 });
    await updateLead(id, { contact_links: { ...lead.contactLinks, demo: 'draft', demoLook: result.demo.look, demoSource: result.generic ? 'generic' : 'site', demoKind: undefined } });
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
  // The link the email will carry now (the demo once approved, the note otherwise), so the page can show it at once.
  const emailUrl = emailLink({ ...lead, contactLinks: { ...lead.contactLinks, demo: approve ? 'approved' : 'draft' } }) ?? null;
  return error ? NextResponse.json({ error }, { status: 500 }) : NextResponse.json({ status: approve ? 'approved' : 'draft', emailUrl });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id?: string };
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const lead = await getLeadById(id);
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  await deleteDemo(id);
  const { demo: _demo, demoLook: _look, demoKind: _kind, ...rest } = lead.contactLinks ?? {};
  void _demo; void _look; void _kind;
  await updateLead(id, { contact_links: Object.keys(rest).length ? rest : null });
  const emailUrl = emailLink({ ...lead, contactLinks: Object.keys(rest).length ? rest : undefined }) ?? null;
  return NextResponse.json({ ok: true, emailUrl });
}
