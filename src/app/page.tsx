'use client';

import { useState } from 'react';

export default function Home() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  async function triggerManual() {
    setStatus('loading');
    setResult(null);
    try {
      const res = await fetch('/api/cron', {
        method: 'GET',
        headers: { 'x-manual': 'true' },
      });
      const data = await res.json() as Record<string, unknown>;
      setResult(data);
      setStatus(res.ok ? 'success' : 'error');
    } catch (e) {
      setResult({ error: String(e) });
      setStatus('error');
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: 480, width: '100%', background: '#fff', borderRadius: 16, padding: '40px 36px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
        <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800, color: '#111827' }}>Lead Finder</h1>
        <p style={{ margin: '0 0 6px', color: '#6b7280', fontSize: 15 }}>
          Daily Framer job leads for Samuel Adefila
        </p>
        <p style={{ margin: '0 0 32px', color: '#9ca3af', fontSize: 13 }}>
          Next automatic send: daily at <strong>7am UTC</strong> via Vercel Cron
        </p>

        <div style={{ background: '#f9fafb', borderRadius: 10, padding: '16px 20px', marginBottom: 28, textAlign: 'left' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 10 }}>Sources</div>
          {[
            { name: 'Upwork RSS', desc: 'framer developer, figma to framer, web designer framer' },
            { name: 'RemoteOK API', desc: 'design tag, filtered for Framer/web' },
            { name: 'Remotive API', desc: 'framer + web designer searches' },
            { name: 'We Work Remotely', desc: 'remote design jobs RSS' },
          ].map(s => (
            <div key={s.name} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={{ width: 8, height: 8, background: '#14a800', borderRadius: '50%', marginTop: 5, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{s.name}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={triggerManual}
          disabled={status === 'loading'}
          style={{
            width: '100%',
            padding: '13px 0',
            background: status === 'loading' ? '#6b7280' : '#111827',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 700,
            cursor: status === 'loading' ? 'not-allowed' : 'pointer',
            letterSpacing: 0.2,
            marginBottom: 16,
            transition: 'background 0.15s',
          }}
        >
          {status === 'loading' ? '⏳ Running… (this takes ~30–60s)' : '▶ Trigger Manual Run'}
        </button>

        {status !== 'idle' && status !== 'loading' && result && (
          <div style={{
            background: status === 'success' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${status === 'success' ? '#bbf7d0' : '#fecaca'}`,
            borderRadius: 10,
            padding: '14px 16px',
            textAlign: 'left',
          }}>
            <div style={{ fontWeight: 700, color: status === 'success' ? '#15803d' : '#dc2626', marginBottom: 8, fontSize: 14 }}>
              {status === 'success' ? '✓ Run complete' : '✗ Run failed'}
            </div>
            <pre style={{ margin: 0, fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}
