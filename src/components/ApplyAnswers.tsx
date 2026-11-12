'use client';

import { useEffect, useRef, useState } from 'react';
import { useFeedback } from '@/components/feedback';
import { ANSWER_FIELDS, EMPTY_ANSWERS, type Answers } from '@/lib/answers';

// The form behind "apply for me": filled once, used for every application.
export function ApplyAnswers({ onClose }: { onClose: () => void }) {
  const { toast } = useFeedback();
  const [a, setA] = useState<Answers>(EMPTY_ANSWERS);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/answers').then(r => r.json()).then((d: { answers: Answers }) => { setA(d.answers); setReady(true); }).catch(() => setReady(true));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/answers', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a) });
      const d = await res.json() as { error?: string };
      if (!res.ok) { toast(d.error ?? 'Could not save', { tone: 'error' }); return; }
      toast('Saved your answers', { tone: 'success' });
      onClose();
    } catch { toast('Could not save', { tone: 'error' }); }
    finally { setSaving(false); }
  };

  // Hand the answers and the jobs waiting to apply to the apply script as one file.
  const exportData = async () => {
    try {
      const [ans, queue] = await Promise.all([fetch('/api/answers').then(r => r.json()), fetch('/api/jobs/queue?min=85').then(r => r.json())]);
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), answers: ans.answers, jobs: queue.jobs }, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob); link.download = 'apply-data.json'; link.click();
      URL.revokeObjectURL(link.href);
      toast(`Exported ${queue.jobs?.length ?? 0} jobs to apply for`, { tone: 'success' });
    } catch { toast('Could not export', { tone: 'error' }); }
  };

  // The script writes apply-results.json: mark what it submitted as applied.
  const importResults = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as { applied?: string[] };
      if (!data.applied?.length) { toast('No applied jobs in that file', { tone: 'error' }); return; }
      const res = await fetch('/api/jobs/queue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: data.applied }) });
      if (!res.ok) { toast('Could not mark them applied', { tone: 'error' }); return; }
      toast(`Marked ${data.applied.length} job${data.applied.length === 1 ? '' : 's'} applied. Refresh to see them`, { tone: 'success' });
    } catch { toast('That file could not be read', { tone: 'error' }); }
  };

  if (!ready) return <div className="aa"><p className="jm-hint">Loading…</p></div>;
  return (
    <div className="aa">
      <p className="jm-hint">The answers application forms ask for. Filled once, used for every job. Blank fields are left blank, never guessed.</p>
      <div className="aa-grid">
        {ANSWER_FIELDS.map(f => (
          <label key={f.key} className={`aa-field${f.long ? ' wide' : ''}`}>
            <span className="aa-label">{f.label}</span>
            {f.options ? (
              <select value={a[f.key]} onChange={e => setA({ ...a, [f.key]: e.target.value })}>
                {f.options.map(o => <option key={o} value={o}>{o || 'Not set'}</option>)}
              </select>
            ) : f.long ? (
              <textarea rows={3} value={a[f.key]} placeholder={f.hint} onChange={e => setA({ ...a, [f.key]: e.target.value })} />
            ) : (
              <input value={a[f.key]} placeholder={f.hint} onChange={e => setA({ ...a, [f.key]: e.target.value })} />
            )}
          </label>
        ))}
      </div>
      <div className="aa-tools">
        <input ref={importRef} type="file" accept=".json" hidden onChange={e => { void importResults(e.target.files?.[0]); e.target.value = ''; }} />
        <span className="jm-hint">For the apply script:</span>
        <button className="btn btn-sm" onClick={() => void exportData()}>Export for applying</button>
        <button className="btn btn-sm" onClick={() => importRef.current?.click()}>Import results</button>
      </div>
      <div className="jm-line end">
        <button className="btn btn-sm" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn btn-sm btn-primary" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save answers'}</button>
      </div>
    </div>
  );
}

// Copy-ready answers for the job you have open.
export function AnswerChips() {
  const { toast } = useFeedback();
  const [a, setA] = useState<Answers | null>(null);
  useEffect(() => { fetch('/api/answers').then(r => r.json()).then((d: { answers: Answers }) => setA(d.answers)).catch(() => { /* none */ }); }, []);
  if (!a) return null;
  const filled = ANSWER_FIELDS.filter(f => a[f.key] && !f.long);
  if (!filled.length) return null;
  return (
    <div className="aa-chips" aria-label="Your answers, click to copy">
      {filled.map(f => (
        <button key={f.key} className="aa-chip" title={`Copy ${f.label.toLowerCase()}`}
          onClick={() => { void navigator.clipboard.writeText(a[f.key]); toast(`${f.label} copied`); }}>
          <span>{f.label}</span>{a[f.key]}
        </button>
      ))}
    </div>
  );
}
