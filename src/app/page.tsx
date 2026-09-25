'use client';

import { useState, useEffect, useCallback, useMemo, type ComponentProps } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import type { Lead, LeadStatus } from '@/types/lead';
import { gmailComposeUrl, mailtoUrl, splitDraft } from '@/lib/compose';
import { followUpState, needsAttention, MAX_FOLLOW_UPS } from '@/lib/followup';

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

type Tab = 'new' | 'approved' | 'followup' | 'replied' | 'won' | 'history';

const TABS: { id: Tab; label: string }[] = [
  { id: 'new', label: 'To contact' },
  { id: 'approved', label: 'Contacted' },
  { id: 'followup', label: 'Follow up' },
  { id: 'replied', label: 'Replied' },
  { id: 'won', label: 'Won' },
  { id: 'history', label: 'History' },
];

const EASE = [0.22, 1, 0.36, 1] as const;

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

function shortDate(value?: string | Date | null): string {
  if (!value) return '';
  const d = new Date(value);
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

function followUpLabel(l: Lead): { text: string; tone: 'warn' | '' } | null {
  const s = followUpState(l);
  if (statusOf(l) !== 'approved') return null;
  if (s.exhausted) return { text: 'No reply, close it?', tone: 'warn' };
  if (s.due) return { text: `Follow-up ${s.sent + 1} due`, tone: 'warn' };
  if (s.sent >= MAX_FOLLOW_UPS) return { text: `${s.sent} follow-ups sent`, tone: '' };
  return { text: `Follow up ${shortDate(s.dueAt)}`, tone: '' };
}

// ─── Small pieces ─────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`icon-btn${done ? ' done' : ''}`}
      aria-label={done ? 'Copied' : label}
      title={done ? 'Copied' : label}
      onClick={() => {
        navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.svg
          key={done ? 'check' : 'copy'}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {done
            ? <path d="M20 6 9 17l-5-5" />
            : <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></>}
        </motion.svg>
      </AnimatePresence>
    </button>
  );
}

function Btn(props: ComponentProps<typeof motion.button>) {
  return <motion.button whileTap={{ scale: 0.97 }} {...props} />;
}

function LinkBtn(props: ComponentProps<typeof motion.a>) {
  return <motion.a whileTap={{ scale: 0.97 }} {...props} />;
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
        {stages.map((s, i) => (
          <motion.div
            key={s.label}
            className="stage"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.06, ease: EASE }}
          >
            <span className="stage-label">{s.label}</span>
            <motion.span key={s.value} className="stage-value" initial={{ opacity: 0.3, y: 4 }} animate={{ opacity: 1, y: 0 }}>
              {s.value}
            </motion.span>
            <span className="stage-meta">{s.meta}</span>
            <div className="stage-track" aria-hidden>
              <motion.div
                className="stage-fill"
                initial={{ width: 0 }}
                animate={{ width: found ? `${(s.value / found) * 100}%` : '0%' }}
                transition={{ duration: 0.7, delay: 0.15 + i * 0.06, ease: EASE }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ─── Lead row ─────────────────────────────────────────────────────────────────

function LeadRow({ lead, mode, index, onStatus, onFollowedUp }: {
  lead: Lead;
  mode: Tab;
  index: number;
  onStatus: (status: LeadStatus) => void;
  onFollowedUp: () => void;
}) {
  const initial = useMemo(() => splitDraft(lead.proposal ?? ''), [lead.proposal]);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [drafting, setDrafting] = useState(false);
  const [followUpLoaded, setFollowUpLoaded] = useState(false);

  const status = statusOf(lead);
  const fu = followUpState(lead);
  const fuLabel = followUpLabel(lead);
  const headline = headlineOf(lead);
  const links = lead.contactLinks ?? {};
  const email = lead.contactEmail;
  const person = lead.contactName && lead.contactName !== lead.title ? lead.contactName : '';
  const isFollowUp = mode === 'followup' && fu.due;

  const writeFollowUp = useCallback(async () => {
    setDrafting(true);
    try {
      const res = await fetch('/api/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (data.message) {
        setBody(data.message);
        if (initial.subject) setSubject(initial.subject.startsWith('Re:') ? initial.subject : `Re: ${initial.subject}`);
        setFollowUpLoaded(true);
      } else {
        alert(data.error ?? 'Could not draft the follow-up');
      }
    } finally {
      setDrafting(false);
    }
  }, [lead.id, initial.subject]);

  useEffect(() => {
    if (open && isFollowUp && !followUpLoaded && !drafting) writeFollowUp();
  }, [open, isFollowUp, followUpLoaded, drafting, writeFollowUp]);

  const markContacted = () => { if (status === 'new') onStatus('approved'); };
  const sent = () => (isFollowUp ? onFollowedUp() : markContacted());
  const gmail = email ? gmailComposeUrl(email, subject, body) : '';

  return (
    <motion.div
      layout="position"
      className={`row${open ? ' open' : ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3, delay: Math.min(index, 10) * 0.03, ease: EASE }}
    >
      <button className="row-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className={scoreClass(lead.score ?? 0)}>{lead.score ?? '-'}</span>
        <span style={{ minWidth: 0 }}>
          <div className="row-title">{lead.title}</div>
          <div className="row-meta">
            <span>{SOURCE_LABEL[lead.source]}</span>
            <span className="sep">/</span>
            <span>{lead.company}</span>
            {person && <><span className="sep">/</span><span>{person}{lead.contactTitle ? `, ${lead.contactTitle}` : ''}</span></>}
            {mode !== 'new' && lead.createdAt && <><span className="sep">/</span><span>{shortDate(lead.createdAt)}</span></>}
          </div>
        </span>
        <span className="row-right">
          {fuLabel && <span className={`pill ${fuLabel.tone}`}>{fuLabel.text}</span>}
          {!fuLabel && headline && <span className="pill warn">{headline}</span>}
          {email && <span className="pill green">Email</span>}
          {lead.contactPhone && <span className="pill">Phone</span>}
          <motion.span className="chev" aria-hidden animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }}>+</motion.span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            style={{ overflow: 'hidden' }}
          >
            <div className="detail">
              <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
                <div className="card">
                  <span className="card-title">Contact</span>
                  {person && <div className="kv"><span>Person</span><span>{person}{lead.contactTitle ? `, ${lead.contactTitle}` : ''}</span></div>}
                  <div className="kv">
                    <span>Email</span>
                    {email ? (
                      <span className="kv-value">
                        <a className="mono" href={gmail} target="_blank" rel="noreferrer">{email}</a>
                        <CopyButton text={email} label="Copy email" />
                      </span>
                    ) : (
                      <span className="muted">{lead.source === 'freelancer' ? 'Hidden by Freelancer, reply through a bid' : 'None found on their site'}</span>
                    )}
                  </div>
                  {lead.contactPhone && (
                    <div className="kv">
                      <span>Phone</span>
                      <span className="kv-value">
                        <a className="mono" href={`tel:${lead.contactPhone.replace(/\s/g, '')}`}>{lead.contactPhone}</a>
                        <CopyButton text={lead.contactPhone} label="Copy phone number" />
                      </span>
                    </div>
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
                  {status === 'approved' && (
                    <div className="kv">
                      <span>Timeline</span>
                      <span>
                        Contacted {shortDate(lead.contactedAt ?? lead.createdAt)}
                        {fu.sent > 0 && `, ${fu.sent} follow-up${fu.sent > 1 ? 's' : ''} sent`}
                        {!fu.exhausted && fu.dueAt && `. ${fu.due ? 'Follow-up due now' : `Next follow-up ${shortDate(fu.dueAt)}`}`}
                      </span>
                    </div>
                  )}
                </div>
                <div className="card">
                  <span className="card-title">Why this lead</span>
                  <p className="why">{whyText(lead).slice(0, 600)}</p>
                </div>
              </div>

              <div className="card">
                <span className="card-title">
                  {isFollowUp ? `Follow-up ${fu.sent + 1} of ${MAX_FOLLOW_UPS}` : lead.source === 'freelancer' ? 'Bid proposal' : email ? 'Email' : 'Message (DM, call notes or contact form)'}
                </span>

                {mode === 'followup' && fu.exhausted && (
                  <div className="note">No reply after {fu.sent} follow-ups. Close it out, or mark it if they got back to you.</div>
                )}

                {(email || subject) && (
                  <label>
                    <span className="field-label">Subject</span>
                    <input className="field" value={subject} onChange={e => setSubject(e.target.value)} />
                  </label>
                )}
                <label>
                  <span className="field-label">{drafting ? 'Writing follow-up…' : 'Message'}</span>
                  <textarea className="field" rows={10} value={body} disabled={drafting} onChange={e => setBody(e.target.value)} />
                </label>

                <div className="actions">
                  {(status === 'new' || isFollowUp) && email && (
                    <>
                      <LinkBtn className="btn btn-primary" href={gmail} target="_blank" rel="noreferrer" onClick={sent}>
                        {isFollowUp ? 'Send follow-up in Gmail' : 'Send in Gmail'}
                      </LinkBtn>
                      <LinkBtn className="btn" href={mailtoUrl(email, subject, body)} onClick={sent}>Mail app</LinkBtn>
                    </>
                  )}
                  {status === 'new' && !email && lead.source === 'freelancer' && (
                    <LinkBtn className="btn btn-primary" href={lead.url} target="_blank" rel="noreferrer"
                      onClick={() => { navigator.clipboard.writeText(body); markContacted(); }}>
                      Copy and open bid
                    </LinkBtn>
                  )}
                  {status === 'new' && !email && lead.source !== 'freelancer' && (
                    <Btn className="btn btn-dark" onClick={markContacted}>Mark contacted</Btn>
                  )}
                  {isFollowUp && !email && <Btn className="btn btn-dark" onClick={onFollowedUp}>Mark followed up</Btn>}
                  {isFollowUp && <Btn className="btn" onClick={writeFollowUp} disabled={drafting}>Rewrite</Btn>}

                  {status === 'approved' && <Btn className={`btn${isFollowUp ? '' : ' btn-primary'}`} onClick={() => onStatus('replied')}>Got a reply</Btn>}
                  {(status === 'approved' || status === 'replied') && <Btn className="btn" onClick={() => onStatus('won')}>Won the project</Btn>}
                  {(status === 'replied' || fu.exhausted) && <Btn className="btn" onClick={() => onStatus('lost')}>{fu.exhausted ? 'Close as lost' : 'Lost'}</Btn>}
                  {status === 'approved' && !isFollowUp && email && (
                    <a className="btn" href={gmail} target="_blank" rel="noreferrer">Open in Gmail</a>
                  )}

                  <span className="spacer" />
                  <CopyButton text={body} label="Copy message" />
                  {status === 'new' && <Btn className="btn btn-quiet" onClick={() => onStatus('skipped')}>Skip</Btn>}
                  {status === 'approved' && mode === 'approved' && <Btn className="btn btn-quiet" onClick={() => onStatus('new')}>Move back</Btn>}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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
      {days.map(([day, list], i) => {
        const n = (...s: LeadStatus[]) => list.filter(l => s.includes(statusOf(l))).length;
        const withEmail = list.filter(l => l.contactEmail).length;
        const label = day === 'unknown' ? 'Unknown date'
          : new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const isOpen = openDay === day;
        return (
          <motion.div key={day} className="row" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(i, 10) * 0.03, ease: EASE }}>
            <button className="day-head" onClick={() => setOpenDay(isOpen ? null : day)} aria-expanded={isOpen}>
              <span className="day-title">{label}</span>
              <span className="day-stats">
                <span className="pill">{list.length} found</span>
                <span className={`pill${withEmail ? ' green' : ''}`}>{withEmail} with email</span>
                <span className="pill">{n('approved', 'replied', 'won', 'lost')} contacted</span>
                <span className="pill">{n('replied', 'won', 'lost')} replied</span>
                {n('won') > 0 && <span className="pill dark">{n('won')} won</span>}
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: EASE }} style={{ overflow: 'hidden' }}>
                  {[...list].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map(l => (
                    <div key={l.id} className="mini">
                      <span className="mini-title">{l.title}</span>
                      <span className="muted" style={{ fontSize: 12 }}>{SOURCE_LABEL[l.source]}</span>
                      <span className={`pill${statusOf(l) === 'won' ? ' dark' : statusOf(l) === 'new' ? '' : ' green'}`}>{STATUS_LABEL[statusOf(l)]}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type RunResult = { success?: boolean; stats?: Record<string, number>; durationMs?: number; error?: string };

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

  async function patch(id: string, payload: Record<string, unknown>, optimistic: (l: Lead) => Lead) {
    const before = leads;
    setLeads(prev => prev.map(l => (l.id === id ? optimistic(l) : l)));
    const res = await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...payload }),
    });
    if (!res.ok) {
      setLeads(before);
      const { error } = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
      alert(`Could not update the lead: ${error}`);
    }
  }

  const setStatus = (id: string, status: LeadStatus) => patch(id, { status }, l => ({
    ...l,
    status,
    ...(status === 'approved' ? { contactedAt: new Date().toISOString(), followUps: 0 } : {}),
    ...(status === 'new' ? { contactedAt: undefined, followUps: 0 } : {}),
  }));

  const followedUp = (id: string) => patch(id, { action: 'followed_up' }, l => ({
    ...l,
    followUps: (l.followUps ?? 0) + 1,
    contactedAt: new Date().toISOString(),
  }));

  const sources = useMemo(() => [...new Set(leads.map(l => l.source))], [leads]);
  const scoped = useMemo(() => (source === 'all' ? leads : leads.filter(l => l.source === source)), [leads, source]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { followup: scoped.filter(needsAttention).length };
    for (const l of scoped) c[statusOf(l)] = (c[statusOf(l)] ?? 0) + 1;
    return c;
  }, [scoped]);

  const visible = useMemo(() => {
    if (tab === 'followup') {
      return scoped.filter(needsAttention).sort((a, b) =>
        (followUpState(a).dueAt?.getTime() ?? 0) - (followUpState(b).dueAt?.getTime() ?? 0));
    }
    const list = scoped.filter(l => statusOf(l) === tab);
    return tab === 'new'
      ? list.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      : list.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }, [scoped, tab]);

  const emptyText: Record<Tab, string> = {
    new: 'Click Run now to find new leads.',
    approved: 'Leads you contact show up here.',
    followup: 'Nothing due. Follow-ups appear 3 days after you contact someone.',
    replied: 'Leads that reply show up here.',
    won: 'Projects you win show up here.',
    history: '',
  };

  return (
    <MotionConfig reducedMotion="user">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand"><span className="brand-dot" />Lead Finder</div>
          <div className="topbar-actions">
            <span className="topbar-note">Auto-runs 07:00 and 18:00 UTC</span>
            <Btn className="btn btn-sm btn-ghost-dark" onClick={reset}>Reset</Btn>
            <Btn className="btn btn-sm btn-primary" onClick={runNow} disabled={running}>{running ? 'Running…' : 'Run now'}</Btn>
          </div>
        </div>
      </header>

      <main className="page">
        <AnimatePresence>
          {runResult && (
            <motion.div
              className={`banner${runResult.success ? '' : ' error'}`}
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            >
              <strong>{runResult.success ? 'Run complete' : 'Run failed'}</strong>
              {runResult.stats && Object.entries(runResult.stats).map(([k, v]) => (
                <span key={k}><strong>{v}</strong> {humanKey(k)}</span>
              ))}
              {runResult.durationMs && <span>{(runResult.durationMs / 1000).toFixed(0)}s</span>}
              {runResult.error && <span>{runResult.error}</span>}
            </motion.div>
          )}
        </AnimatePresence>

        <Funnel leads={scoped} />

        <div className="toolbar">
          <div className="tabs" role="tablist">
            {TABS.map(t => (
              <button key={t.id} className="tab" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                {tab === t.id && (
                  <motion.span layoutId="tab-bg" className="tab-bg" transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }} />
                )}
                <span className="tab-label">
                  {t.label}
                  {t.id !== 'history' && (
                    <span className={`tab-count${t.id === 'followup' && counts.followup ? ' alert' : ''}`}>{counts[t.id] ?? 0}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
          {sources.length > 1 && (
            <div className="filters">
              <Btn className="chip" aria-pressed={source === 'all'} onClick={() => setSource('all')}>All sources</Btn>
              {sources.map(s => (
                <Btn key={s} className="chip" aria-pressed={source === s} onClick={() => setSource(s)}>{SOURCE_LABEL[s]}</Btn>
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
            <motion.div className="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <strong>Nothing here yet</strong>
              {emptyText[tab]}
            </motion.div>
          ) : (
            <AnimatePresence initial={false}>
              {visible.map((l, i) => (
                <LeadRow
                  key={`${tab}-${l.id}`}
                  lead={l}
                  mode={tab}
                  index={i}
                  onStatus={s => setStatus(l.id, s)}
                  onFollowedUp={() => followedUp(l.id)}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </main>
    </MotionConfig>
  );
}
