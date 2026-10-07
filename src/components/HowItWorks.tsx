'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui';

const KEY = 'lf-how-it-works-hidden';

// Remembers per browser whether the explainer was dismissed. Storage can be blocked, so fail open.
export function useHowItWorks() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { setOpen(localStorage.getItem(KEY) !== '1'); } catch { setOpen(true); }
  }, []);
  const hide = useCallback(() => {
    setOpen(false);
    try { localStorage.setItem(KEY, '1'); } catch { /* storage blocked */ }
  }, []);
  const show = useCallback(() => {
    setOpen(true);
    try { localStorage.removeItem(KEY); } catch { /* storage blocked */ }
  }, []);
  return { open, hide, show };
}

const SCENE_MS = 8000;

const MESSAGE = 'Hi Dr. Okafor,\n\nMost practices like yours lose a few bookings a week to people who simply forget. A simple online booking with text reminders fixes that, and it runs on its own.\n\nI put together a short one-page note with a few ideas for you.\n\nSamuel Adefila';

// The message types itself out, the way it is written for each lead.
function TypedMessage() {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(MESSAGE.length); return; }
    const t = setInterval(() => setN(v => (v >= MESSAGE.length ? v : v + 2)), 28);
    return () => clearInterval(t);
  }, []);
  return <><span className="ex-typed">{MESSAGE.slice(0, n)}</span><span className="ex-cursor" /></>;
}

interface Scene { name: string; headline: string; body: string; facts: string[]; stage: ReactNode }

