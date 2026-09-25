'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import type { Lead, LeadStatus } from '@/types/lead';
import {
  SOURCE_LABEL, STATUS_LABEL, VIEWS, defaultSort, inView, matchesSearch, relativeTime, sortLeads, statusOf,
  type SortKey, type View,
} from '@/lib/leadview';
import { Funnel } from '@/components/Funnel';
import { History } from '@/components/History';
import { LeadTable } from '@/components/LeadTable';
import { LeadDrawer } from '@/components/LeadDrawer';
import { Btn, Dropdown, Icon } from '@/components/ui';

type RunResult = { success?: boolean; stats?: Record<string, number>; durationMs?: number; error?: string };
type GmailStatus = { configured: boolean; connected: boolean; email?: string | null; lastSync?: string | null };
type SyncResult = { connected: boolean; contacted: number; followUps: number; replied: number; error?: string };

const EMPTY_TEXT: Record<View, string> = {
  new: 'Click Run now to find new leads.',
  approved: 'Leads you contact show up here.',
  followup: 'Nothing due. Follow-ups appear 3 days after you contact someone.',
  replied: 'Leads that reply show up here.',
  won: 'Projects you win show up here.',
  lost: 'Leads you close as lost show up here.',
  skipped: 'Leads you skip show up here. You can restore them anytime.',
  all: 'No leads yet. Click Run now.',
};

function humanKey(k: string): string {
  return k.replace(/([A-Z])/g, ' $1').toLowerCase();
}

