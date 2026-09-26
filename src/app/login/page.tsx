'use client';

import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { EASE } from '@/components/ui';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password) { setError('Enter your password'); return; }
    setBusy(true);
    setError('');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    if (res?.ok) {
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
      return;
    }
    const data = res ? await res.json().catch(() => ({})) as { error?: string } : { error: 'Network error, try again' };
    setError(data.error ?? "That password isn't right");
    setBusy(false);
  }

  return (
    <main className="login-wrap">
      <motion.form className="login-card" onSubmit={submit}
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
        <div className="brand login-brand">Lead Finder</div>
        <label>
          <span className="field-label">Password</span>
          <input className="field" type="password" autoFocus autoComplete="current-password" value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }} aria-invalid={!!error} />
        </label>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button className="btn btn-primary login-btn" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Log in'}</button>
      </motion.form>
    </main>
  );
}
