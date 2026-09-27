import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLeadById } from '@/lib/supabase';
import { displayName, hasCheck, leadStory, systemsFor } from '@/lib/leadview';
import { verifySig } from '@/lib/tracking';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ s?: string }> };

// Only a correctly signed link opens a note; anything else is a plain 404.
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
    title: lead ? `A few ideas for ${displayName(lead)}` : 'A few ideas',
    robots: { index: false, follow: false },
  };
}

export default async function CheckPage(props: Props) {
  const lead = await load(props);
  if (!lead) notFound();
  console.log(`[check] viewed ${lead.id} (${lead.title})`);

  const name = displayName(lead);
  const story = leadStory(lead);
  const systems = systemsFor(lead);
  const place = lead.company.split(' · ').slice(1).join(' · ') || lead.company;
  const rating = story.other.find(o => /stars from \d+/i.test(o))?.replace(/\.$/, '');
  const month = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const sender = (process.env.MAIL_USER ?? process.env.GMAIL_USER ?? '').trim();
  const mailto = sender ? `mailto:${sender}?subject=${encodeURIComponent(`Ideas for ${name}`)}` : null;

  return (
    <main className="check">
      <article className="check-card">
        <p className="check-eyebrow">A few ideas for your business</p>
        <h1 className="check-title">{name}</h1>
        <p className="check-sub">{place} · Prepared by Samuel Adefila, {month}</p>

        {rating && (
          <section className="check-sec">
            <h2>What is already working</h2>
            <p>Customers rate you {rating.replace(/ Google reviews$/, ' reviews on Google')}. The ideas below are about turning that reputation into more bookings, with less of your time spent chasing.</p>
          </section>
        )}

        <section className="check-sec">
          <h2>What I would set up for you</h2>
          <p className="check-lead">Small systems that save you time and bring in more customers. I set each one up for you, and after that it runs on its own.</p>
          <ul className="check-list fix">
            {systems.map(s => <li key={s}>{s}</li>)}
          </ul>
        </section>

        {story.ownerProblems.length > 0 && (
          <section className="check-sec">
            <h2>Your website</h2>
            <p className="check-lead">A few things I noticed, and how I would fix them.</p>
            <ul className="check-list notice">
              {story.ownerProblems.map(p => <li key={p}>{p}</li>)}
            </ul>
            {story.fixes.length > 0 && (
              <ul className="check-list fix check-fixes">
                {story.fixes.map(f => <li key={f}>{f}</li>)}
              </ul>
            )}
          </section>
        )}

        <section className="check-sec check-about">
          <h2>About me</h2>
          <p>
            I am Samuel. I build websites and simple systems that save small businesses time.
            You deal with me directly from the first call to launch, and I keep things simple:
            a clear price up front, and nothing you need to be technical to use.
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
