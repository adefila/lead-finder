'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AnimatePresence, MotionConfig } from 'motion/react';
import type { Lead, LeadStatus } from '@/types/lead';
import {
  SOURCE_LABEL, STATUS_LABEL, SUBS, VIEWS, defaultSort, displayName, inView, matchesSearch, needsEmail, needsEmailDraft, sortLeads, statusOf,
  type SortKey, type Sub, type View,
} from '@/lib/leadview';
import { needsAttention } from '@/lib/followup';
import { Funnel } from '@/components/Funnel';
import { History } from '@/components/History';
import { HowItWorks, useHowItWorks } from '@/components/HowItWorks';
import { LeadTable } from '@/components/LeadTable';
import { LeadDrawer } from '@/components/LeadDrawer';
import { Btn, Dropdown, Icon, Menu } from '@/components/ui';
import { useFeedback } from '@/components/feedback';
import { EmailHuntBanner, HUNT_STEP, type EmailHunt } from '@/components/EmailHunt';

type RunResult = { success?: boolean; stats?: Record<string, number>; durationMs?: number; error?: string };
type RunSummary = { found: number; withEmail: number; error?: string };
type OutboxStatus = { configured: boolean; sentToday: number; limit: number; sentWeek?: number; weekLimit?: number; queued: number; lastSent?: string | null };

