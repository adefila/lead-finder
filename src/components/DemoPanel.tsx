'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, LayoutTemplate, RefreshCw, Trash2 } from 'lucide-react';
import type { Lead } from '@/types/lead';
import { useFeedback } from '@/components/feedback';

interface State { status: 'draft' | 'approved' | null; look: string | null; url: string | null; hasWebsite: boolean; source?: string | null }
const LOOK: Record<string, string> = { modern: 'Modern', console: 'Console', blueprint: 'Blueprint' };

// In a lead's page: build a website demo from their own site, look at it, and approve it. Only an approved demo
// replaces the one-page note in the email.
export function DemoPanel({ lead, onUpdate }: { lead: Lead; onUpdate: (patch: Partial<Lead>) => void }) {
  const { toast, confirm } = useFeedback();
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState<'' | 'build' | 'approve' | 'remove'>('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/demo?id=${encodeURIComponent(lead.id)}`);
      if (res.ok) setState(await res.json() as State);
    } catch { /* leave empty */ }
  }, [lead.id]);
  useEffect(() => { void load(); }, [load]);

  const setLinks = (demo: 'draft' | 'approved' | undefined, look?: string) => {
    const links = { ...lead.contactLinks };
    if (demo) { links.demo = demo; if (look) links.demoLook = look; } else { delete links.demo; delete links.demoLook; }
    onUpdate({ contactLinks: links });
  };

  const build = async () => {
    setBusy('build');
    try {
      const res = await fetch('/api/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: lead.id }) });
      const data = await res.json() as { status?: 'draft'; look?: string; url?: string; error?: string };
      if (!res.ok || !data.url) { toast(data.error ?? 'Could not build the demo', { tone: 'error' }); return; }
      setState({ status: 'draft', look: data.look ?? null, url: data.url, hasWebsite: true });
      setLinks('draft', data.look);
      toast('Demo built. Open it and check it before you approve', { tone: 'success' });
    } catch { toast('Could not build the demo', { tone: 'error' }); }
    finally { setBusy(''); }
  };

  const approve = async (yes: boolean) => {
    setBusy('approve');
    try {
      const res = await fetch('/api/demo', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: lead.id, approve: yes }) });
      if (!res.ok) { toast('Could not save that', { tone: 'error' }); return; }
      setState(s => (s ? { ...s, status: yes ? 'approved' : 'draft' } : s));
      setLinks(yes ? 'approved' : 'draft');
      toast(yes ? 'Approved. Their email will link to this demo' : 'Taken back to a draft. Their email links to the note again', { tone: 'success' });
    } finally { setBusy(''); }
  };

  const remove = async () => {
    if (!await confirm({ title: 'Remove this demo?', body: 'The email goes back to linking the one-page note.', confirmLabel: 'Remove', danger: true })) return;
    setBusy('remove');
    try {
      await fetch('/api/demo', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: lead.id }) });
      setState(s => (s ? { ...s, status: null, url: null, look: null } : s));
      setLinks(undefined);
    } finally { setBusy(''); }
  };

  if (!state) return null;
  const working = busy !== '';
  return (
    <section className="dsec">
      <h3 className="dsec-title"><LayoutTemplate size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Website demo</h3>
      {!state.status ? (
        <>
          <p className="check-hint"><span>Built automatically before the email goes out. You can also build one now: it reads their site, or writes a generic concept when they have none. It takes about half a minute.</span></p>
          <div className="actions">
            <button className="btn btn-primary" onClick={() => void build()} disabled={working}><LayoutTemplate size={14} />{busy === 'build' ? 'Reading their site and building…' : 'Create demo'}</button>
          </div>
        </>
      ) : (
        <>
          <p className="check-hint"><span>
            {state.status === 'approved' ? 'Approved: their email links to this demo instead of the note.' : 'A draft. Look at it, then approve it to use it in their email.'}
            {state.look ? ` Look: ${LOOK[state.look] ?? state.look}.` : ''}
            {state.source === 'generic' ? ' Built from the business name only (no readable site), so the text is generic.' : ''}
          </span></p>
          <div className="actions">
            {state.url && <a className="btn" href={state.url} target="_blank" rel="noreferrer"><ExternalLink size={14} />Open demo</a>}
            {state.status === 'draft'
              ? <button className="btn btn-primary" onClick={() => void approve(true)} disabled={working}><Check size={14} />Approve for the email</button>
              : <button className="btn" onClick={() => void approve(false)} disabled={working}>Use the note instead</button>}
            <button className="btn btn-quiet" onClick={() => void build()} disabled={working}><RefreshCw size={14} />{busy === 'build' ? 'Building…' : 'Rebuild'}</button>
            <button className="btn btn-quiet" onClick={() => void remove()} disabled={working}><Trash2 size={14} />Remove</button>
          </div>
        </>
      )}
    </section>
  );
}
