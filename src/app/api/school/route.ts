import { NextRequest, NextResponse } from 'next/server';
import { deleteSchool, getSchool, saveSchool } from '@/lib/supabase';
import { textFromFile } from '@/lib/profile';
import { extractSchool, type Classification, type SchoolProfile } from '@/lib/school';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;

export async function GET() {
  return NextResponse.json({ school: await getSchool() });
}

// Upload the transcript and degree certificate (PDF, Word or text), or paste the text.
export async function POST(req: NextRequest) {
  try {
    let text = '';
    const files: string[] = [];
    if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
      const form = await req.formData();
      const list = form.getAll('file').filter((f): f is File => f instanceof File);
      if (!list.length) return NextResponse.json({ error: 'Choose a file first' }, { status: 400 });
      for (const file of list.slice(0, 4)) {
        if (file.size > MAX_BYTES) return NextResponse.json({ error: `${file.name} is over 8 MB` }, { status: 400 });
        text += '\n' + await textFromFile(file.name, new Uint8Array(await file.arrayBuffer()));
        files.push(file.name);
      }
    } else {
      const body = await req.json() as { text?: string };
      if (!body.text?.trim()) return NextResponse.json({ error: 'Add a file or some text' }, { status: 400 });
      text = body.text.slice(0, 60_000); files.push('pasted text');
    }
    if (text.trim().length < 60) return NextResponse.json({ error: 'Not enough text could be read. A scanned photo has no text in it, so paste the text or type the details instead' }, { status: 400 });

    // Keep what you set by hand if you add another file later.
    const before = await getSchool();
    const found = extractSchool(text, files);
    const school: SchoolProfile = before ? {
      ...found,
      degree: found.degree ?? before.degree, university: found.university ?? before.university, field: found.field ?? before.field,
      classification: found.classification ?? before.classification, cgpa: found.cgpa ?? before.cgpa,
      gradYear: found.gradYear ?? before.gradYear, english: found.english ?? before.english,
      files: [...new Set([...before.files, ...files])],
    } : found;
    const error = await saveSchool(school);
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ school });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not read that' }, { status: 400 });
  }
}

// Fix what was read wrongly: grade class, whether the degree is in computing.
export async function PATCH(req: NextRequest) {
  const body = await req.json() as { classification?: Classification | null; field?: 'cs' | 'other'; english?: string | null };
  const now = (await getSchool()) ?? extractSchool('', []);
  const next: SchoolProfile = {
    ...now,
    ...('classification' in body ? { classification: body.classification ?? null } : {}),
    ...(body.field ? { field: body.field } : {}),
    ...('english' in body ? { english: body.english?.trim().slice(0, 40) || null } : {}),
    updatedAt: new Date().toISOString(),
  };
  const error = await saveSchool(next);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ school: next });
}

export async function DELETE() {
  await deleteSchool();
  return NextResponse.json({ ok: true });
}
