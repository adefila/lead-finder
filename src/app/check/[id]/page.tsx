import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLeadById } from '@/lib/supabase';
import { displayName, hasCheck, leadStory } from '@/lib/leadview';
import { verifySig } from '@/lib/tracking';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ s?: string }> };

// Only a correctly signed link opens a check; anything else is a plain 404.
async function load({ params, searchParams }: Props) {
  const [{ id: raw }, { s }] = await Promise.all([params, searchParams]);
  const id = decodeURIComponent(raw);
  if (!s || !verifySig(id, 'check', s)) return null;
  const lead = await getLeadById(id);
  return lead && hasCheck(lead) ? lead : null;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const lead = await load(props);
  return {
    title: lead ? `Website check for ${displayName(lead)}` : 'Website check',
    robots: { index: false, follow: false },
  };
}

export default async function CheckPage(props: Props) {
  const lead = await load(props);
  if (!lead) notFound();
  console.log(`[check] viewed ${lead.id} (${lead.title})`);

  const name = displayName(lead);
  const story = leadStory(lead);
  const place = lead.company.split(' · ').slice(1).join(' · ') || lead.company;
  const rating = story.other.find(o => /stars from \d+/i.test(o))?.replace(/\.$/, '');
  const month = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const sender = (process.env.MAIL_USER ?? process.env.GMAIL_USER ?? '').trim();
  const mailto = sender ? `mailto:${sender}?subject=${encodeURIComponent(`Website for ${name}`)}` : null;

  return (
    <main className="check">
      <article className="check-card">
        <p className="check-eyebrow">Website check</p>
        <h1 className="check-title">{name}</h1>
        <p className="check-sub">{place} · Prepared by Samuel Adefila, {month}</p>

        <section className="check-sec">
          <h2>What I noticed</h2>
          <ul className="check-list notice">
            {story.ownerProblems.map(p => <li key={p}>{p}</li>)}
          </ul>
        </section>

        {rating && (
          <section className="check-sec">
            <h2>What is already working</h2>
            <p>Customers rate you {rating.replace(/ Google reviews$/, ' reviews on Google')}. A good website turns that reputation into calls and bookings from people who have not met you yet.</p>
          </section>
        )}

        <section className="check-sec">
          <h2>What I would change</h2>
          <ul className="check-list fix">
            {story.fixes.map(f => <li key={f}>{f}</li>)}
          </ul>
        </section>

        <section className="check-sec check-about">
          <h2>About me</h2>
          <p>
            I am Samuel, a web designer who builds clean, fast websites for small businesses.
            You deal with me directly from the first call to launch, and I keep things simple:
            a clear price up front, and a site you can update yourself.
          </p>
          <div className="check-actions">
            {mailto && <a className="btn btn-primary" href={mailto}>Email me</a>}
            <a className="btn" href="https://adefilasamuel.com" target="_blank" rel="noreferrer">See my work</a>
          </div>
          <p className="check-note">Or just reply to my email. No pressure, and this note is yours to keep either way.</p>
        </section>
      </article>
    </main>
  );
}
