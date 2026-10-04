import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLeadById } from '@/lib/supabase';
import { displayName, hasCheck } from '@/lib/leadview';
import { verifySig } from '@/lib/tracking';
import { NotePage } from '@/components/NotePage';
import { recordNoteView } from '@/lib/noteviews';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ s?: string; me?: string }> };

// Older, long-form links. New emails use the short /n/ links; these keep working.
async function load({ params, searchParams }: Props) {
  const [{ id: raw }, { s }] = await Promise.all([params, searchParams]);
  const id = decodeURIComponent(raw);
  if (!s || !verifySig(id, 'check', s)) return null;
  const lead = await getLeadById(id);
  return lead && hasCheck(lead) ? lead : null;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const lead = await load(props);
  return { title: lead ? `A few ideas for ${displayName(lead)}` : 'A few ideas', robots: { index: false, follow: false } };
}

export default async function CheckPage(props: Props) {
  const lead = await load(props);
  if (!lead) notFound();
  await recordNoteView(lead, (await props.searchParams).me === '1');
  return <NotePage lead={lead} />;
}
