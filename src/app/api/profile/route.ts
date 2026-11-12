import { NextRequest, NextResponse } from 'next/server';
import { deleteProfile, getProfile, saveProfile } from '@/lib/supabase';
import { extractProfile, textFromFile, textFromUrl } from '@/lib/profile';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;

// What the page shows: the skills found, not the whole CV text.
const summary = (p: NonNullable<Awaited<ReturnType<typeof getProfile>>>) => ({
  skills: p.skills, titles: p.titles, years: p.years, source: p.source, updatedAt: p.updatedAt, chars: p.text.length,
});

export async function GET() {
  const p = await getProfile();
  return NextResponse.json({ profile: p ? summary(p) : null });
}

// Upload a CV (PDF, Word, text), paste text, or give a portfolio link.
export async function POST(req: NextRequest) {
  try {
    let text = '';
    let source = '';
    const type = req.headers.get('content-type') ?? '';
    if (type.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a file first' }, { status: 400 });
      if (file.size > MAX_BYTES) return NextResponse.json({ error: 'That file is over 8 MB' }, { status: 400 });
      text = await textFromFile(file.name, new Uint8Array(await file.arrayBuffer()));
      source = file.name;
    } else {
      const body = await req.json() as { text?: string; url?: string };
      if (body.url?.trim()) { text = await textFromUrl(body.url.trim()); source = body.url.trim(); }
      else if (body.text?.trim()) { text = body.text.trim().slice(0, 60_000); source = 'pasted text'; }
      else return NextResponse.json({ error: 'Add a file, some text or a link' }, { status: 400 });
    }
    if (text.length < 80) return NextResponse.json({ error: 'Not enough text could be read from that. If it is a scanned image, paste the text instead' }, { status: 400 });

    const profile = extractProfile(text, source);
    if (!profile.skills.length) return NextResponse.json({ error: 'No skills were recognised in that text. Is it your CV or portfolio?' }, { status: 400 });
    const error = await saveProfile(profile);
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ profile: summary(profile) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not read that' }, { status: 400 });
  }
}

export async function DELETE() {
  await deleteProfile();
  return NextResponse.json({ ok: true });
}
