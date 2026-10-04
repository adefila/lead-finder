import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLeads } from '@/lib/supabase';
import { displayName, hasCheck } from '@/lib/leadview';
import { noteKeyMatches } from '@/lib/tracking';
import { NotePage } from '@/components/NotePage';
import { recordNoteView } from '@/lib/noteviews';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ key: string }>; searchParams: Promise<{ me?: string }> };

// Short, readable link: /n/green-dental-4f9a2c1b07aa. The last part is a signature, so
// links cannot be guessed or edited to reach another business's note.
async function load({ params }: Props) {
  const { key } = await params;
  const code = key.split('-').pop() ?? '';
  if (!/^[0-9a-f]{12}$/.test(code)) return null;
  const lead = (await getLeads()).find(l => noteKeyMatches(l.id, code));
  return lead && hasCheck(lead) ? lead : null;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const lead = await load(props);
  return { title: lead ? `A few ideas for ${displayName(lead)}` : 'A few ideas', robots: { index: false, follow: false } };
}

export default async function ShortNotePage(props: Props) {
  const lead = await load(props);
  if (!lead) notFound();
  await recordNoteView(lead, (await props.searchParams).me === '1');
  return <NotePage lead={lead} />;
}
