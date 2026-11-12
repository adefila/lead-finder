import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { cache } from 'react';
import { DemoSite } from '@/components/DemoSite';
import { DemoModern } from '@/components/DemoModern';
import { SAMPLE_DEMOS } from '@/lib/demo';
import { findLeadByCode } from '@/lib/leadlookup';
import { getDemo } from '@/lib/supabase';
import { recordNoteView } from '@/lib/noteviews';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ key: string }>; searchParams: Promise<{ me?: string }> };

// A demo is found like a one-page note: the end of the address is a signed code, so addresses cannot be guessed.
// An approved demo is public to whoever has the link. A draft only opens with ?me=1, which is how you preview it.
const load = cache(async (key: string, me: boolean) => {
  if (process.env.NODE_ENV !== 'production' && SAMPLE_DEMOS[key]) return { demo: SAMPLE_DEMOS[key], lead: null };
  const code = key.split('-').pop() ?? '';
  if (!/^[0-9a-f]{12}$/.test(code)) return null;
  const lead = await findLeadByCode('note', code);
  if (!lead || !lead.contactLinks?.demo) return null;
  if (lead.contactLinks.demo !== 'approved' && !me) return null;
  const demo = await getDemo(lead.id);
  return demo ? { demo, lead } : null;
});

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const found = await load((await params).key, (await searchParams).me === '1');
  return { title: found ? `A concept for ${found.demo.brand.name}` : 'Concept', robots: { index: false, follow: false } };
}

export default async function DemoPage({ params, searchParams }: Props) {
  const me = (await searchParams).me === '1';
  const found = await load((await params).key, me);
  if (!found) notFound();
  const { demo, lead } = found;
  if (lead) await recordNoteView(lead, me);
  const sender = (process.env.MAIL_USER ?? process.env.GMAIL_USER ?? 'samuel@adefilasamuel.com').trim();
  const yes = `mailto:${sender}?subject=${encodeURIComponent(`Your concept for ${demo.brand.name}`)}&body=${encodeURIComponent(`Yes please, send me the short video for ${demo.brand.name}.`)}`;
  const wa = (process.env.WHATSAPP_NUMBER ?? '2348109841877').replace(/\D/g, '');
  const wa2 = wa ? `https://wa.me/${wa}` : null;
  return demo.look === 'modern' ? <DemoModern c={demo} yesHref={yes} waHref={wa2} /> : <DemoSite c={demo} yesHref={yes} waHref={wa2} />;
}
