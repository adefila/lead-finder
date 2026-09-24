'use client';

import { useState } from 'react';

const SOURCES = [
  { name: 'Upwork RSS', desc: 'framer developer · figma to framer · web designer framer', color: '#14a800' },
  { name: 'RemoteOK API', desc: 'design tag · filtered for Framer / web', color: '#00c853' },
  { name: 'Remotive API', desc: 'framer + web designer searches', color: '#6d28d9' },
  { name: 'We Work Remotely', desc: 'remote design jobs RSS', color: '#0288d1' },
];

type RunResult = {
  success?: boolean;
  stats?: { fetched?: number; fresh?: number; scored?: number; sent?: number };
  durationMs?: number;
  error?: string;
  [key: string]: unknown;
};

export default function Home() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<RunResult | null>(null);

  async function triggerManual() {
    setStatus('loading');
    setResult(null);
    try {
      const res = await fetch('/api/cron', {
        method: 'GET',
        headers: { 'x-manual': 'true' },
      });
      const data = await res.json() as RunResult;
      setResult(data);
      setStatus(res.ok ? 'success' : 'error');
    } catch (e) {
      setResult({ error: String(e) });
      setStatus('error');
    }
  }

  const stats = result?.stats;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Top bar */}
      <header style={{
        background: 'var(--dark-bg)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 32px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px', fontFamily: 'Inter, sans-serif' }}>
            Lead Finder
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
            background: 'var(--accent-green)', color: '#fff',
            padding: '2px 8px',
          }}>
            Live
          </span>
        </div>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, sans-serif' }}>
          Samuel Adefila · adefilasamuel929@gmail.com
        </span>
      </header>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Page title row */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 36, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--fg-secondary)', marginBottom: 6 }}>
              CRM Dashboard
            </p>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--fg)', letterSpacing: '-0.6px', lineHeight: 1.2 }}>
              Framer Job Leads
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--fg-muted)', fontSize: 13 }}>
            <span style={{ width: 7, height: 7, background: 'var(--accent-green)', borderRadius: '50%', display: 'inline-block' }} />
            Auto-sends daily at <strong style={{ color: 'var(--fg-secondary)' }}>7am UTC</strong>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', marginBottom: 24 }}>
          {[
            { label: 'Fetched', value: stats?.fetched ?? '—', sub: 'from all sources' },
            { label: 'Fresh', value: stats?.fresh ?? '—', sub: 'not seen before' },
            { label: 'Scored', value: stats?.scored ?? '—', sub: 'passed AI filter' },
            { label: 'Sent', value: stats?.sent ?? '—', sub: 'in your inbox' },
          ].map((s) => (
            <div key={s.label} style={{ background: 'var(--white)', padding: '24px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 10 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--fg)', lineHeight: 1, marginBottom: 6, letterSpacing: '-1px' }}>
                {s.value}
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>

          {/* Left — run control + result */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Run card */}
            <div style={{ background: 'var(--white)', border: '1px solid var(--border)', padding: '28px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 4 }}>
                    Manual Run
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--fg-secondary)', margin: 0 }}>
                    Fetch, score and email leads right now
                  </p>
                </div>
                <button
                  onClick={triggerManual}
                  disabled={status === 'loading'}
                  style={{
                    padding: '11px 28px',
                    background: status === 'loading' ? 'var(--fg-secondary)' : 'var(--dark-bg)',
                    color: '#fff',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: '0.4px',
                    cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                    transition: 'opacity 0.15s',
                    whiteSpace: 'nowrap',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {status === 'loading' ? '⏳ Running…' : '▶ Run Now'}
                </button>
              </div>

              {status === 'loading' && (
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--fg-secondary)', fontSize: 14 }}>
                    <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                    Fetching from 4 sources, scoring with Claude AI… (~30–60s)
                  </div>
                </div>
              )}

              {status !== 'idle' && status !== 'loading' && result && (
                <div style={{
                  background: status === 'success' ? 'rgba(0,171,74,0.05)' : 'rgba(220,38,38,0.05)',
                  border: `1px solid ${status === 'success' ? 'rgba(0,171,74,0.2)' : 'rgba(220,38,38,0.2)'}`,
                  padding: '18px 20px',
                }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700,
                    color: status === 'success' ? 'var(--accent-green)' : '#dc2626',
                    marginBottom: 12,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span>{status === 'success' ? '✓' : '✗'}</span>
                    {status === 'success' ? 'Run complete — leads sent to your inbox' : 'Run failed'}
                  </div>
                  {stats && (
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 12 }}>
                      {[
                        { label: 'Fetched', v: stats.fetched },
                        { label: 'Fresh', v: stats.fresh },
                        { label: 'Scored', v: stats.scored },
                        { label: 'Sent', v: stats.sent },
                      ].map(s => (
                        <div key={s.label}>
                          <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase' }}>{s.label}</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--fg)', letterSpacing: '-0.5px' }}>{s.v ?? '—'}</div>
                        </div>
                      ))}
                      {result.durationMs && (
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase' }}>Duration</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--fg)', letterSpacing: '-0.5px' }}>{(result.durationMs / 1000).toFixed(1)}s</div>
                        </div>
                      )}
                    </div>
                  )}
                  {result.error && (
                    <pre style={{ fontSize: 12, color: '#dc2626', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
                      {String(result.error)}
                    </pre>
                  )}
                </div>
              )}
            </div>

            {/* Cron schedule card */}
            <div style={{ background: 'var(--white)', border: '1px solid var(--border)', padding: '24px 28px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 16 }}>
                Schedule
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: 'var(--border)', border: '1px solid var(--border)' }}>
                {[
                  { label: 'Frequency', value: 'Daily' },
                  { label: 'Time', value: '7:00 AM UTC' },
                  { label: 'Platform', value: 'Vercel Cron' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--bg)', padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right — sources + pipeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Sources */}
            <div style={{ background: 'var(--white)', border: '1px solid var(--border)', padding: '24px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 16 }}>
                Sources
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {SOURCES.map((s, i) => (
                  <div key={s.name} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0',
                    borderBottom: i < SOURCES.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <span style={{ width: 8, height: 8, background: s.color, borderRadius: '50%', marginTop: 5, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)', marginBottom: 2 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--fg-muted)', lineHeight: 1.5 }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pipeline */}
            <div style={{ background: 'var(--white)', border: '1px solid var(--border)', padding: '24px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 16 }}>
                Pipeline
              </div>
              {[
                { step: '01', label: 'Fetch jobs', desc: 'Pull from 4 job boards via RSS + API' },
                { step: '02', label: 'Deduplicate', desc: 'Filter against Supabase sent_jobs log' },
                { step: '03', label: 'AI score', desc: 'Claude rates each lead 0–100 for relevance' },
                { step: '04', label: 'Filter ≥ 40', desc: 'Keep top 50 high-relevance leads' },
                { step: '05', label: 'Write proposals', desc: 'Claude drafts a personalised proposal' },
                { step: '06', label: 'Email digest', desc: 'Resend delivers to your inbox' },
              ].map((p, i) => (
                <div key={p.step} style={{
                  display: 'flex', gap: 12, paddingBottom: i < 5 ? 14 : 0,
                  marginBottom: i < 5 ? 14 : 0,
                  borderBottom: i < 5 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800, color: 'var(--fg-muted)',
                    letterSpacing: '0.5px', paddingTop: 2, flexShrink: 0, width: 20,
                  }}>
                    {p.step}
                  </span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)', marginBottom: 1 }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{p.desc}</div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
