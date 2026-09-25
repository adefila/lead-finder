'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Lead, LeadStatus } from '@/types/lead';
import { gmailComposeUrl, mailtoUrl, splitDraft } from '@/lib/compose';

// ─── Labels & helpers ─────────────────────────────────────────────────────────

const SOURCE_LABEL: Record<Lead['source'], string> = {
  upwork: 'Upwork',
  remoteok: 'RemoteOK',
  remotive: 'Remotive',
  weworkremotely: 'We Work Remotely',
  apollo: 'Apollo',
  freelancer: 'Freelancer',
  places: 'Local business',
};

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'To contact',
  approved: 'Contacted',
  replied: 'Replied',
  won: 'Won',
  lost: 'Lost',
  skipped: 'Skipped',
};

const HEADLINES = ['No website', 'Outdated website', 'Website broken'];

const LINK_LABELS = [
  ['instagram', 'Instagram'],
  ['facebook', 'Facebook'],
  ['linkedin', 'LinkedIn'],
  ['twitter', 'X'],
  ['website', 'Website'],
  ['maps', 'Google Maps'],
] as const;

type Tab = 'new' | 'approved' | 'replied' | 'won' | 'history';

const statusOf = (l: Lead): LeadStatus => l.status ?? 'new';

function headlineOf(l: Lead): string | null {
  if (l.source !== 'places') return null;
  const first = l.description.split('. ')[0];
  return HEADLINES.includes(first) ? first : null;
}

function whyText(l: Lead): string {
  const h = headlineOf(l);
  return h ? l.description.slice(h.length + 2) : l.description;
}

function shortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dayKey(iso?: string): string {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : 'unknown';
}

function scoreClass(s: number): string {
  if (s >= 75) return 'score hi';
  if (s >= 55) return 'score mid';
  return 'score';
}

function humanKey(k: string): string {
  return k.replace(/([A-Z])/g, ' $1').toLowerCase();
}

function pct(part: number, whole: number): string {
  return whole ? `${Math.round((part / whole) * 100)}%` : '0%';
}

// ─── Funnel ───────────────────────────────────────────────────────────────────

