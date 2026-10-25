import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { displayName, hasCheck, leadLanguage } from '@/lib/leadview';
import { findLeadByCode } from '@/lib/leadlookup';
import { NotePage } from '@/components/NotePage';
import { recordNoteView } from '@/lib/noteviews';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ key: string }>; searchParams: Promise<{ me?: string }> };

// Short, readable link: /n/green-dental-4f9a2c1b07aa. The last part is a signature, so
// links cannot be guessed or edited to reach another business's note.
// Cached per request: the page and its metadata both need the lead, so look it up once.
const loadByKey = cache(async (key: string) => {
  const code = key.split('-').pop() ?? '';
  if (!/^[0-9a-f]{12}$/.test(code)) return null;
  const lead = await findLeadByCode('note', code);
  return lead && hasCheck(lead) ? lead : null;
});

async function load({ params }: Props) {
  return loadByKey((await params).key);
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const lead = await load(props);
  // The tab title in the reader's language, like the note itself.
  const forName = { en: 'A few ideas for', nl: 'Een paar ideeën voor', no: 'Noen ideer for', fr: 'Quelques idées pour' };
  return { title: lead ? `${forName[leadLanguage(lead)]} ${displayName(lead)}` : 'A few ideas', robots: { index: false, follow: false } };
}

export default async function ShortNotePage(props: Props) {
  const lead = await load(props);
  if (!lead) notFound();
  await recordNoteView(lead, (await props.searchParams).me === '1');
  return <NotePage lead={lead} />;
}
