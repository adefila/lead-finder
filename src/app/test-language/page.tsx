import type { Lead } from '@/types/lead';
import { draftFollowUp, generateColdEmails } from '@/lib/claude';
import { splitDraft, toHtml, withCheckLink, withSignature } from '@/lib/compose';
import { hasCheck, isJobLead, LANGUAGE_NAME, leadLanguage } from '@/lib/leadview';
import { noteCopy } from '@/lib/notecopy';

// Private test page (behind the dashboard login): runs sample leads through the real drafting,
// follow-up and note translation, and shows exactly what would be sent. Nothing is saved and
// nothing is emailed.
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const now = new Date().toISOString();
const base = { url: '', postedAt: now, status: 'new' as const };

const SAMPLES: Lead[] = [
  {
    ...base, id: 'test-nl', source: 'places', title: 'Tandartspraktijk Keizersgracht',
    company: 'Dentist · Amsterdam, Netherlands', contactEmail: 'info@example.nl',
    contactLinks: { website: 'https://example.nl' },
    description: 'Outdated website. Verified active: open on Google, last review 2 weeks ago, opening hours listed, phone listed. Keizersgracht 120, 1015 Amsterdam, Netherlands. 4.7 stars from 132 Google reviews. Issues found: not mobile-friendly (no viewport tag); footer copyright says 2019.',
    siteText: 'Tandartspraktijk Keizersgracht. Welkom bij onze praktijk in het centrum van Amsterdam. Tandarts Anna de Vries en haar team staan al 15 jaar voor u klaar. Afspraak maken? Bel ons op werkdagen tussen 8:00 en 17:00.',
  },
  {
    ...base, id: 'test-no', source: 'places', title: 'Bergersen Rør AS',
    company: 'Plumber · Oslo, Norway', contactEmail: 'post@example.no',
    contactLinks: { website: 'https://example.no' },
    description: 'Outdated website. Verified active: open on Google, last review 1 week ago, phone listed. Storgata 10, 0155 Oslo, Norway. 4.8 stars from 64 Google reviews. Issues found: no HTTPS (browsers show "Not secure"); almost no content on the homepage.',
    siteText: 'Bergersen Rør AS. Rørlegger i Oslo siden 1998. Vi tar alt fra små reparasjoner til nye bad. Ring oss for befaring. Daglig leder: Ole Bergersen.',
  },
  {
    ...base, id: 'test-fr', source: 'places', title: 'Boulangerie du Grund',
    company: 'Bakery · Luxembourg City, Luxembourg', contactEmail: 'contact@example.lu',
    contactLinks: { website: 'https://example.lu' },
    description: 'Outdated website. Verified active: open on Google, last review 3 days ago, opening hours listed. Rue Münster 5, 2160 Luxembourg. 4.6 stars from 210 Google reviews. Issues found: built with very old HTML (tables/font tags); footer copyright says 2016.',
    siteText: 'Boulangerie du Grund. Pain artisanal et pâtisseries maison depuis 1987. Commandes de gâteaux par téléphone uniquement. Fondée par la famille Weber.',
  },
  {
    ...base, id: 'test-en', source: 'places', title: 'Harbour Physio',
    company: 'Physiotherapist · Sydney, Australia', contactEmail: 'hello@example.com.au',
    contactLinks: { website: 'https://example.com.au' },
    description: 'Outdated website. Verified active: open on Google, last review 5 days ago. 12 Bay St, Sydney NSW, Australia. 4.9 stars from 88 Google reviews. Issues found: not mobile-friendly (no viewport tag).',
    siteText: 'Harbour Physio. Sports and spinal physiotherapy in Sydney. Book by phone. Principal physiotherapist: Dr. Sam Lee.',
  },
  {
    ...base, id: 'test-job-nl', source: 'job', title: 'Framer / Webflow Developer',
    company: 'Studio Noord · Amsterdam, Netherlands',
    description: 'Relocation: on-site role in Amsterdam with visa sponsorship and relocation support. We are a small design studio looking for a developer who builds marketing sites in Framer and Webflow, works closely with designers, and ships fast. English-speaking team.',
  },
  {
    ...base, id: 'test-job-remote', source: 'remote', title: 'Product Designer (Remote, Worldwide)',
    company: 'Lumen Labs · Remote, worldwide · Full-time',
    description: 'Fully remote, open worldwide. We need a product designer comfortable in Figma who can also build landing pages in Framer. Async team across time zones.',
  },
];

const SAMPLE_NOTE = 'https://notes.adefilasamuel.com/n/sample-000000000000';

