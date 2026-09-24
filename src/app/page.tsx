'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Lead } from '@/types/lead';
import type { Post } from '@/types/post';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE_LABEL: Record<Lead['source'], string> = {
  upwork: 'Upwork',
  remoteok: 'RemoteOK',
  remotive: 'Remotive',
  weworkremotely: 'We Work Remotely',
  apollo: 'Apollo',
};

const SOURCE_COLOR: Record<Lead['source'], string> = {
  upwork: '#14a800',
  remoteok: '#00c853',
  remotive: '#6d28d9',
  weworkremotely: '#0288d1',
  apollo: '#0f0f0f',
};

function scoreColor(s: number) {
  if (s >= 80) return { bg: 'rgba(0,171,74,0.12)', fg: 'rgb(0,140,60)' };
  if (s >= 60) return { bg: 'rgba(109,40,217,0.1)', fg: '#6d28d9' };
  return { bg: 'rgba(0,0,0,0.06)', fg: '#545c68' };
}

function copied(setCopied: (v: boolean) => void) {
  setCopied(true);
  setTimeout(() => setCopied(false), 1500);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const { bg, fg } = scoreColor(score);
  return (
    <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', background: bg, color: fg, letterSpacing: '0.3px' }}>
      {score}
    </span>
  );
}

function LeadCard({ lead, onApprove, onSkip }: {
  lead: Lead;
  onApprove: () => void;
  onSkip: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(lead.proposal ?? '');
  const [wasCopied, setWasCopied] = useState(false);

  const isApollo = lead.source === 'apollo' && !!lead.contactEmail;

  const lines = draft.split('\n');
  const subjectLine = lines.find(l => l.startsWith('Subject:')) ?? '';
  const subject = subjectLine.replace('Subject:', '').trim();
  const body = lines.filter(l => !l.startsWith('Subject:')).join('\n').replace(/^\n+/, '');

  // For Apollo leads: clicking "Send" opens Gmail/mail client with draft pre-filled
  const mailtoHref = isApollo && lead.contactEmail
    ? `mailto:${lead.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body || draft)}`
    : null;

  return (
    <div style={{ borderBottom: '1px solid var(--border)', background: open ? '#fafafa' : 'var(--white)' }}>
      {/* Header row */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', cursor: 'pointer', userSelect: 'none' }}
      >
        <ScoreBadge score={lead.score ?? 0} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {isApollo ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {lead.contactName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {lead.contactTitle} · {lead.company}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {lead.company}
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {lead.title}
              </div>
            </>
          )}
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
          color: '#fff', background: SOURCE_COLOR[lead.source], padding: '2px 7px', flexShrink: 0,
        }}>
          {SOURCE_LABEL[lead.source]}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', flexShrink: 0, letterSpacing: '0.3px' }}>
          {open ? 'Close' : 'View'}
        </span>
      </div>

      {open && (
        <div style={{ padding: '0 20px 16px' }}>
          {/* Apollo: show email if available, otherwise prompt to find manually */}
          {isApollo && (
            <div style={{ marginBottom: 10, padding: '8px 12px', background: lead.contactEmail ? 'rgba(0,171,74,0.06)' : 'rgba(0,0,0,0.03)', border: `1px solid ${lead.contactEmail ? 'rgba(0,171,74,0.15)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {lead.contactEmail ? (
                <>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'rgb(0,140,60)' }}>Email</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', fontFamily: 'monospace' }}>{lead.contactEmail}</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--fg-muted)' }}>Email locked</span>
                  <span style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>Find on LinkedIn or Apollo dashboard</span>
                </>
              )}
            </div>
          )}

          {/* Description */}
          <p style={{ fontSize: 12, color: 'var(--fg-secondary)', lineHeight: 1.6, marginBottom: 12, borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
            {lead.description.slice(0, 220)}{lead.description.length > 220 ? '…' : ''}
          </p>

          {/* Email draft */}
          {draft ? (
            <div style={{ marginBottom: 12 }}>
              {subject && (
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-secondary)', marginBottom: 6, letterSpacing: '0.5px' }}>
                  SUBJECT: <span style={{ fontWeight: 500 }}>{subject}</span>
                </div>
              )}
              <textarea
                value={body || draft}
                onChange={e => setDraft(e.target.value)}
                rows={6}
                style={{
                  width: '100%', fontSize: 12, lineHeight: 1.65, color: 'var(--fg)', background: 'var(--bg)',
                  border: '1px solid var(--border)', padding: '10px 12px', resize: 'vertical',
                  fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 12 }}>No draft generated.</div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {lead.url && (
              <a href={lead.url} target="_blank" rel="noreferrer"
                style={{ fontSize: 12, color: 'var(--fg-secondary)', textDecoration: 'underline', marginRight: 4 }}>
                {isApollo ? 'View website' : 'View post'}
              </a>
            )}
            {draft && !isApollo && (
              <button
                onClick={() => { navigator.clipboard.writeText(draft); copied(setWasCopied); }}
                style={{ fontSize: 11, fontWeight: 600, padding: '5px 12px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg-secondary)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              >
                {wasCopied ? 'Copied' : 'Copy email'}
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button
              onClick={onSkip}
              style={{ fontSize: 11, fontWeight: 600, padding: '5px 14px', background: 'none', border: '1px solid var(--border)', color: 'var(--fg-muted)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              Skip
            </button>
            {isApollo && mailtoHref ? (
              <a
                href={mailtoHref}
                onClick={onApprove}
                style={{ fontSize: 11, fontWeight: 700, padding: '5px 16px', background: 'var(--accent-green)', color: '#fff', textDecoration: 'none', fontFamily: 'Inter, sans-serif', letterSpacing: '0.3px', display: 'inline-block' }}
              >
                Send Email
              </a>
            ) : isApollo ? (
              <a
                href="https://app.apollo.io/#/people"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 11, fontWeight: 700, padding: '5px 16px', background: 'var(--fg-secondary)', color: '#fff', textDecoration: 'none', fontFamily: 'Inter, sans-serif', letterSpacing: '0.3px', display: 'inline-block' }}
              >
                Find Email
              </a>
            ) : (
              <button
                onClick={onApprove}
                style={{ fontSize: 11, fontWeight: 700, padding: '5px 16px', background: 'var(--dark-bg)', border: 'none', color: '#fff', cursor: 'pointer', fontFamily: 'Inter, sans-serif', letterSpacing: '0.3px' }}
              >
                Approve
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PostCard({ post, onDone }: { post: Post; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState(post.replyDraft ?? '');
  const [wasCopied, setWasCopied] = useState(false);

  const platformColor = post.platform === 'reddit' ? '#ff4500' : '#f60';
  const platformLabel = post.platform === 'reddit' ? 'Reddit' : 'HN';

  return (
    <div style={{ borderBottom: '1px solid var(--border)', background: open ? '#fafafa' : 'var(--white)' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px', cursor: 'pointer', userSelect: 'none' }}
      >
        <ScoreBadge score={post.score ?? 0} />
        <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', background: platformColor, color: '#fff', flexShrink: 0 }}>
          {platformLabel}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {post.title}
          </div>
          {post.author && (
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 1 }}>u/{post.author}</div>
          )}
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', flexShrink: 0, letterSpacing: '0.3px' }}>{open ? 'Close' : 'View'}</span>
      </div>

      {open && (
        <div style={{ padding: '0 18px 14px' }}>
          <p style={{ fontSize: 12, color: 'var(--fg-secondary)', lineHeight: 1.6, marginBottom: 12, borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
            {post.snippet.slice(0, 280)}{post.snippet.length > 280 ? '…' : ''}
          </p>

          {reply && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-secondary)', marginBottom: 6, letterSpacing: '0.5px' }}>REPLY DRAFT</div>
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                rows={4}
                style={{
                  width: '100%', fontSize: 12, lineHeight: 1.65, color: 'var(--fg)', background: 'var(--bg)',
                  border: '1px solid var(--border)', padding: '10px 12px', resize: 'vertical',
                  fontFamily: 'Inter, sans-serif', outline: 'none',
                }}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <a href={post.url} target="_blank" rel="noreferrer"
              style={{ fontSize: 12, color: 'var(--fg-secondary)', textDecoration: 'underline', marginRight: 4 }}>
              Open post
            </a>
            {reply && (
              <button
                onClick={() => { navigator.clipboard.writeText(reply); copied(setWasCopied); }}
                style={{ fontSize: 11, fontWeight: 600, padding: '5px 12px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg-secondary)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              >
                {wasCopied ? 'Copied' : 'Copy reply'}
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button
              onClick={onDone}
              style={{ fontSize: 11, fontWeight: 700, padding: '5px 16px', background: 'var(--dark-bg)', border: 'none', color: '#fff', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

type RunResult = { success?: boolean; stats?: Record<string, number>; durationMs?: number; error?: string };

export default function Home() {
  const [tab, setTab] = useState<'leads' | 'posts'>('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [runResult, setRunResult] = useState<RunResult | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [l, p] = await Promise.all([
      fetch('/api/leads').then(r => r.json()) as Promise<Lead[]>,
      fetch('/api/posts').then(r => r.json()) as Promise<Post[]>,
    ]).catch(() => [[], []]);
    setLeads(l);
    setPosts(p);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function runNow() {
    setRunStatus('running');
    setRunResult(null);
    try {
      const res = await fetch('/api/cron', { headers: { 'x-manual': 'true' } });
      const data = await res.json() as RunResult;
      setRunResult(data);
      setRunStatus(data.success ? 'done' : 'error');
      if (data.success) await loadData();
    } catch (e) {
      setRunResult({ error: String(e) });
      setRunStatus('error');
    }
  }

  async function approveLead(id: string) {
    await fetch('/api/leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'approved' }) });
    setLeads(prev => prev.filter(l => l.id !== id));
  }

  async function skipLead(id: string) {
    await fetch('/api/leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'skipped' }) });
    setLeads(prev => prev.filter(l => l.id !== id));
  }

  async function donePost(id: string) {
    await fetch('/api/posts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'done' }) });
    setPosts(prev => prev.filter(p => p.id !== id));
  }

  const newLeads = leads.filter(l => l.status === 'new');
  const approvedLeads = leads.filter(l => l.status === 'approved');
  const newPosts = posts.filter(p => p.status === 'new' || p.status === 'open');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Topbar */}
      <header style={{
        background: 'var(--dark-bg)', height: 52, padding: '0 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>Lead Finder</span>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase', background: 'var(--accent-green)', color: '#fff', padding: '2px 7px' }}>CRM</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Runs daily at 7am + 6pm UTC</span>
          <button
            onClick={runNow}
            disabled={runStatus === 'running'}
            style={{
              fontSize: 12, fontWeight: 700, padding: '6px 16px',
              background: runStatus === 'running' ? 'rgba(255,255,255,0.15)' : 'var(--accent-green)',
              color: '#fff', border: 'none', cursor: runStatus === 'running' ? 'not-allowed' : 'pointer',
              fontFamily: 'Inter, sans-serif', letterSpacing: '0.3px',
            }}
          >
            {runStatus === 'running' ? 'Running…' : 'Run Now'}
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px 80px' }}>

        {/* Run result banner */}
        {runResult && runStatus !== 'idle' && runStatus !== 'running' && (
          <div style={{
            marginBottom: 20, padding: '12px 18px',
            background: runStatus === 'done' ? 'rgba(0,171,74,0.08)' : 'rgba(220,38,38,0.08)',
            border: `1px solid ${runStatus === 'done' ? 'rgba(0,171,74,0.2)' : 'rgba(220,38,38,0.2)'}`,
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: runStatus === 'done' ? 'var(--accent-green)' : '#dc2626' }}>
              {runStatus === 'done' ? 'Run complete' : 'Run failed'}
            </span>
            {runResult.stats && Object.entries(runResult.stats).map(([k, v]) => (
              <span key={k} style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>
                <strong>{v}</strong> {k}
              </span>
            ))}
            {runResult.durationMs && (
              <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{(runResult.durationMs / 1000).toFixed(1)}s</span>
            )}
            {runResult.error && <span style={{ fontSize: 12, color: '#dc2626' }}>{runResult.error}</span>}
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.06)', marginBottom: 24 }}>
          {[
            { label: 'New Leads', value: newLeads.length, hint: 'awaiting review' },
            { label: 'Approved', value: approvedLeads.length, hint: 'will reach out' },
            { label: 'Posts to Reply', value: newPosts.length, hint: 'Reddit + HN' },
            { label: 'Total Active', value: leads.length + posts.length, hint: 'in pipeline' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--white)', padding: '20px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--fg)', letterSpacing: '-0.8px', lineHeight: 1, marginBottom: 4 }}>
                {loading ? '—' : s.value}
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{s.hint}</div>
            </div>
          ))}
        </div>

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

          {/* Left — Email Leads */}
          <div style={{ border: '1px solid var(--border)', background: 'var(--white)' }}>
            <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 3 }}>Email Leads</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--fg)' }}>
                  {loading ? '—' : newLeads.length} waiting
                  {approvedLeads.length > 0 && <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--accent-green)', marginLeft: 8 }}>{approvedLeads.length} approved</span>}
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--fg-muted)', maxWidth: 160, textAlign: 'right', lineHeight: 1.5 }}>
                Apollo contacts + job boards — scored by AI
              </p>
            </div>

            <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>Loading leads…</div>
              ) : newLeads.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: 'var(--fg-secondary)', fontWeight: 600 }}>No new leads</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4 }}>Run the cron to fetch new leads</div>
                </div>
              ) : (
                newLeads.map(lead => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onApprove={() => approveLead(lead.id)}
                    onSkip={() => skipLead(lead.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right — Posts to Reply */}
          <div style={{ border: '1px solid var(--border)', background: 'var(--white)' }}>
            <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 3 }}>Posts to Reply</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--fg)' }}>
                  {loading ? '—' : newPosts.length} posts
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--fg-muted)', maxWidth: 160, textAlign: 'right', lineHeight: 1.5 }}>
                Reddit + HN — founders asking for web/Framer help
              </p>
            </div>

            <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>Loading posts…</div>
              ) : newPosts.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: 'var(--fg-secondary)', fontWeight: 600 }}>No posts yet</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4 }}>Run the cron to fetch posts from Reddit + HN</div>
                </div>
              ) : (
                newPosts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onDone={() => donePost(post.id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Tab — Approved leads */}
        {approvedLeads.length > 0 && (
          <div style={{ marginTop: 20, border: '1px solid var(--border)', background: 'var(--white)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--accent-green)', marginBottom: 2 }}>Approved Leads</div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{approvedLeads.length} leads you plan to reach out to</div>
            </div>
            {approvedLeads.map(lead => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onApprove={() => {}}
                onSkip={() => skipLead(lead.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
