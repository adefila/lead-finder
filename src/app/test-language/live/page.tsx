import type { Lead } from '@/types/lead';
import { fetchPlacesLeads } from '@/lib/places';
import { generateColdEmails, MIN_FIT_BUSINESS, minFitFor, scoreJobs } from '@/lib/claude';
import { getLeads, saveLeads } from '@/lib/supabase';
import { splitDraft, withCheckLink, withSignature } from '@/lib/compose';
import { hasCheck, LANGUAGE_NAME, leadLanguage } from '@/lib/leadview';
import { noteLink } from '@/lib/tracking';
import { noteCopy } from '@/lib/notecopy';

// Private live test (behind the dashboard login): a real Google Maps search in the new
// countries, real websites and emails, real scoring and drafting in the local language.
// Good fits are saved to To contact like any other lead. Nothing is scheduled or sent.
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CITIES = ['Amsterdam, Netherlands', 'Oslo, Norway', 'Luxembourg City, Luxembourg'];

type Props = { searchParams: Promise<{ run?: string }> };

async function runLive() {
  const found = await fetchPlacesLeads({ cities: CITIES, searches: 6 });
  const known = new Set((await getLeads()).map(l => l.id));
  const fresh = found.filter(l => !known.has(l.id));
  const scored = fresh.length ? await scoreJobs(fresh) : [];
  const keep = scored.filter(l => (l.score ?? 0) >= minFitFor(l));
  const drafted = keep.length ? await generateColdEmails(keep) : [];
  await saveLeads(drafted);
  // Prepare each translated note now, so opening it below is instant.
  await Promise.all(drafted.filter(hasCheck).map(l => noteCopy(l).catch(() => null)));
  return { found: found.length, fresh: fresh.length, belowFit: scored.length - keep.length, drafted };
}

const box = { border: '1px solid #e5e5e5', borderRadius: 8, padding: 16, background: '#fff' } as const;
const pre = { whiteSpace: 'pre-wrap' as const, fontFamily: 'inherit', fontSize: 14, lineHeight: 1.55, margin: 0 };

export default async function LiveTestPage({ searchParams }: Props) {
  const run = (await searchParams).run === '1';
  const page = { maxWidth: 980, margin: '0 auto', padding: '32px 16px 80px', fontFamily: 'Inter, Arial, sans-serif', color: '#111' } as const;

  if (!run) {
    return (
      <main style={page}>
        <h1 style={{ fontSize: 24 }}>Live test: Netherlands, Norway, Luxembourg</h1>
        <p style={{ color: '#4b5159', maxWidth: 620 }}>
          Runs a real Google Maps search in {CITIES.join(', ')} (6 searches), reads each business&apos;s website for an
          email, scores them and writes their first email in Dutch, Norwegian or French. Good fits are saved to
          To contact. Nothing is scheduled or sent. Takes about 2 to 4 minutes.
        </p>
        <a href="?run=1" style={{ display: 'inline-block', marginTop: 12, background: '#111', color: '#fff', padding: '10px 16px', borderRadius: 6, textDecoration: 'none' }}>
          Run live test
        </a>
      </main>
    );
  }

  const started = Date.now();
  let result: Awaited<ReturnType<typeof runLive>> | null = null;
  let error = '';
  try { result = await runLive(); } catch (e) { error = (e as Error).message; }

  return (
    <main style={page}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Live test results</h1>
      {error && <p style={{ ...box, color: '#b42318' }}>Error: {error}</p>}
      {result && (
        <p style={{ color: '#4b5159', marginBottom: 24 }} data-summary>
          {result.found} businesses with a weak website and an email found, {result.fresh} new to Lead Finder,
          {' '}{result.belowFit} below the fit score ({MIN_FIT_BUSINESS}), {result.drafted.length} drafted and saved to To contact.
          Took {Math.round((Date.now() - started) / 1000)}s.
        </p>
      )}
      <div style={{ display: 'grid', gap: 24 }}>
        {result?.drafted.map((lead: Lead) => {
          const lang = leadLanguage(lead);
          const { subject, body } = splitDraft(lead.proposal ?? '');
          const link = hasCheck(lead) ? noteLink(lead) : '';
          const text = body ? withSignature(link ? withCheckLink(body, link, lang) : body, lang) : '(no draft)';
          return (
            <section key={lead.id} style={box} data-live-lead={lead.id} data-lang={lang}>
              <h2 style={{ fontSize: 18, margin: 0 }}>{lead.title}</h2>
              <p style={{ color: '#4b5159', margin: '2px 0 12px' }}>
                {lead.company} · {lead.contactEmail} · language: <b>{LANGUAGE_NAME[lang]}</b> · fit {lead.score}
                {lead.contactLinks?.website && <> · <a href={lead.contactLinks.website} target="_blank" rel="noreferrer">website</a></>}
                {link && <> · <a href={`${link}?me=1`} target="_blank" rel="noreferrer">open their note</a></>}
              </p>
              {subject && <p style={{ margin: '0 0 8px' }}><b>Subject:</b> <span data-part="subject">{subject}</span></p>}
              <pre style={pre} data-part="body">{text}</pre>
            </section>
          );
        })}
      </div>
    </main>
  );
}
