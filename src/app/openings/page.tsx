import { getLeads } from '@/lib/supabase';
import { openingTable } from '@/lib/openings';

export const dynamic = 'force-dynamic';

// Reply rate by the style of the email's first line. With only a handful of replies the numbers are rough:
// wait for about 100 sends per style before trusting a difference.
export default async function OpeningsPage() {
  const rows = openingTable(await getLeads());
  const total = rows.reduce((n, r) => n + r.sent, 0);
  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 20, marginBottom: 6 }}>Which email openings get replies</h1>
      <p style={{ fontSize: 13, color: 'var(--fg-3)', marginBottom: 20 }}>
        {total} sent emails, grouped by how the first line starts. Treat a style as proven only after about 100 sends.
      </p>
      <div className="sc-clist">
        {rows.map(r => (
          <div key={r.label} className="sc-crow" style={{ gridTemplateColumns: '170px 130px minmax(0, 1fr)' }}>
            <span className="sc-cname">{r.label}</span>
            <span className="sc-cnote">{r.sent} sent, {r.replied} replied{r.sent ? ` (${Math.round((r.replied / r.sent) * 1000) / 10}%)` : ''}</span>
            <span className="sc-cnote">{r.examples.map(e => `“${e}”`).join('  ·  ')}</span>
          </div>
        ))}
        {!rows.length && <div className="empty">No sent emails yet.</div>}
      </div>
      <p style={{ marginTop: 16 }}><a href="/" className="link-btn">Back to the dashboard</a></p>
    </main>
  );
}