export default function Home() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('new');
  const [mode, setMode] = useState<'table' | 'history'>('table');
  const [source, setSource] = useState<Lead['source'] | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sortOverride, setSortOverride] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [gmail, setGmail] = useState<GmailStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ text: string; action?: { label: string; run: () => void } } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const notify = useCallback((text: string, action?: { label: string; run: () => void }) => {
    setToast({ text, action });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), action ? 6000 : 4500);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/leads');
      setLeads(await res.json() as Lead[]);
    } catch { setLeads([]); }
    setLoading(false);
  }, []);

  const syncGmail = useCallback(async (quiet: boolean) => {
    setSyncing(true);
    try {
      const res = await fetch('/api/gmail', { method: 'POST' });
      const r = await res.json() as SyncResult;
      if (r.error) { notify(`Gmail sync failed: ${r.error}`); return; }
      const changed = r.contacted + r.followUps + r.replied;
      if (changed) {
        await loadData();
        const parts = [
          r.contacted && `${r.contacted} moved to Contacted`,
          r.followUps && `${r.followUps} follow-up${r.followUps > 1 ? 's' : ''} logged`,
          r.replied && `${r.replied} repl${r.replied > 1 ? 'ies' : 'y'} found`,
        ].filter(Boolean);
        notify(`Gmail: ${parts.join(', ')}`);
      } else if (!quiet) {
        notify('Gmail is up to date');
      }
      setGmail(g => (g ? { ...g, lastSync: new Date().toISOString() } : g));
    } finally {
      setSyncing(false);
    }
  }, [loadData, notify]);

  useEffect(() => {
    (async () => {
      await loadData();
      const params = new URLSearchParams(window.location.search);
      if (params.get('gmail') === 'connected') notify('Gmail connected. Checking your sent mail…');
      if (params.get('gmail') === 'error') notify(`Gmail not connected: ${params.get('reason') ?? 'unknown error'}`);
      if (params.has('gmail')) window.history.replaceState(null, '', '/');

      const status = await fetch('/api/gmail').then(r => r.json() as Promise<GmailStatus>).catch(() => null);
      setGmail(status);
      if (status?.connected) syncGmail(params.get('gmail') !== 'connected');
    })();
  }, [loadData, notify, syncGmail]);

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
    notify(data.error ? `Error: ${data.error}` : `Deleted ${data.leadsDeleted ?? 0} leads`);
    await loadData();
  }

  async function patch(id: string, payload: Record<string, unknown>, optimistic: (l: Lead) => Lead) {
    let before: Lead[] = [];
    setLeads(prev => { before = prev; return prev.map(l => (l.id === id ? optimistic(l) : l)); });
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

  const setStatus = (id: string, status: LeadStatus, quiet = false) => {
    const previous = leads.find(l => l.id === id);
    if (!quiet && status === 'approved' && previous && statusOf(previous) === 'new') {
      notify(`${previous.title} marked as contacted`, { label: 'Undo', run: () => setStatus(id, 'new') });
    }
    return patch(id, { status }, l => ({
      ...l,
      status,
      ...(status === 'approved' ? { contactedAt: new Date().toISOString(), followUps: 0 } : {}),
      ...(status === 'new' ? { contactedAt: undefined, followUps: 0 } : {}),
    }));
  };

  const followedUp = (id: string) => patch(id, { action: 'followed_up' }, l => ({
    ...l,
    followUps: (l.followUps ?? 0) + 1,
    contactedAt: new Date().toISOString(),
  }));

  async function removeLeads(ids: string[]) {
    const names = leads.filter(l => ids.includes(l.id)).map(l => l.title);
    const what = ids.length === 1 ? `"${names[0]}"` : `${ids.length} leads`;
    if (!confirm(`Delete ${what}? This can't be undone, and they won't come back in future runs.`)) return false;

    const res = await fetch('/api/leads', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
      alert(`Could not delete: ${error}`);
      return false;
    }
    setLeads(prev => prev.filter(l => !ids.includes(l.id)));
    setSelection(prev => new Set([...prev].filter(id => !ids.includes(id))));
    notify(`Deleted ${what}`);
    return true;
  }

  function bulkStatus(ids: string[], status: LeadStatus) {
    const before = new Map(leads.filter(l => ids.includes(l.id)).map(l => [l.id, statusOf(l)]));
    for (const id of ids) setStatus(id, status, true);
    setSelection(new Set());
    const verb = { approved: 'marked as sent', skipped: 'skipped', new: 'restored' }[status as string] ?? 'updated';
    notify(`${ids.length} lead${ids.length > 1 ? 's' : ''} ${verb}`, {
      label: 'Undo',
      run: () => before.forEach((s, id) => setStatus(id, s, true)),
    });
  }

  // ── Derived lists ────────────────────────────────────────────────────────────
  const sources = useMemo(() => [...new Set(leads.map(l => l.source))], [leads]);
  const scoped = useMemo(
    () => leads.filter(l => (source === 'all' || l.source === source) && matchesSearch(l, search.trim())),
    [leads, source, search],
  );
  const counts = useMemo(() => {
    const c = {} as Record<View, number>;
    for (const v of VIEWS) c[v.id] = scoped.filter(l => inView(l, v.id)).length;
    return c;
  }, [scoped]);
  const sort = sortOverride ?? defaultSort(view);
  const rows = useMemo(() => sortLeads(scoped.filter(l => inView(l, view)), sort.key, sort.dir), [scoped, view, sort.key, sort.dir]);

  const selectedIndex = rows.findIndex(l => l.id === selectedId);
  const selected = leads.find(l => l.id === selectedId) ?? null;

  function onSort(key: SortKey) {
    setSortOverride(s => (s?.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'name' || key === 'next' ? 1 : -1 }));
  }

  function changeView(v: View) {
    setView(v);
    setSortOverride(null);
    setMode('table');
    setSelection(new Set());
  }

  const picked = rows.filter(l => selection.has(l.id));
  const pickedIds = picked.map(l => l.id);

  function toggle(id: string) {
    setSelection(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelection(picked.length === rows.length ? new Set() : new Set(rows.map(l => l.id)));
  }

  // After acting on a lead in the drawer, move to the next lead in the list.
  function actAndAdvance(id: string, act: () => void, leavesView: boolean) {
    const idx = rows.findIndex(l => l.id === id);
    const nextId = rows[idx + 1]?.id ?? rows[idx - 1]?.id ?? null;
    act();
    if (leavesView) setSelectedId(nextId);
  }

  return (
    <MotionConfig reducedMotion="user">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand"><span className="brand-dot" />Lead Finder</div>
          <div className="topbar-actions">
            {gmail?.connected ? (
              <button className="gmail-chip" onClick={() => syncGmail(false)} disabled={syncing} title={`Connected as ${gmail.email ?? ''}`}>
                <motion.span style={{ display: 'grid' }} animate={{ rotate: syncing ? 360 : 0 }}
                  transition={syncing ? { repeat: Infinity, duration: 0.9, ease: 'linear' } : { duration: 0 }}>
                  <Icon name="sync" size={13} />
                </motion.span>
                {syncing ? 'Syncing Gmail…' : `Gmail synced ${relativeTime(gmail.lastSync) || 'never'}`}
              </button>
            ) : null}
            <Btn className="btn btn-sm btn-ghost-dark" onClick={reset}>Reset</Btn>
            <Btn className="btn btn-sm btn-primary" onClick={runNow} disabled={running}>{running ? 'Running…' : 'Run now'}</Btn>
          </div>
        </div>
      </header>

      <main className="page">
        <AnimatePresence>
          {runResult && (
            <motion.div className={`banner${runResult.success ? '' : ' error'}`}
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <strong>{runResult.success ? 'Run complete' : 'Run failed'}</strong>
              {runResult.stats && Object.entries(runResult.stats).map(([k, v]) => (
                <span key={k}><strong>{v}</strong> {humanKey(k)}</span>
              ))}
              {runResult.durationMs && <span>{(runResult.durationMs / 1000).toFixed(0)}s</span>}
              {runResult.error && <span>{runResult.error}</span>}
              <button className="banner-close" onClick={() => setRunResult(null)} aria-label="Dismiss"><Icon name="x" size={12} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        <Funnel leads={scoped} />

        <section className="crm-card">
          <div className="crm-toolbar">
            <div className="tabs" role="tablist">
              {VIEWS.map(v => (
                <button key={v.id} className="tab" role="tab" aria-selected={mode === 'table' && view === v.id} onClick={() => changeView(v.id)}>
                  {mode === 'table' && view === v.id && (
                    <motion.span layoutId="tab-bg" className="tab-bg" transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }} />
                  )}
                  <span className="tab-label">
                    {v.label}
                    <span className={`tab-count${v.id === 'followup' && counts.followup ? ' alert' : ''}`}>{counts[v.id]}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="crm-filters">
              <label className="search">
                <Icon name="search" />
                <input placeholder="Search name, company, email" value={search} onChange={e => setSearch(e.target.value)} />
              </label>
              {sources.length > 1 && (
                <Dropdown<Lead['source'] | 'all'>
                  label="Source"
                  value={source}
                  onChange={v => { setSource(v); setSelection(new Set()); }}
                  options={[
                    { value: 'all', label: 'All sources', count: leads.length },
                    ...sources.map(s => ({ value: s, label: SOURCE_LABEL[s], count: leads.filter(l => l.source === s).length })),
                  ]}
                />
              )}
              <div className="seg" role="group" aria-label="Layout">
                <button aria-pressed={mode === 'table'} onClick={() => setMode('table')}>Table</button>
                <button aria-pressed={mode === 'history'} onClick={() => setMode('history')}>By day</button>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {mode === 'table' && picked.length > 0 && (
              <motion.div className="bulk-bar" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                <div className="bulk-inner">
                  <strong>{picked.length} selected</strong>
                  <button className="link-btn plain" onClick={() => setSelection(new Set())}>Clear</button>
                  <span className="spacer" />
                  {picked.some(l => statusOf(l) === 'new') && (
                    <>
                      <Btn className="btn btn-sm" onClick={() => bulkStatus(picked.filter(l => statusOf(l) === 'new').map(l => l.id), 'approved')}>
                        <Icon name="check" />Mark as sent
                      </Btn>
                      <Btn className="btn btn-sm" onClick={() => bulkStatus(picked.filter(l => statusOf(l) === 'new').map(l => l.id), 'skipped')}>
                        <Icon name="x" />Skip
                      </Btn>
                    </>
                  )}
                  {picked.some(l => ['skipped', 'lost'].includes(statusOf(l))) && (
                    <Btn className="btn btn-sm" onClick={() => bulkStatus(picked.filter(l => ['skipped', 'lost'].includes(statusOf(l))).map(l => l.id), 'new')}>
                      <Icon name="undo" />Restore
                    </Btn>
                  )}
                  <Btn className="btn btn-sm btn-danger" onClick={() => removeLeads(pickedIds)}>
                    <Icon name="trash" />Delete {picked.length}
                  </Btn>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="empty">Loading leads…</div>
          ) : mode === 'history' ? (
            <History leads={scoped} onOpen={id => setSelectedId(id)} />
          ) : (
            <LeadTable
              leads={rows}
              sort={sort}
              onSort={onSort}
              selectedId={selectedId}
              onOpen={setSelectedId}
              onStatus={setStatus}
              emptyText={search ? 'No leads match your search.' : EMPTY_TEXT[view]}
              selection={selection}
              onToggle={toggle}
              onToggleAll={toggleAll}
            />
          )}
          {!loading && mode === 'table' && rows.length > 0 && (
            <div className="crm-foot">
              {rows.length} lead{rows.length === 1 ? '' : 's'}
              {counts.followup > 0 && view !== 'followup' && (
                <button className="link-btn" onClick={() => changeView('followup')}>{counts.followup} follow-up{counts.followup > 1 ? 's' : ''} due</button>
              )}
            </div>
          )}
        </section>
      </main>

      <AnimatePresence>
        {selected && (
          <LeadDrawer
            key="drawer"
            lead={selected}
            position={selectedIndex >= 0 ? `${selectedIndex + 1} of ${rows.length}` : STATUS_LABEL[statusOf(selected)]}
            onClose={() => setSelectedId(null)}
            onPrev={selectedIndex > 0 ? () => setSelectedId(rows[selectedIndex - 1].id) : undefined}
            onNext={selectedIndex >= 0 && selectedIndex < rows.length - 1 ? () => setSelectedId(rows[selectedIndex + 1].id) : undefined}
            onStatus={s => actAndAdvance(selected.id, () => setStatus(selected.id, s), !inView({ ...selected, status: s }, view))}
            onFollowedUp={() => actAndAdvance(selected.id, () => followedUp(selected.id), view === 'followup')}
            onUpdate={p => setLeads(prev => prev.map(l => (l.id === selected.id ? { ...l, ...p } : l)))}
            onDelete={() => {
              const idx = rows.findIndex(l => l.id === selected.id);
              const nextId = rows[idx + 1]?.id ?? rows[idx - 1]?.id ?? null;
              removeLeads([selected.id]).then(ok => { if (ok) setSelectedId(nextId); });
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div className="toast" role="status"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}>
            {toast.text}
            {toast.action && (
              <button className="toast-action" onClick={() => { toast.action!.run(); setToast(null); }}>{toast.action.label}</button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </MotionConfig>
  );
}
