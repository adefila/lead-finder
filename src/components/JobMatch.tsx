'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, FileText, Link2, Trash2, Sparkles } from 'lucide-react';
import { useFeedback } from '@/components/feedback';
import { ApplyAnswers } from '@/components/ApplyAnswers';

interface ProfileInfo { skills: string[]; titles: string[]; years: number | null; source: string; updatedAt: string; chars: number }

// Upload your CV or portfolio once, then run a check: every job below gets a match score against it. Free, no AI.
export function JobMatch({ onChecked }: { onChecked: () => void }) {
  const { toast, confirm } = useFeedback();
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<'' | 'upload' | 'check'>('');
  const [open, setOpen] = useState(false);
  const [answersOpen, setAnswersOpen] = useState(false);
  const [link, setLink] = useState('');
  const [pasted, setPasted] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/profile');
      const data = await res.json() as { profile: ProfileInfo | null };
      setProfile(data.profile);
    } catch { /* leave empty */ }
    setReady(true);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const check = useCallback(async () => {
    setBusy('check');
    try {
      const res = await fetch('/api/jobs/check', { method: 'POST' });
      const data = await res.json() as { checked?: number; strong?: number; failed?: number; added?: number; restored?: number; limited?: number; error?: string };
      if (!res.ok) { toast(data.error ?? 'Could not run the check', { tone: 'error' }); return; }
      onChecked();
      const found = (data.added ?? 0) + (data.restored ?? 0);
      if (data.failed) toast(`${data.failed} jobs could not be saved`, { tone: 'error' });
      else toast((found ? `${found} job${found === 1 ? '' : 's'} added that match you` : 'No new matches right now. Check again tomorrow') + (data.limited ? `. ${data.limited} limited to another country were skipped` : ''), { tone: found ? 'success' : 'default' });
    } catch { toast('Could not run the check', { tone: 'error' }); }
    finally { setBusy(''); }
  }, [onChecked, toast]);

  const send = useCallback(async (init: RequestInit) => {
    setBusy('upload');
    try {
      const res = await fetch('/api/profile', init);
      const data = await res.json() as { profile?: ProfileInfo; error?: string };
      if (!res.ok || !data.profile) { toast(data.error ?? 'Could not read that', { tone: 'error' }); setBusy(''); return; }
      setProfile(data.profile); setOpen(false); setLink(''); setPasted('');
      toast(`Read ${data.profile.skills.length} skills from your profile`, { tone: 'success' });
      await check();
    } catch { toast('Could not read that', { tone: 'error' }); setBusy(''); }
  }, [check, toast]);

  const upload = (file: File | undefined) => {
    if (!file) return;
    const form = new FormData(); form.append('file', file);
    void send({ method: 'POST', body: form });
  };
  const postJson = (body: object) => void send({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  const remove = async () => {
    if (!await confirm({ title: 'Remove your profile?', body: 'Jobs keep their last score, but no new ones are matched until you upload again.', confirmLabel: 'Remove', danger: true })) return;
    await fetch('/api/profile', { method: 'DELETE' });
    setProfile(null);
  };

  if (!ready) return null;
  const working = busy !== '';

  return (
    <div className="jm">
      <input ref={fileRef} type="file" hidden accept=".pdf,.docx,.txt,.md,.html" onChange={e => { upload(e.target.files?.[0]); e.target.value = ''; }} />
      {profile && !open ? (
        <div className="jm-row">
          <div className="jm-main">
            <div className="jm-title"><FileText size={14} />Matched to <strong>{profile.source}</strong></div>
            <div className="jm-skills">
              {profile.skills.slice(0, 8).map(s => <span key={s} className="jm-chip">{s}</span>)}
              {profile.skills.length > 8 && <span className="jm-more">+{profile.skills.length - 8} more</span>}
              {profile.years !== null && <span className="jm-more">about {profile.years} years</span>}
            </div>
          </div>
          <div className="jm-actions">
            <button className="btn btn-sm btn-primary" onClick={() => void check()} disabled={working}><Sparkles size={13} />{busy === 'check' ? 'Searching job boards…' : 'Find jobs for me'}</button>
            <button className="btn btn-sm" onClick={() => setAnswersOpen(v => !v)} aria-expanded={answersOpen}>Application answers</button>
            <button className="btn btn-sm" onClick={() => setOpen(true)} disabled={working}>Replace</button>
            <button className="icon-btn" onClick={() => void remove()} disabled={working} aria-label="Remove my profile" title="Remove my profile"><Trash2 size={14} /></button>
          </div>
        </div>
      ) : (
        <div className="jm-row">
          <div className="jm-main">
            <div className="jm-title"><Sparkles size={14} />Match jobs to you</div>
            <p className="jm-hint">Upload your CV to find and score jobs that fit you. Free, and the file is not kept.</p>
            {open && (
              <div className="jm-form">
                <div className="jm-line">
                  <Link2 size={14} />
                  <input value={link} onChange={e => setLink(e.target.value)} placeholder="Or paste your portfolio link, https://…" aria-label="Portfolio link" />
                  <button className="btn btn-sm" disabled={working || !link.trim()} onClick={() => postJson({ url: link })}>Read link</button>
                </div>
                <textarea value={pasted} onChange={e => setPasted(e.target.value)} placeholder="Or paste the text of your CV here" aria-label="CV text" rows={4} />
                <div className="jm-line end">
                  {profile && <button className="btn btn-sm" onClick={() => setOpen(false)}>Cancel</button>}
                  <button className="btn btn-sm" disabled={working || pasted.trim().length < 80} onClick={() => postJson({ text: pasted })}>Use this text</button>
                </div>
              </div>
            )}
          </div>
          <div className="jm-actions">
            <button className="btn btn-sm btn-primary" onClick={() => fileRef.current?.click()} disabled={working}><Upload size={13} />{busy === 'upload' ? 'Reading…' : 'Upload CV'}</button>
            {!open && <button className="btn btn-sm" onClick={() => setOpen(true)} disabled={working}>Link or paste</button>}
          </div>
        </div>
      )}
      {answersOpen && <ApplyAnswers onClose={() => setAnswersOpen(false)} />}
    </div>
  );
}