async function runAll() {
  const drafted = await generateColdEmails(SAMPLES);
  return Promise.all(drafted.map(async lead => {
    const lang = leadLanguage(lead);
    const { subject, body } = splitDraft(lead.proposal ?? '');
    const isBusiness = hasCheck(lead);
    const text = body ? withSignature(isBusiness ? withCheckLink(body, SAMPLE_NOTE, lang) : body, lang, isJobLead(lead)) : '';
    const [followUp, note] = await Promise.all([
      body && lead.contactEmail
        ? draftFollowUp({ ...lead, status: 'approved', contactedAt: new Date(Date.now() - 4 * 86400000).toISOString(), followUps: 0 })
          .then(t => withSignature(t, lang, isJobLead(lead))).catch(e => `Follow-up failed: ${(e as Error).message}`)
        : Promise.resolve(''),
      isBusiness ? noteCopy(lead) : Promise.resolve(null),
    ]);
    return { lead, lang, subject, text, html: text ? toHtml(text) : '', followUp, note };
  }));
}

const box = { border: '1px solid #e5e5e5', borderRadius: 8, padding: 16, background: '#fff' } as const;
const pre = { whiteSpace: 'pre-wrap' as const, fontFamily: 'inherit', fontSize: 14, lineHeight: 1.55, margin: 0 };
const label = { fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: '#8a8f98', margin: '14px 0 6px' };

export default async function TestLanguagePage() {
  const started = Date.now();
  let results: Awaited<ReturnType<typeof runAll>> = [];
  let error = '';
  try { results = await runAll(); } catch (e) { error = (e as Error).message; }

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '32px 16px 80px', fontFamily: 'Inter, Arial, sans-serif', color: '#111', background: '#f7f7f7' }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Language test</h1>
      <p style={{ color: '#4b5159', marginBottom: 24 }}>
        Sample leads run through the real drafting, follow-up and note translation. Nothing is saved or sent.
        Took {Math.round((Date.now() - started) / 1000)}s.
      </p>
      {error && <p style={{ ...box, color: '#b42318' }}>Error: {error}</p>}
      <div style={{ display: 'grid', gap: 24 }}>
        {results.map(r => (
          <section key={r.lead.id} style={box} data-test-lead={r.lead.id} data-lang={r.lang}>
            <h2 style={{ fontSize: 18, margin: 0 }}>{r.lead.title}</h2>
            <p style={{ color: '#4b5159', margin: '2px 0 0' }}>
              {r.lead.company} · source: {r.lead.source} · language: <b>{LANGUAGE_NAME[r.lang]}</b> · fit score: {r.lead.score ?? 'n/a'}
            </p>

            <p style={label}>{r.lead.contactEmail ? 'First email' : 'Application note'}</p>
            {r.subject && <p style={{ margin: '0 0 8px' }}><b>Subject:</b> <span data-part="subject">{r.subject}</span></p>}
            <pre style={pre} data-part="body">{r.text || r.lead.proposal || '(no draft returned)'}</pre>

            {r.html && (
              <>
                <p style={label}>How the email looks in an inbox</p>
                <div style={{ ...box, background: '#fafafa' }} dangerouslySetInnerHTML={{ __html: r.html }} />
              </>
            )}

            {r.followUp && (
              <>
                <p style={label}>First follow-up (4 days later)</p>
                <pre style={pre} data-part="followup">{r.followUp}</pre>
              </>
            )}

            {r.note && (
              <>
                <p style={label}>One-page note ({r.note.locale})</p>
                <div style={{ ...box, background: '#fafafa' }} data-part="note">
                  <p style={{ margin: 0, color: '#8a8f98', fontSize: 12 }}>{r.note.copy.eyebrow}</p>
                  <p style={{ margin: '2px 0 10px', color: '#8a8f98', fontSize: 12 }}>{r.note.copy.sub}</p>
                  <b>{r.note.copy.setupTitle}</b>
                  <p style={{ margin: '4px 0' }}>{r.note.copy.setupLead}</p>
                  <ul>{r.note.copy.systems.map(s => <li key={s}>{s}</li>)}</ul>
                  {r.note.copy.problems.length > 0 && (
                    <>
                      <b>{r.note.copy.siteTitle}</b>
                      <ul>{r.note.copy.problems.map(s => <li key={s}>{s}</li>)}</ul>
                    </>
                  )}
                  <b>{r.note.copy.aboutTitle}</b>
                  <p style={{ margin: '4px 0' }}>{r.note.copy.aboutText}</p>
                  <p style={{ margin: '4px 0', color: '#4b5159' }}>[{r.note.copy.emailMe}] [{r.note.copy.seeWork}] {r.note.copy.closing}</p>
                </div>
              </>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