// "Fri 2 Oct, 15:10" in your own time zone.
function lastSentLabel(iso?: string | null): string {
  if (!iso) return 'nothing sent yet';
  return `last sent ${new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
}
type OutboxRun = OutboxStatus & { replies?: number; optOuts?: number; sent?: { title: string; kind: string }; skipped?: string; error?: string };

const PAGE_SIZE = 15;

// Page indexes to show, with null for a gap: 0 … 4 5 6 … 11
function pageNumbers(current: number, count: number): (number | null)[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);
  const set = new Set([0, count - 1, current - 1, current, current + 1].filter(n => n >= 0 && n < count));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push(null);
    out.push(n);
  });
  return out;
}

export default function Home() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('new');
  const [sub, setSub] = useState<Sub>('all');
  const [mode, setMode] = useState<'table' | 'history'>('table');
  const [source, setSource] = useState<Lead['source'] | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sortOverride, setSortOverride] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const cardRef = useRef<HTMLElement>(null);
  const [running, setRunning] = useState(false);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [outbox, setOutbox] = useState<OutboxStatus | null>(null);
  const [sendingNow, setSendingNow] = useState(false);
  const [hunt, setHunt] = useState<EmailHunt | null>(null);
  const stopHunt = useRef(false);
  const findingEmails = !!hunt && !hunt.done;
  const how = useHowItWorks();
  const { toast, confirm } = useFeedback();
  const notify = useCallback((text: string, action?: { label: string; run: () => void }) => toast(text, { action }), [toast]);
  const fail = useCallback((text: string) => toast(text, { tone: 'error' }), [toast]);

  const loadData = useCallback(async (): Promise<Lead[]> => {
    let list: Lead[] = [];
    try {
      const res = await fetch('/api/leads');
      list = await res.json() as Lead[];
    } catch { /* keep empty */ }
    setLeads(list);
    setLoading(false);
    return list;
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Finding leads takes a couple of minutes; afterwards, say in one sentence what changed.
  async function runNow() {
    setRunning(true);
    setRunSummary(null);
    const before = new Set(leads.map(l => l.id));
    try {
      const res = await fetch('/api/cron');
      const data = await res.json() as RunResult;
      if (!data.success) {
        setRunSummary({ found: 0, withEmail: 0, error: data.error ?? 'Something went wrong while looking for leads.' });
      } else {
        const fresh = (await loadData()).filter(l => !before.has(l.id));
        setRunSummary({ found: fresh.length, withEmail: fresh.filter(l => l.contactEmail).length });
      }
    } catch {
      setRunSummary({ found: 0, withEmail: 0, error: 'Could not reach the server. Check your connection and try again.' });
    }
    setRunning(false);
  }

  async function reset() {
    const ok = await confirm({
      title: 'Start over?',
      body: 'This permanently deletes every lead, including people you have contacted and projects you have won. It cannot be undone.',
      confirmLabel: 'Delete everything',
      danger: true,
      typeToConfirm: 'delete',
    });
    if (!ok) return;
    const res = await fetch('/api/clear-stale');
    const data = await res.json() as { leadsDeleted?: number; error?: string };
    if (data.error) fail(`Could not delete: ${data.error}`); else toast(`Deleted ${data.leadsDeleted ?? 0} leads`, { tone: 'success' });
    await loadData();
  }

  // Looks for an email for every lead without one; leads still without one move to Skipped.
  // Works a few leads at a time so the banner can show who is being checked and what was found.
  async function findEmails() {
    const todo = leads.filter(needsEmail)
      // Leads with a website first: they need no Google Maps lookup.
      .sort((a, b) => Number(!a.contactLinks?.website) - Number(!b.contactLinks?.website));
    // Leads that already have an email but still carry a DM-style message.
    const rewrite = leads.filter(needsEmailDraft);
    if (!todo.length && !rewrite.length) { toast('Every lead you can email has an address and an email message', { tone: 'success' }); return; }
    const ok = await confirm({
      title: todo.length ? `Find emails for ${todo.length} leads?` : `Rewrite ${rewrite.length} messages as emails?`,
      body: [
        todo.length ? 'We read each business website and contact page, or look the business up on Google Maps to find its site. Leads with no working email move to Skipped, and you can bring any of them back.' : '',
        rewrite.length ? `${rewrite.length} lead${rewrite.length === 1 ? ' has' : 's have'} an email but a message written for a DM or LinkedIn. We rewrite ${rewrite.length === 1 ? 'it' : 'them'} as proper emails.` : '',
        'You can keep working while it runs.',
      ].filter(Boolean).join(' '),
      confirmLabel: 'Find emails',
    });
    if (!ok) return;
    stopHunt.current = false;
    let lookups = 300;
    let state: EmailHunt = { total: todo.length, checked: 0, found: 0, skipped: 0, current: [], recent: [], done: false, phase: todo.length ? 'find' : 'write', writeTotal: rewrite.length, written: 0 };
    const show = (next: Partial<EmailHunt>) => { state = { ...state, ...next }; setHunt(state); };
    show({});
    try {
      for (let i = 0; i < todo.length && !stopHunt.current; i += HUNT_STEP) {
        const batch = todo.slice(i, i + HUNT_STEP);
        show({ current: batch.map(displayName) });
        const res = await fetch('/api/find-emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ maxLookups: lookups, ids: batch.map(l => l.id) }),
        });
        const data = await res.json().catch(() => ({ error: res.statusText })) as {
          found?: number; skipped?: number; lookups?: number; results?: { id: string; name: string; email: string | null }[]; error?: string;
        };
        if (!res.ok || data.error) { show({ error: `Stopped: ${data.error ?? res.statusText}. Run it again to pick up where it stopped.` }); break; }
        lookups = Math.max(0, lookups - (data.lookups ?? 0));
        const results = data.results ?? [];
        // Update the table straight away: found emails appear, skipped leads leave the list.
        const byId = new Map(results.map(r => [r.id, r.email]));
        setLeads(prev => prev.map(l => !byId.has(l.id) ? l
          : byId.get(l.id) ? { ...l, contactEmail: byId.get(l.id)! } : { ...l, status: 'skipped' }));
        show({
          checked: state.checked + batch.length,
          found: state.found + (data.found ?? 0),
          skipped: state.skipped + (data.skipped ?? 0),
          recent: [...results.map(r => ({ name: r.name, email: r.email })), ...state.recent].slice(0, 4),
        });
      }
      // Then rewrite the old DM-style messages of leads that already had an email.
      if (!stopHunt.current && !state.error && rewrite.length) {
        show({ phase: 'write' });
        for (let i = 0; i < rewrite.length && !stopHunt.current; i += 4) {
          const batch = rewrite.slice(i, i + 4);
          show({ current: batch.map(displayName) });
          const res = await fetch('/api/find-emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rewrite: true, ids: batch.map(l => l.id) }),
          });
          const data = await res.json().catch(() => ({ error: res.statusText })) as {
            rewritten?: number; results?: { id: string; name: string; ok: boolean; proposal?: string }[]; error?: string;
          };
          if (!res.ok || data.error) { show({ error: `Stopped: ${data.error ?? res.statusText}. Run it again to pick up where it stopped.` }); break; }
          const fresh = new Map((data.results ?? []).filter(r => r.ok && r.proposal).map(r => [r.id, r.proposal!]));
          setLeads(prev => prev.map(l => (fresh.has(l.id) ? { ...l, proposal: fresh.get(l.id) } : l)));
          show({
            written: (state.written ?? 0) + batch.length,
            rewritten: (state.rewritten ?? 0) + (data.rewritten ?? 0),
            recent: [...(data.results ?? []).map(r => ({ name: r.name, email: r.ok ? 'Rewritten as an email' : null, note: r.ok ? undefined : 'Could not rewrite, open it and click Write a new version' })), ...state.recent].slice(0, 4),
          });
        }
      }
    } catch {
      show({ error: 'Lost the connection. Run it again to pick up where it stopped.' });
    } finally {
      show({ done: true, current: [] });
      await loadData();
    }
  }

  async function patch(id: string, payload: Record<string, unknown>, optimistic: (l: Lead) => Lead): Promise<boolean> {
    const original = leads.find(l => l.id === id);
    setLeads(prev => prev.map(l => (l.id === id ? optimistic(l) : l)));
    const res = await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...payload }),
    }).catch(() => null);
    if (res?.ok) return true;
    if (original) setLeads(prev => prev.map(l => (l.id === id ? original : l)));
    const { error } = res
      ? await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
      : { error: 'network error, check your connection' };
    fail(`Could not update ${original?.title ?? 'the lead'}: ${error}`);
    return false;
  }

  const setStatus = (id: string, status: LeadStatus, quiet = false) => {
    const previous = leads.find(l => l.id === id);
    const wasNew = previous && statusOf(previous) === 'new';
    return patch(id, { status }, l => ({
      ...l,
      status,
      ...(status === 'approved' ? { contactedAt: new Date().toISOString(), followUps: 0 } : {}),
      ...(status === 'new' ? { contactedAt: undefined, followUps: 0, queuedAt: undefined, autoSequence: false, sendError: undefined } : {}),
      ...(status === 'queued' ? { queuedAt: new Date().toISOString(), autoSequence: true, sendError: undefined } : {}),
    })).then(ok => {
      if (ok && !quiet && wasNew && status === 'approved') notify(`${previous!.title} moved to Waiting for reply`, { label: 'Undo', run: () => setStatus(id, 'new') });
      if (ok && !quiet && wasNew && status === 'queued') notify(`${previous!.title} scheduled. It goes out on the next weekday morning.`, { label: 'Undo', run: () => setStatus(id, 'new') });
      if (ok && (status === 'queued' || previous?.status === 'queued')) refreshOutbox();
      return ok;
    });
  };

  const queueWithDraft = (id: string, draft: string) => {
    const previous = leads.find(l => l.id === id);
    const already = previous?.status === 'queued';
    return patch(id, { status: 'queued', proposal: draft }, l => ({
      ...l, status: 'queued', proposal: draft, queuedAt: l.queuedAt ?? new Date().toISOString(), autoSequence: true, sendError: undefined,
    })).then(ok => {
      if (ok) {
        toast(already ? 'Changes saved' : `${previous?.title ?? 'Lead'} scheduled. It goes out on the next weekday morning.`, already ? { tone: 'success' } : { action: { label: 'Undo', run: () => setStatus(id, 'new') } });
        refreshOutbox();
      }
      return ok;
    });
  };

  const refreshOutbox = useCallback(async () => {
    const s = await fetch('/api/outbox/status').then(r => (r.ok ? r.json() as Promise<OutboxStatus> : null)).catch(() => null);
    if (s) setOutbox(s);
  }, []);

  useEffect(() => { refreshOutbox(); }, [refreshOutbox]);

  async function logOut() {
    await fetch('/api/login', { method: 'DELETE' }).catch(() => null);
    window.location.href = '/login';
  }

  async function sendNextNow() {
    setSendingNow(true);
    try {
      const res = await fetch('/api/outbox');
      const r = await res.json() as OutboxRun;
      if (r.error) fail(`Could not send: ${r.error}`);
      else if (r.sent) toast(r.sent.kind === 'test' ? `Test email for ${r.sent.title} sent to your inbox` : `Sent ${r.sent.kind === 'follow-up' ? 'a follow-up to' : 'your email to'} ${r.sent.title}`, { tone: 'success' });
      else toast(r.skipped === 'Nothing due inside business hours right now' ? 'Nothing to send right now. Emails only go out on weekdays between 9am and 4pm their time.' : r.skipped ?? 'Nothing to send right now');
      if (r.replies) toast(`${r.replies} repl${r.replies > 1 ? 'ies' : 'y'} found in your inbox`, { tone: 'success' });
      await Promise.all([loadData(), refreshOutbox()]);
    } finally {
      setSendingNow(false);
    }
  }

  const followedUp = (id: string) => patch(id, { action: 'followed_up' }, l => ({
    ...l,
    followUps: (l.followUps ?? 0) + 1,
    contactedAt: new Date().toISOString(),
  }));

  async function removeLeads(ids: string[]) {
    const names = leads.filter(l => ids.includes(l.id)).map(l => l.title);
    const what = ids.length === 1 ? `"${names[0]}"` : `${ids.length} leads`;
    const ok = await confirm({
      title: `Delete ${what}?`,
      body: "This can't be undone, and they won't come back in future runs.",
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return false;

    const res = await fetch('/api/leads', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
      fail(`Could not delete: ${error}`);
      return false;
    }
    setLeads(prev => prev.filter(l => !ids.includes(l.id)));
    setSelection(prev => new Set([...prev].filter(id => !ids.includes(id))));
    toast(`Deleted ${what}`, { tone: 'success' });
    return true;
  }

  async function bulkStatus(ids: string[], status: LeadStatus) {
    const before = new Map(leads.filter(l => ids.includes(l.id)).map(l => [l.id, statusOf(l)]));
    setSelection(new Set());
    const results = await Promise.all(ids.map(id => setStatus(id, status, true)));
    const done = ids.filter((_, i) => results[i]);
    if (!done.length) return;
    const verb = { approved: 'moved to Waiting for reply', queued: 'scheduled', skipped: 'skipped', new: 'moved back to To contact' }[status as string] ?? 'updated';
    notify(`${done.length} lead${done.length > 1 ? 's' : ''} ${verb}`, {
      label: 'Undo',
      run: () => done.forEach(id => setStatus(id, before.get(id) ?? 'new', true)),
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
  const followUpsDue = useMemo(() => scoped.filter(needsAttention).length, [scoped]);
  // Scheduled emails or automatic follow-ups that failed to send, newest first.
  const sendFailures = useMemo(() => leads
    .filter(l => l.sendError && (statusOf(l) === 'queued' || (statusOf(l) === 'approved' && !l.autoSequence)))
    .sort((a, b) => (b.queuedAt ?? b.contactedAt ?? '').localeCompare(a.queuedAt ?? a.contactedAt ?? '')), [leads]);
  const sort = sortOverride ?? defaultSort(view);
  const rows = useMemo(() => sortLeads(scoped.filter(l => inView(l, view, sub)), sort.key, sort.dir), [scoped, view, sub, sort.key, sort.dir]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(() => rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE), [rows, currentPage]);

  const selectedIndex = rows.findIndex(l => l.id === selectedId);

  // Keep the page in step with the drawer when it moves to a lead on another page.
  useEffect(() => {
    if (selectedIndex >= 0) setPage(Math.floor(selectedIndex / PAGE_SIZE));
  }, [selectedIndex]);

  const selected = leads.find(l => l.id === selectedId) ?? null;

  function onSort(key: SortKey) {
    setPage(0);
    setSortOverride(s => (s?.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'name' || key === 'next' ? 1 : -1 }));
  }

  // On a narrow screen the tab strip scrolls sideways: keep the selected tab fully visible.
  useEffect(() => {
    const strip = cardRef.current?.querySelector<HTMLElement>('.tabs');
    const active = strip?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!strip || !active) return;
    const pad = 16;
    const left = active.offsetLeft - strip.offsetLeft;
    const right = left + active.offsetWidth;
    if (left - pad < strip.scrollLeft) strip.scrollTo({ left: Math.max(0, left - pad), behavior: 'smooth' });
    else if (right + pad * 2 > strip.scrollLeft + strip.clientWidth) strip.scrollTo({ left: right + pad * 2 - strip.clientWidth, behavior: 'smooth' });
  }, [view, mode]);

  // If you have scrolled past the tabs, bring them back into view so a shorter list does not yank the page.
  function keepTabsInView() {
    const top = cardRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 72) window.scrollTo({ top: window.scrollY + top - 72 });
  }

  function changeView(v: View, s: Sub = 'all') {
    keepTabsInView();
    setView(v);
    setSub(s);
    setPage(0);
    setSortOverride(null);
    setMode('table');
    setSelection(new Set());
  }

  const picked = rows.filter(l => selection.has(l.id));
  const pickedOnPage = pageRows.filter(l => selection.has(l.id));
  const pickedIds = picked.map(l => l.id);

  function toggle(id: string) {
    setSelection(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelection(prev => {
      const next = new Set(prev);
      const allOnPage = pageRows.length > 0 && pickedOnPage.length === pageRows.length;
      for (const l of pageRows) { if (allOnPage) next.delete(l.id); else next.add(l.id); }
      return next;
    });
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
          <div className="brand">Lead Finder</div>
          <div className="topbar-actions">
            {outbox && (
              <span className={`send-status${outbox.configured ? '' : ' off'}`}
                title={outbox.configured
                  ? 'Scheduled emails go out from your inbox on weekdays between 9am and 4pm their time: spaced out through the day, up to 20 new emails a day and 100 a week. Follow-ups go out on top of that.'
                  : 'Automatic sending is off until your email login is added in Vercel.'}>
                <Icon name="clock" size={13} />
                {!outbox.configured ? 'Automatic sending is off'
                  : `${outbox.queued === 0 ? 'Nothing scheduled' : `${outbox.queued} scheduled`} · ${outbox.sentToday} of ${outbox.limit} new today${outbox.weekLimit ? `, ${outbox.sentWeek ?? 0} of ${outbox.weekLimit} this week` : ''} · ${lastSentLabel(outbox.lastSent)}`}
              </span>
            )}
            <Btn className="btn btn-sm btn-primary" onClick={runNow} disabled={running}>
              {running ? 'Looking for leads…' : 'Find new leads'}
            </Btn>
            <Menu
              label="More options"
              dark
              items={[
                ...(outbox?.configured ? [{ label: sendingNow ? 'Sending…' : 'Send the next email now', icon: 'send' as const, hint: 'Still only sends on weekdays, 9am to 4pm their time', onSelect: sendNextNow }] : []),
                { label: findingEmails ? 'Finding emails…' : 'Find missing emails', icon: 'mail', hint: 'Leads with no email move to Skipped', onSelect: () => { if (!findingEmails) findEmails(); } },
                { label: 'How it works', icon: 'help', onSelect: how.show },
                'divider',
                { label: 'Log out', icon: 'logout', onSelect: logOut },
                { label: 'Start over', icon: 'trash', hint: 'Deletes every lead', danger: true, onSelect: reset },
              ]}
            />
          </div>
        </div>
      </header>

      <main className="page">
        {how.open && <HowItWorks onClose={how.hide} />}

        {hunt && <EmailHuntBanner hunt={hunt} onStop={() => { stopHunt.current = true; }} onClose={() => setHunt(null)} onShowSkipped={() => { changeView('done'); setHunt(null); }} />}

        {running && (
          <div className="banner info" role="status">
            <span className="spinner" aria-hidden />
            Looking for businesses that need a website. This usually takes 2 to 3 minutes, so you can keep working.
          </div>
        )}
        {runSummary && !running && (
          <div className={`banner${runSummary.error ? ' error' : ''}`} role="status">
            <span>
              {runSummary.error
                ? runSummary.error
                : runSummary.found === 0
                  ? 'No new businesses this time. We will look again tomorrow.'
                  : <>Found <strong>{runSummary.found} new lead{runSummary.found === 1 ? '' : 's'}</strong>.
                    {' '}{runSummary.withEmail
                      ? `${runSummary.withEmail} ${runSummary.withEmail === 1 ? 'has an email and is' : 'have an email and are'} ready to schedule.`
                      : 'None have an email, so you would call or message them.'}</>}
            </span>
            {runSummary.found > 0 && !runSummary.error && (
              <button className="link-btn plain" onClick={() => { changeView('new'); setRunSummary(null); }}>Show them</button>
            )}
            <button className="banner-close" onClick={() => setRunSummary(null)} aria-label="Dismiss"><Icon name="x" size={12} /></button>
          </div>
        )}

        {sendFailures.length > 0 && (
          <div className="banner error" role="status">
            <span>
              <strong>{sendFailures.length} email{sendFailures.length === 1 ? '' : 's'} could not be sent.</strong>
              {' '}Latest reason: {sendFailures[0].sendError}
            </span>
            <button className="link-btn plain" onClick={() => { changeView(sendFailures.some(l => statusOf(l) === 'queued') ? 'queued' : 'approved'); setSearch(''); }}>
              Show them
            </button>
          </div>
        )}

        <Funnel leads={scoped} />

        <section className="crm-card" ref={cardRef}>
          <div className="crm-toolbar">
            <div className="tabs" role="tablist">
              {VIEWS.map(v => (
                <button key={v.id} className="tab" role="tab" aria-selected={mode === 'table' && view === v.id} title={v.hint}
                  onClick={() => changeView(v.id)}>
                  {v.label}
                  <span className="tab-count">{counts[v.id]}</span>
                  {v.id === 'approved' && followUpsDue > 0 && <span className="tab-alert" title={`${followUpsDue} need a follow-up`}>{followUpsDue}</span>}
                </button>
              ))}
            </div>
            <div className="view-head">
              <h2 className="view-title">
                {mode === 'history' ? 'By day' : VIEWS.find(v => v.id === view)?.label}
                {mode === 'table' && sub !== 'all' && <span className="muted"> · {SUBS[view]?.find(s => s.id === sub)?.label}</span>}
              </h2>
              <p className="view-hint">
                {mode === 'history' ? 'Leads grouped by the day they were found.'
                  : sub === 'followup' ? 'No reply yet and a follow-up is due. Send it, or close the lead.'
                  : sub === 'opened' ? 'They opened your one-page note but have not replied. Your warmest leads: a personal follow-up works well here.'
                  : sub === 'won' ? 'Projects you closed.'
                  : sub === 'lost' ? 'Leads that said no, or never replied.'
                  : sub === 'skipped' ? 'Leads you passed on. Bring any back with one click.'
                  : VIEWS.find(v => v.id === view)?.hint}
              </p>
            </div>
            {mode === 'table' && SUBS[view] && (
              <div className="subtabs" role="group" aria-label="Filter">
                {SUBS[view]!.map(s => (
                  <button key={s.id} aria-pressed={sub === s.id} onClick={() => { keepTabsInView(); setSub(s.id); setPage(0); setSelection(new Set()); }}>
                    {s.label}
                    {s.id === 'followup' && followUpsDue > 0 && <span className="tab-alert">{followUpsDue}</span>}
                  </button>
                ))}
              </div>
            )}
            <div className="crm-filters">
              <label className="search">
                <Icon name="search" />
                <input placeholder="Search by business, person or email" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
              </label>
              {sources.length > 1 && (
                <Dropdown<Lead['source'] | 'all'>
                  label="Found on"
                  value={source}
                  onChange={v => { setSource(v); setPage(0); setSelection(new Set()); }}
                  options={[
                    { value: 'all', label: 'Found anywhere', count: leads.length },
                    ...sources.map(s => ({ value: s, label: SOURCE_LABEL[s], count: leads.filter(l => l.source === s).length })),
                  ]}
                />
              )}
              <div className="seg" role="group" aria-label="Layout">
                <button aria-pressed={mode === 'table'} onClick={() => setMode('table')}>List</button>
                <button aria-pressed={mode === 'history'} onClick={() => setMode('history')} title="Leads grouped by the day they were found">By day</button>
              </div>
            </div>
          </div>

          {mode === 'table' && picked.length > 0 && (
              <div className="bulk-bar">
                <div className="bulk-inner">
                  <strong>{picked.length} selected</strong>
                  <button className="link-btn plain" onClick={() => setSelection(new Set())}>Clear</button>
                  <span className="spacer" />
                  {picked.some(l => statusOf(l) === 'new' && l.contactEmail) && (
                    <Btn className="btn btn-sm btn-primary" title="Send these automatically on weekdays, during their business hours"
                      onClick={() => bulkStatus(picked.filter(l => statusOf(l) === 'new' && l.contactEmail).map(l => l.id), 'queued')}>
                      <Icon name="clock" />Schedule {picked.filter(l => statusOf(l) === 'new' && l.contactEmail).length} email{picked.filter(l => statusOf(l) === 'new' && l.contactEmail).length === 1 ? '' : 's'}
                    </Btn>
                  )}
                  {picked.some(l => statusOf(l) === 'new') && (
                    <>
                      <Btn className="btn btn-sm" title="You contacted them yourself" onClick={() => bulkStatus(picked.filter(l => statusOf(l) === 'new').map(l => l.id), 'approved')}>
                        I contacted these
                      </Btn>
                      <Btn className="btn btn-sm" onClick={() => bulkStatus(picked.filter(l => statusOf(l) === 'new').map(l => l.id), 'skipped')}>
                        Skip
                      </Btn>
                    </>
                  )}
                  {picked.some(l => ['skipped', 'lost'].includes(statusOf(l))) && (
                    <Btn className="btn btn-sm" onClick={() => bulkStatus(picked.filter(l => ['skipped', 'lost'].includes(statusOf(l))).map(l => l.id), 'new')}>
                      <Icon name="undo" />Bring back
                    </Btn>
                  )}
                  <Btn className="btn btn-sm btn-danger" onClick={() => removeLeads(pickedIds)}>
                    <Icon name="trash" />Delete {picked.length}
                  </Btn>
                </div>
              </div>
            )}

          {loading ? (
            <div className="empty">Loading leads…</div>
          ) : mode === 'history' ? (
            <History leads={scoped} onOpen={id => setSelectedId(id)} />
          ) : (
            <LeadTable
              leads={pageRows}
              sort={sort}
              onSort={onSort}
              selectedId={selectedId}
              onOpen={setSelectedId}
              onStatus={setStatus}
              emptyKind={search.trim() ? 'search' : sub !== 'all' ? sub : view}
              selection={selection}
              onToggle={toggle}
              onToggleAll={toggleAll}
            />
          )}
          {!loading && mode === 'table' && rows.length > 0 && (
            <div className="crm-foot">
              <span>
                {rows.length > PAGE_SIZE
                  ? `${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, rows.length)} of ${rows.length} leads`
                  : `${rows.length} lead${rows.length === 1 ? '' : 's'}`}
              </span>
              {followUpsDue > 0 && sub !== 'followup' && (
                <button className="link-btn" onClick={() => changeView('approved', 'followup')}>{followUpsDue} {followUpsDue > 1 ? 'people need' : 'person needs'} a follow-up</button>
              )}
              {pageCount > 1 && (
                <nav className="pager" aria-label="Pagination">
                  <button className="icon-btn" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0} aria-label="Previous page">
                    <Icon name="arrowLeft" size={14} />
                  </button>
                  {pageNumbers(currentPage, pageCount).map((n, i) => n === null
                    ? <span key={`gap-${i}`} className="pager-gap">…</span>
                    : (
                      <button key={n} className={`pager-num${n === currentPage ? ' active' : ''}`} onClick={() => setPage(n)}
                        aria-label={`Page ${n + 1}`} aria-current={n === currentPage ? 'page' : undefined}>
                        {n + 1}
                      </button>
                    ))}
                  <button className="icon-btn" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount - 1} aria-label="Next page">
                    <Icon name="arrowRight" size={14} />
                  </button>
                </nav>
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
            onStatus={s => actAndAdvance(selected.id, () => setStatus(selected.id, s), !inView({ ...selected, status: s }, view, sub))}
            onFollowedUp={() => actAndAdvance(selected.id, () => followedUp(selected.id), sub === 'followup')}
            onUpdate={p => setLeads(prev => prev.map(l => (l.id === selected.id ? { ...l, ...p } : l)))}
            onQueue={draft => queueWithDraft(selected.id, draft)}
            onDelete={() => {
              const idx = rows.findIndex(l => l.id === selected.id);
              const nextId = rows[idx + 1]?.id ?? rows[idx - 1]?.id ?? null;
              removeLeads([selected.id]).then(ok => { if (ok) setSelectedId(nextId); });
            }}
          />
        )}
      </AnimatePresence>


    </MotionConfig>
  );
}