const SCENES: Scene[] = [
  {
    name: 'Find', headline: 'It finds businesses that need you',
    body: 'Twice a day it searches for businesses with a weak website and a published email, plus remote web roles and public website tenders open to you. It only keeps businesses that are still trading.',
    facts: ['Checks they are open, with recent reviews or an active register entry', 'Reads their website and notes what is wrong in plain words', 'Skips duplicates found in more than one place'],
    stage: (
      <>
        <div className="ex-sources">
          {[['Google Maps', 'Australia, Singapore'], ['Local map', 'OpenStreetMap'], ['Company register', 'new UK companies'], ['Job posts', 'Freelancer.com'], ['Remote roles', '4 job boards'], ['Tenders', 'EU and Australia']]
            .map(([t, s], i) => <div key={t} className="ex-source" style={{ animationDelay: `${0.1 + i * 0.25}s` }}>{t}<span>{s}</span></div>)}
        </div>
        <div className="ex-card">
          <div className="ex-row"><div className="ex-title">Harbour Dental Care</div><span className="ex-chip">Active</span></div>
          <div className="ex-sub"><span className="ex-flag">Outdated website</span>· Dentist · Leeds, UK</div>
          <div className="ex-sub">Open on Google · reviewed 2 weeks ago · hard to use on a phone · not secure</div>
        </div>
        <div className="ex-note"><b>8am &amp; 7pm UK</b> → check still open → check the website → keep the real prospects</div>
      </>
    ),
  },
  {
    name: 'Write', headline: 'It writes a personal message',
    body: 'Each lead is scored Strong, Good or Weak fit, then a short message is written that opens with a time-saving idea for their trade, not a hard sell.',
    facts: ['Finds the owner’s name when the website gives it', 'Links a private one-page note of ideas for them', 'Plain language, no jargon, a different opening each time'],
    stage: (
      <>
        <div className="ex-card">
          <div className="ex-row"><div className="ex-title">Harbour Dental Care</div><span className="ex-chip">Strong fit</span></div>
          <div className="ex-sub">What you can offer: online booking with text reminders</div>
        </div>
        <div className="ex-card ex-msg">
          <div className="ex-sub">Subject: fewer missed appointments</div>
          <TypedMessage />
        </div>
      </>
    ),
  },
  {
    name: 'Review', headline: 'You stay in control',
    body: 'Nothing goes out until you say so. Open a lead, read the message, change anything, then click Schedule. New companies get a LinkedIn note; job posts get an application.',
    facts: ['Tabs follow the pipeline, left to right', 'Write a new version with one click', 'Add an email you found yourself'],
    stage: (
      <>
        <div className="ex-card">
          <div className="ex-tabs"><span>All</span><b>To contact</b><span>Scheduled</span><span>Waiting for reply</span><span>Replied</span><span>Done</span><span>Remote roles</span></div>
          <div className="ex-list">
            <div className="ex-row"><div className="ex-min"><div className="ex-title">Harbour Dental Care</div><div className="ex-sub"><span className="ex-ok">Active</span>· Dentist · Leeds</div></div><span className="ex-btn ex-go">Schedule</span></div>
            <div className="ex-row"><div className="ex-min"><div className="ex-title">Northlight Architects Ltd</div><div className="ex-sub"><span className="ex-flag">No website yet</span>· Liverpool</div></div><span className="ex-btn">Copy for LinkedIn</span></div>
            <div className="ex-row"><div className="ex-min"><div className="ex-title">WordPress Developer</div><div className="ex-sub">Remote job · open to Nigeria, UK</div></div><span className="ex-btn">Open job post</span></div>
          </div>
        </div>
        <div className="ex-note">You read it, edit it if you like, then <b>Schedule</b>, or send it yourself</div>
      </>
    ),
  },
  {
    name: 'Send', headline: 'It sends at the right time',
    body: 'Scheduled emails go out from your own address on weekdays, between 9am and 4pm in each business’s time zone, spaced out so they look natural to spam filters.',
    facts: ['A daily limit while the address warms up', 'Spaced out, best fit first', 'A failed send moves aside so the rest keep going'],
    stage: (
      <>
        <div className="ex-zones">
          {[['Sydney', '70%', '0s'], ['London', '45%', '.4s'], ['New York', '25%', '.8s']].map(([city, to, delay]) => (
            <div key={city} className="ex-zone"><b>{city}</b>9am–4pm their time
              <div className="ex-meter"><i style={{ ['--to' as string]: to, animationDelay: delay }} /></div>
            </div>
          ))}
        </div>
        <div className="ex-card">
          <div className="ex-row"><div className="ex-title">From samuel@adefilasamuel.com</div><span className="ex-chip">10/10 spam score</span></div>
          <div className="ex-sub">20 new a day, 100 a week · follow-ups on top · best fit first · weekdays only</div>
        </div>
      </>
    ),
  },
  {
    name: 'Follow up', headline: 'It follows up for you',
    body: 'If there is no reply, it sends a short, polite follow-up on day 3 and day 7 in the same email thread, and stops the moment they answer.',
    facts: ['Shows who opened your one-page note', 'Replies move to the Replied tab on their own', 'Bounces and “no thanks” close the lead'],
    stage: (
      <>
        <div className="ex-timeline">
          {([['Day 0', null, 'First email, with the one-page note'], ['Day 1', 'Opened note', 'They read the note'], ['Day 3', null, 'Short follow-up, in the same thread'], ['Day 7', null, 'Last friendly nudge'], ['Any day', 'Replied', 'Follow-ups stop on their own']] as const)
            .map(([day, chip, text], i) => (
              <div key={day} className="ex-tl" style={{ animationDelay: `${0.1 + i * 0.5}s` }}>
                <span className="ex-day">{day}</span><span>{chip && <span className="ex-chip">{chip}</span>} {text}</span>
              </div>
            ))}
        </div>
        <div className="ex-note">Bounces and &ldquo;no thanks&rdquo; replies are handled automatically</div>
      </>
    ),
  },
  {
    name: 'Win', headline: 'You close the deal',
    body: 'When someone replies, it is your turn: answer quickly, book a call, and win the project. A daily digest email keeps you up to date without opening the app.',
    facts: ['Mark leads Won or Lost to keep the pipeline honest', 'See every lead by day in the By day view', 'A red banner warns you if anything fails'],
    stage: (
      <div className="ex-card ex-win">
        <div className="ex-note">found → contacted → replied → <b>won</b></div>
        <div className="ex-big">Won</div>
        <div className="ex-sub">You reply, book a call, and close the project</div>
        <div className="ex-chips"><span className="ex-chip ex-plain">Daily digest email</span><span className="ex-chip ex-plain">Banner if a send fails</span><span className="ex-chip ex-plain">Last sent time</span></div>
      </div>
    ),
  },
];

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// A short, self-playing walkthrough of how Lead Finder works, in a pop-up over a blurred dashboard.
export function HowItWorks({ onClose }: { onClose: () => void }) {
  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  const dialogRef = useRef<HTMLElement>(null);
  const scene = SCENES[cur];

  // While open: Esc closes, the page behind stays put, and focus starts inside the pop-up
  // and returns to where it was when it closes.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') { setCur(c => (c + 1) % SCENES.length); setElapsed(0); }
      else if (e.key === 'ArrowLeft') { setCur(c => (c - 1 + SCENES.length) % SCENES.length); setElapsed(0); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [onClose]);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) setPlaying(false);
  }, []);

  // Restart the clock whenever the scene changes or playback resumes.
  useEffect(() => {
    if (!playing) return;
    startRef.current = performance.now() - elapsed;
    let raf = 0;
    const tick = (now: number) => {
      const e = now - startRef.current;
      if (e >= SCENE_MS) { setCur(c => (c + 1) % SCENES.length); setElapsed(0); return; }
      setElapsed(e);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, cur]);

  const go = (i: number) => { setCur((i + SCENES.length) % SCENES.length); setElapsed(0); };

  return (
    <div className="ex-overlay">
    <div className="ex-scrim" onClick={onClose} aria-hidden />
    <section className="ex" role="dialog" aria-modal="true" aria-labelledby="ex-title" tabIndex={-1} ref={dialogRef}>
      <div className="ex-head">
        <span className="section-title" id="ex-title">How Lead Finder works</span>
        <button className="icon-btn quiet" onClick={onClose} aria-label="Close" title="Close (Esc)"><Icon name="x" size={14} /></button>
      </div>

      <div className="ex-screen">
        <div className="ex-stage" aria-hidden key={cur}>{scene.stage}</div>
        <div className="ex-caption" aria-live="polite">
          <div className="ex-step">Step {cur + 1} of {SCENES.length} · {scene.name}</div>
          <h2>{scene.headline}</h2>
          <p>{scene.body}</p>
          <ul className="ex-facts">{scene.facts.map(f => <li key={f}>{f}</li>)}</ul>
        </div>
      </div>

      <div className="ex-controls">
        <button className="ex-ctrl" onClick={() => go(cur - 1)} aria-label="Previous step"><Icon name="arrowLeft" size={14} /></button>
        <button className="ex-ctrl ex-main" onClick={() => setPlaying(p => !p)} aria-label={playing ? 'Pause' : 'Play'}>
          {playing
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>}
        </button>
        <button className="ex-ctrl" onClick={() => go(cur + 1)} aria-label="Next step"><Icon name="arrowRight" size={14} /></button>
        <div className="ex-segs">
          {SCENES.map((s, i) => (
            <button key={s.name} type="button" className={`ex-seg${i === cur ? ' cur' : ''}`} onClick={() => go(i)} aria-label={`Step ${i + 1}: ${s.name}`}>
              <span className="ex-track"><i style={{ width: i < cur ? '100%' : i === cur ? `${(elapsed / SCENE_MS) * 100}%` : '0%' }} /></span>
              <span className="ex-name">{s.name}</span>
            </button>
          ))}
        </div>
        <span className="ex-time">{fmt((cur * SCENE_MS + elapsed) / 1000)} / {fmt((SCENES.length * SCENE_MS) / 1000)}</span>
      </div>
    </section>
    </div>
  );
}
