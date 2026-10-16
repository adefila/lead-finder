import type { Lead } from '@/types/lead';
import { siteDestination } from '@/lib/tracking';
import { displayName } from '@/lib/leadview';
import { noteCopy } from '@/lib/notecopy';

// The one-page note a business owner sees, in their language (see src/lib/notecopy.ts).
// Shared by the short /n/ links and older /check/ links.
export async function NotePage({ lead }: { lead: Lead }) {
  const name = displayName(lead);
  const { copy, locale } = await noteCopy(lead);
  const sender = (process.env.MAIL_USER ?? process.env.GMAIL_USER ?? '').trim();
  const mailto = sender ? `mailto:${sender}?subject=${encodeURIComponent(copy.mailSubject)}` : null;

  return (
    <main className="check" lang={locale}>
      <article className="check-card">
        <p className="check-eyebrow">{copy.eyebrow}</p>
        <h1 className="check-title">{name}</h1>
        <p className="check-sub">{copy.sub}</p>

        {copy.workingText && (
          <section className="check-sec">
            <h2>{copy.workingTitle}</h2>
            <p>{copy.workingText}</p>
          </section>
        )}

        <section className="check-sec">
          <h2>{copy.setupTitle}</h2>
          <p className="check-lead">{copy.setupLead}</p>
          <ul className="check-list fix">
            {copy.systems.map(s => <li key={s}>{s}</li>)}
          </ul>
        </section>

        {copy.problems.length > 0 && (
          <section className="check-sec">
            <h2>{copy.siteTitle}</h2>
            <p className="check-lead">{copy.siteLead}</p>
            <ul className="check-list notice">
              {copy.problems.map(p => <li key={p}>{p}</li>)}
            </ul>
            {copy.fixes.length > 0 && (
              <ul className="check-list fix check-fixes">
                {copy.fixes.map(f => <li key={f}>{f}</li>)}
              </ul>
            )}
          </section>
        )}

        <section className="check-sec check-about">
          <h2>{copy.aboutTitle}</h2>
          <p>{copy.aboutText}</p>
          <div className="check-actions">
            {mailto && <a className="btn btn-primary" href={mailto}>{copy.emailMe}</a>}
            <a className="btn" href={siteDestination(lead)} target="_blank" rel="noreferrer">{copy.seeWork}</a>
          </div>
          <p className="check-note">{copy.closing}</p>
        </section>
      </article>
    </main>
  );
}
