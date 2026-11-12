'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ExternalLink, FileText, Trash2, Upload } from 'lucide-react';
import { useFeedback } from '@/components/feedback';
import type { Scholarship, ScholarshipMatch, CountryNote } from '@/lib/scholarships';
import { CLASS_LABEL } from '@/lib/scholarships';
import type { Classification, SchoolProfile } from '@/lib/school';
import type { FeedItem } from '@/lib/scholarshipfeed';

type Row = Scholarship & { match: ScholarshipMatch; monthsAway: number | null };
type Mark = 'saved' | 'applied' | 'no';
type Filter = 'all' | 'germany' | 'sweden' | 'elsewhere' | 'saved';

const KEY = 'lf-scholarship-marks';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'germany', label: 'Germany' }, { id: 'sweden', label: 'Sweden' }, { id: 'elsewhere', label: 'Elsewhere' }, { id: 'saved', label: 'Saved' },
];

function loadMarks(): Record<string, Mark> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Mark>; } catch { return {}; }
}

const closingSoon = (r: Row) => r.monthsAway !== null && r.monthsAway <= 2;
const isNewPost = (i: FeedItem) => Date.now() - new Date(i.foundAt).getTime() < 7 * 86400_000;

function whenLabel(r: Row): string {
  if (r.monthsAway === null) return r.closes;
  const m = r.monthsAway;
  return `${r.closes}${m === 0 ? ' (this month)' : m === 1 ? ' (next month)' : ` (in about ${m} months)`}`;
}

