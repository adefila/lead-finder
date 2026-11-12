'use client';

import { useEffect, useState } from 'react';
import { useFeedback } from '@/components/feedback';
import { ANSWER_FIELDS, EMPTY_ANSWERS, type Answers } from '@/lib/answers';

// The form behind "apply for me": filled once, used for every application.
export function ApplyAnswers({ onClose }: { onClose: () => void }) {
  const { toast } = useFeedback();
  const [a, setA] = useState<Answers>(EMPTY_ANSWERS);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

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