function Funnel({ leads }: { leads: Lead[] }) {
  const count = (...s: LeadStatus[]) => leads.filter(l => s.includes(statusOf(l))).length;
  const found = leads.length;
  const contacted = count('approved', 'replied', 'won', 'lost');
  const replied = count('replied', 'won', 'lost');
  const won = count('won');
  const stages = [
    { label: 'Found', value: found, meta: `${count('new')} waiting to contact` },
    { label: 'Contacted', value: contacted, meta: `${pct(contacted, found)} of found` },
    { label: 'Replied', value: replied, meta: `${pct(replied, contacted)} reply rate` },
    { label: 'Won', value: won, meta: `${pct(won, replied)} of replies` },
  ];

  return (
    <section>
      <div className="section-head">
        <span className="section-title">Pipeline</span>
        <span className="section-sub">{count('skipped')} skipped · {count('lost')} lost</span>
      </div>
      <div className="funnel">
        {stages.map(s => (
          <div key={s.label} className="stage">
            <span className="stage-label">{s.label}</span>
            <span className="stage-value">{s.value}</span>
            <span className="stage-meta">{s.meta}</span>
            <div className="stage-track" aria-hidden>
              <div className="stage-fill" style={{ width: found ? `${(s.value / found) * 100}%` : 0 }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Lead row ─────────────────────────────────────────────────────────────────

function LeadRow({ lead, showDate, onStatus }: {
  lead: Lead;
  showDate: boolean;
  onStatus: (status: LeadStatus) => void;
}) {
  const initial = useMemo(() => splitDraft(lead.proposal ?? ''), [lead.proposal]);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [copied, setCopied] = useState(false);

  const status = statusOf(lead);
  const headline = headlineOf(lead);
  const links = lead.contactLinks ?? {};
  const email = lead.contactEmail;
  const person = lead.contactName && lead.contactName !== lead.title ? lead.contactName : '';

  function copy() {
    navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const markContacted = () => { if (status === 'new') onStatus('approved'); };

  return (
    <div className={`row${open ? ' open' : ''}`}>
      <button className="row-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className={scoreClass(lead.score ?? 0)}>{lead.score ?? '-'}</span>
        <span style={{ minWidth: 0 }}>
          <div className="row-title">{lead.title}</div>
          <div className="row-meta">
            <span>{SOURCE_LABEL[lead.source]}</span>
            <span className="sep">/</span>
            <span>{lead.company}</span>
            {person && <><span className="sep">/</span><span>{person}{lead.contactTitle ? `, ${lead.contactTitle}` : ''}</span></>}
            {showDate && lead.createdAt && <><span className="sep">/</span><span>{shortDate(lead.createdAt)}</span></>}
          </div>
        </span>
        <span className="row-right">
          {headline && <span className="pill warn">{headline}</span>}
          {email && <span className="pill green">Email</span>}
          {lead.contactPhone && <span className="pill">Phone</span>}
          <span className="chev" aria-hidden>{open ? '−' : '+'}</span>
        </span>
      </button>

      {open && (
        <div className="detail">
          <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
            <div className="card">
              <span className="card-title">Contact</span>
              {person && <div className="kv"><span>Person</span><span>{person}{lead.contactTitle ? `, ${lead.contactTitle}` : ''}</span></div>}
              <div className="kv">
                <span>Email</span>
                {email ? <a className="mono" href={gmailComposeUrl(email, subject, body)} target="_blank" rel="noreferrer">{email}</a>
                  : <span className="muted">{lead.source === 'freelancer' ? 'Hidden by Freelancer, reply through a bid' : 'None found on their site'}</span>}
              </div>
              {lead.contactPhone && (
                <div className="kv"><span>Phone</span><a className="mono" href={`tel:${lead.contactPhone.replace(/\s/g, '')}`}>{lead.contactPhone}</a></div>
              )}
              {LINK_LABELS.some(([k]) => links[k]) && (
                <div className="kv">
                  <span>Links</span>
                  <div className="link-row">
                    {LINK_LABELS.filter(([k]) => links[k]).map(([k, label]) => (
                      <a key={k} className="btn btn-sm" href={links[k]} target="_blank" rel="noreferrer">{label}</a>
                    ))}
                  </div>
                </div>
              )}
              {lead.source === 'freelancer' && (
                <div className="kv"><span>Project</span><a href={lead.url} target="_blank" rel="noreferrer">Open on Freelancer</a></div>
              )}
            </div>
            <div className="card">
              <span className="card-title">Why this lead</span>
              <p className="why">{whyText(lead).slice(0, 600)}</p>
            </div>
          </div>

          <div className="card">
            <span className="card-title">{lead.source === 'freelancer' ? 'Bid proposal' : email ? 'Email' : 'Message (DM, call notes or contact form)'}</span>
            {(email || subject) && (
              <label>
                <span className="field-label">Subject</span>
                <input className="field" value={subject} onChange={e => setSubject(e.target.value)} />
              </label>
            )}
            <label>
              <span className="field-label">Message</span>
              <textarea className="field" rows={10} value={body} onChange={e => setBody(e.target.value)} />
            </label>

            <div className="actions">
              {status === 'new' && email && (
                <>
                  <a className="btn btn-primary" href={gmailComposeUrl(email, subject, body)} target="_blank" rel="noreferrer" onClick={markContacted}>Send in Gmail</a>
                  <a className="btn" href={mailtoUrl(email, subject, body)} onClick={markContacted}>Mail app</a>
                </>
              )}
              {status === 'new' && !email && lead.source === 'freelancer' && (
                <a className="btn btn-primary" href={lead.url} target="_blank" rel="noreferrer" onClick={() => { copy(); markContacted(); }}>Copy and open bid</a>
              )}
              {status === 'new' && !email && lead.source !== 'freelancer' && (
                <button className="btn btn-dark" onClick={markContacted}>Mark contacted</button>
              )}
              {status === 'approved' && <button className="btn btn-primary" onClick={() => onStatus('replied')}>Got a reply</button>}
              {status === 'replied' && (
                <>
                  <button className="btn btn-primary" onClick={() => onStatus('won')}>Won the project</button>
                  <button className="btn" onClick={() => onStatus('lost')}>Lost</button>
                </>
              )}
              {status !== 'new' && email && (
                <a className="btn" href={gmailComposeUrl(email, subject, body)} target="_blank" rel="noreferrer">Open in Gmail</a>
              )}
              <button className="btn" onClick={copy}>{copied ? 'Copied' : 'Copy message'}</button>
              <span className="spacer" />
              {status === 'new' && <button className="btn btn-quiet" onClick={() => onStatus('skipped')}>Skip</button>}
              {status === 'approved' && <button className="btn btn-quiet" onClick={() => onStatus('new')}>Move back</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── History ──────────────────────────────────────────────────────────────────

function History({ leads }: { leads: Lead[] }) {
  const [openDay, setOpenDay] = useState<string | null>(null);
  const days = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const l of leads) {
      const k = dayKey(l.createdAt);
      map.set(k, [...(map.get(k) ?? []), l]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [leads]);

  if (!days.length) return <div className="empty"><strong>No history yet</strong>Runs will show up here by day.</div>;

  return (
    <>
      {days.map(([day, list]) => {
        const n = (...s: LeadStatus[]) => list.filter(l => s.includes(statusOf(l))).length;
        const label = day === 'unknown' ? 'Unknown date'
          : new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const isOpen = openDay === day;
        return (
          <div key={day} className="row">
            <button className="day-head" onClick={() => setOpenDay(isOpen ? null : day)} aria-expanded={isOpen}>
              <span className="day-title">{label}</span>
              <span className="day-stats">
                <span className="pill">{list.length} found</span>
                {(() => {
                  const withEmail = list.filter(l => l.contactEmail).length;
                  return <span className={`pill${withEmail ? ' green' : ''}`}>{withEmail} with email</span>;
                })()}
                <span className="pill">{n('approved', 'replied', 'won', 'lost')} contacted</span>
                <span className="pill">{n('replied', 'won', 'lost')} replied</span>
                {n('won') > 0 && <span className="pill dark">{n('won')} won</span>}
              </span>
            </button>
            {isOpen && [...list].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map(l => (
              <div key={l.id} className="mini">
                <span className="mini-title">{l.title}</span>
                <span className="muted" style={{ fontSize: 12 }}>{SOURCE_LABEL[l.source]}</span>
                <span className={`pill${statusOf(l) === 'won' ? ' dark' : statusOf(l) === 'new' ? '' : ' green'}`}>{STATUS_LABEL[statusOf(l)]}</span>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type RunResult = { success?: boolean; stats?: Record<string, number>; durationMs?: number; error?: string };

const TABS: { id: Tab; label: string }[] = [
  { id: 'new', label: 'To contact' },
  { id: 'approved', label: 'Contacted' },
  { id: 'replied', label: 'Replied' },
  { id: 'won', label: 'Won' },
  { id: 'history', label: 'History' },
];

export default function Home() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('new');
  const [source, setSource] = useState<Lead['source'] | 'all'>('all');
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leads');
      setLeads(await res.json() as Lead[]);
    } catch { setLeads([]); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function runNow() {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch('/api/cron', { headers: { 'x-manual': 'true' } });
      const data = await res.json() as RunResult;
      setRunResult(data);
      if (data.success) await loadData();
    } catch (e) {
      setRunResult({ error: String(e) });
    }
    setRunning(false);
  }

  async function reset() {
    if (!confirm('Delete all leads (including contacted and won) and reset dedup history?')) return;
    const res = await fetch('/api/clear-stale', { headers: { 'x-manual': 'true' } });
    const data = await res.json() as { leadsDeleted?: number; error?: string };
    alert(data.error ? `Error: ${data.error}` : `Deleted ${data.leadsDeleted ?? 0} leads.`);
    await loadData();
  }

  async function setStatus(id: string, status: LeadStatus) {
    const before = leads;
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, status } : l)));
    const res = await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      setLeads(before);
      const { error } = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
      alert(`Could not update the lead: ${error}`);
    }
  }

  const sources = useMemo(() => [...new Set(leads.map(l => l.source))], [leads]);
  const scoped = useMemo(() => (source === 'all' ? leads : leads.filter(l => l.source === source)), [leads, source]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of scoped) c[statusOf(l)] = (c[statusOf(l)] ?? 0) + 1;
    return c;
  }, [scoped]);
  const visible = useMemo(() => {
    const list = scoped.filter(l => statusOf(l) === tab);
    return tab === 'new'
      ? list.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      : list.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }, [scoped, tab]);

  return (
    <>
      <header className="topbar">
        <div className="brand"><span className="brand-dot" />Lead Finder</div>
        <div className="topbar-actions">
          <span className="topbar-note">Auto-runs 07:00 and 18:00 UTC</span>
          <button className="btn btn-sm btn-ghost-dark" onClick={reset}>Reset</button>
          <button className="btn btn-sm btn-primary" onClick={runNow} disabled={running}>{running ? 'Running…' : 'Run now'}</button>
        </div>
      </header>

      <main className="page">
        {runResult && (
          <div className={`banner${runResult.success ? '' : ' error'}`}>
            <strong>{runResult.success ? 'Run complete' : 'Run failed'}</strong>
            {runResult.stats && Object.entries(runResult.stats).map(([k, v]) => (
              <span key={k}><strong>{v}</strong> {humanKey(k)}</span>
            ))}
            {runResult.durationMs && <span>{(runResult.durationMs / 1000).toFixed(0)}s</span>}
            {runResult.error && <span>{runResult.error}</span>}
          </div>
        )}

        <Funnel leads={scoped} />

        <div className="toolbar">
          <div className="tabs" role="tablist">
            {TABS.map(t => (
              <button key={t.id} className="tab" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label}
                {t.id !== 'history' && <span className="tab-count">{counts[t.id] ?? 0}</span>}
              </button>
            ))}
          </div>
          {sources.length > 1 && (
            <div className="filters">
              <button className="chip" aria-pressed={source === 'all'} onClick={() => setSource('all')}>All sources</button>
              {sources.map(s => (
                <button key={s} className="chip" aria-pressed={source === s} onClick={() => setSource(s)}>{SOURCE_LABEL[s]}</button>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          {loading ? (
            <div className="empty">Loading leads…</div>
          ) : tab === 'history' ? (
            <History leads={scoped} />
          ) : visible.length === 0 ? (
            <div className="empty">
              <strong>Nothing here yet</strong>
              {tab === 'new' ? 'Click Run now to find new leads.' : `Leads you move to ${STATUS_LABEL[tab]} will show up here.`}
            </div>
          ) : (
            visible.map(l => (
              <LeadRow key={l.id} lead={l} showDate={tab !== 'new'} onStatus={s => setStatus(l.id, s)} />
            ))
          )}
        </div>
      </main>
    </>
  );
}