// Master's funding for computer science: upload your transcript and certificate, see what fits.
export function Scholarships() {
  const { toast, confirm } = useFeedback();
  const [rows, setRows] = useState<Row[]>([]);
  const [countries, setCountries] = useState<CountryNote[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [school, setSchool] = useState<SchoolProfile | null>(null);
  const [hasCv, setHasCv] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [showNo, setShowNo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/scholarships');
      const data = await res.json() as { list: Row[]; countries: CountryNote[]; school: SchoolProfile | null; hasCv: boolean; feed: FeedItem[] };
      setRows(data.list); setFeed(data.feed ?? []); setCountries(data.countries); setSchool(data.school); setHasCv(data.hasCv);
    } catch { toast('Could not load scholarships', { tone: 'error' }); }
    setReady(true);
  }, [toast]);
  useEffect(() => { void load(); setMarks(loadMarks()); }, [load]);

  const mark = (id: string, m: Mark | null) => {
    setMarks(prev => {
      const next = { ...prev };
      if (m === null || prev[id] === m) delete next[id]; else next[id] = m;
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* not saved */ }
      return next;
    });
  };

  const send = async (init: RequestInit) => {
    setBusy(true);
    try {
      const res = await fetch('/api/school', init);
      const data = await res.json() as { school?: SchoolProfile; error?: string };
      if (!res.ok) { toast(data.error ?? 'Could not read that', { tone: 'error' }); return; }
      setPasting(false); setPasted('');
      await load();
      toast('Read your school details', { tone: 'success' });
    } catch { toast('Could not read that', { tone: 'error' }); }
    finally { setBusy(false); }
  };
  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    const form = new FormData();
    [...files].forEach(f => form.append('file', f));
    void send({ method: 'POST', body: form });
  };
  const patch = async (body: object) => {
    const res = await fetch('/api/school', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) { toast('Could not save that', { tone: 'error' }); return; }
    await load();
  };
  const remove = async () => {
    if (!await confirm({ title: 'Remove your school details?', body: 'Scholarships stay listed but are no longer scored against your grades.', confirmLabel: 'Remove', danger: true })) return;
    await fetch('/api/school', { method: 'DELETE' });
    await load();
  };

  const shown = useMemo(() => rows.filter(r => {
    if (marks[r.id] === 'no' && !showNo) return false;
    if (filter === 'saved') return marks[r.id] === 'saved' || marks[r.id] === 'applied';
    if (filter === 'all') return true;
    return filter === 'elsewhere' ? (r.group === 'elsewhere' || r.group === 'global') : r.group === filter;
  }), [rows, filter, marks, showNo]);

  if (!ready) return <div className="empty">Loading scholarships…</div>;

  return (
    <div className="sc">
      <input ref={fileRef} type="file" hidden multiple accept=".pdf,.docx,.txt,.md" onChange={e => { upload(e.target.files); e.target.value = ''; }} />

      <div className="jm sc-school">
        {school ? (
          <div className="jm-row">
            <div className="jm-main">
              <div className="jm-title"><FileText size={14} />Scored against <strong>{school.files.join(', ') || 'your details'}</strong></div>
              <div className="jm-skills">
                {school.degree && <span className="jm-chip">{school.degree}</span>}
                {school.university && <span className="jm-chip">{school.university}</span>}
                {school.cgpa && <span className="jm-chip">CGPA {school.cgpa}</span>}
                {school.gradYear && <span className="jm-chip">Graduated {school.gradYear}</span>}
                {school.english && <span className="jm-chip">{school.english}</span>}
              </div>
              <div className="sc-fix">
                <label>Grade
                  <select value={school.classification ?? ''} onChange={e => void patch({ classification: (e.target.value || null) as Classification | null })}>
                    <option value="">Not found</option>
                    {Object.entries(CLASS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label>Degree field
                  <select value={school.field ?? ''} onChange={e => e.target.value && void patch({ field: e.target.value })}>
                    <option value="">Not found</option>
                    <option value="cs">Computer science or similar</option>
                    <option value="other">Something else</option>
                  </select>
                </label>
                <span className="jm-more">Wrong? Change it here.</span>
              </div>
            </div>
            <div className="jm-actions">
              <button className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={busy}><Upload size={13} />Add a file</button>
              <button className="icon-btn" onClick={() => void remove()} aria-label="Remove my school details" title="Remove my school details"><Trash2 size={14} /></button>
            </div>
          </div>
        ) : (
          <div className="jm-row">
            <div className="jm-main">
              <div className="jm-title"><FileText size={14} />Score these against your grades</div>
              <p className="jm-hint">Upload your transcript and certificate (PDF or Word). Free, and the files are not kept.</p>
              {pasting && (
                <div className="jm-form">
                  <textarea rows={4} value={pasted} onChange={e => setPasted(e.target.value)} placeholder="Paste the text of your transcript or certificate" aria-label="Transcript text" />
                  <div className="jm-line end"><button className="btn btn-sm" disabled={busy || pasted.trim().length < 60} onClick={() => void send({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: pasted }) })}>Use this text</button></div>
                </div>
              )}
            </div>
            <div className="jm-actions">
              <button className="btn btn-sm btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}><Upload size={13} />{busy ? 'Reading…' : 'Upload transcript'}</button>
              {!pasting && <button className="btn btn-sm" onClick={() => setPasting(true)} disabled={busy}>Paste text</button>}
            </div>
          </div>
        )}
        {!hasCv && <p className="jm-hint sc-cvhint">Some scholarships need years of work. Upload your CV on the Jobs tab and they are counted too.</p>}
      </div>

      <div className="sc-countries">
        <div className="sc-label">Where a master&rsquo;s costs little or nothing</div>
        <div className="sc-clist">
          {countries.map(c => (
            <a key={c.country} className="sc-crow" href={c.url} target="_blank" rel="noopener noreferrer">
              <span className="sc-cname">{c.country}</span>
              <span className={`sc-cost${/no longer/i.test(c.cost) ? ' bad' : /^free|almost/i.test(c.cost) ? ' good' : ''}`}>{c.cost}</span>
              <span className="sc-cnote">{c.note}</span>
            </a>
          ))}
        </div>
      </div>

      {feed.length > 0 && (
        <div className="sc-countries">
          <div className="sc-label">Newly posted</div>
          <div className="sc-clist">
            {feed.slice(0, 6).map(i => (
              <a key={i.link} className="sc-crow sc-feed" href={i.link} target="_blank" rel="noopener noreferrer">
                <span className="sc-cname">{i.region}{isNewPost(i) && <span className="sc-new">New</span>}</span>
                <span className="sc-cnote sc-ftitle">{i.title}</span>
                <span className="sc-cnote">{i.deadline.replace(/ deadline/i, '') || 'See page'}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="sc-bar">
        <div className="subtabs" role="group" aria-label="Filter scholarships">
          {FILTERS.map(f => <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>)}
        </div>
        {Object.values(marks).includes('no') && <button className="link-btn" onClick={() => setShowNo(v => !v)}>{showNo ? 'Hide' : 'Show'} the ones I passed on</button>}
      </div>

      <ul className="sc-list">
        {shown.map(r => {
          const open = openId === r.id;
          const tone = r.match.score >= 70 ? 'high' : r.match.score >= 45 ? 'mid' : 'low';
          return (
            <li key={r.id} className={`sc-item${marks[r.id] === 'no' ? ' dim' : ''}`}>
              <button className="sc-head" onClick={() => setOpenId(open ? null : r.id)} aria-expanded={open}>
                <span className={`match-tag ${tone}`} title="Fit with your details">{r.match.score}%</span>
                <span className="sc-name">{r.name}<span className="sc-sub">{r.country} · {r.provider}</span></span>
                {closingSoon(r) && <span className="sc-soon">{r.monthsAway === 0 ? 'Closes this month' : 'Closing soon'}</span>}
                <span className={`sc-fund ${r.funding}`}>{r.funding === 'full' ? 'Fully funded' : 'Part funded'}</span>
                {marks[r.id] && <span className="sc-mark">{marks[r.id] === 'saved' ? 'Saved' : marks[r.id] === 'applied' ? 'Applied' : 'Passed'}</span>}
                <ChevronDown size={15} className={`sc-chev${open ? ' open' : ''}`} />
              </button>
              {open && (
                <div className="sc-body">
                  <p>{r.summary}</p>
                  <dl>
                    <dt>Covers</dt><dd>{r.covers}</dd>
                    <dt>Closes</dt><dd>{whenLabel(r)}</dd>
                    <dt>English</dt><dd>{r.english}</dd>
                    <dt>Usually needs</dt><dd>{r.docs.join(', ')}{r.referees ? `. You can supply the ${r.referees} reference letters.` : ''}</dd>
                  </dl>
                  {r.match.why.length > 0 && <ul className="sc-why">{r.match.why.map(w => <li key={w}>{w}</li>)}</ul>}
                  {r.match.gaps.length > 0 && <ul className="sc-gap">{r.match.gaps.map(w => <li key={w}>{w}</li>)}</ul>}
                  <div className="sc-actions">
                    <a className="btn btn-sm btn-primary" href={r.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} />Official page</a>
                    <button className="btn btn-sm" aria-pressed={marks[r.id] === 'saved'} onClick={() => mark(r.id, 'saved')}>{marks[r.id] === 'saved' ? 'Saved' : 'Save'}</button>
                    <button className="btn btn-sm" aria-pressed={marks[r.id] === 'applied'} onClick={() => mark(r.id, 'applied')}>{marks[r.id] === 'applied' ? 'Applied' : 'Mark applied'}</button>
                    <button className="btn btn-sm" aria-pressed={marks[r.id] === 'no'} onClick={() => mark(r.id, 'no')}>{marks[r.id] === 'no' ? 'Bring back' : 'Not for me'}</button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
        {!shown.length && <li className="empty">{filter === 'saved' ? 'Nothing saved yet. Open a scholarship and click Save.' : 'Nothing here.'}</li>}
      </ul>
      <p className="sc-foot">Dates and amounts change every year. This is a starting list, so confirm everything on the official page before you apply.</p>
    </div>
  );
}
