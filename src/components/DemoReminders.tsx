'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, CalendarCheck, Check, Clock, MessageSquareText, RotateCcw, Smartphone } from 'lucide-react';
import type { ReminderContent } from '@/lib/remind';

// The appointment-reminders demo: the visitor books an example appointment, jumps ahead to the day before, and answers the
// reminder text. Everything is simulated and labelled as such; it makes no claim about results.

const DAYS = ['Tomorrow', 'In 2 days', 'In 3 days'];
const TIMES = ['9:00', '11:30', '14:00', '16:30'];
const EASE = [0.22, 1, 0.36, 1] as const;

type Msg = { from: 'biz' | 'you'; when: string; text: string };

export function DemoReminders({ c, yesHref, waHref }: { c: ReminderContent; yesHref: string | null; waHref: string | null }) {
  const [service, setService] = useState(0);
  const [day, setDay] = useState(0);
  const [time, setTime] = useState(1);
  const [stage, setStage] = useState<0 | 1 | 2>(0);              // 0 not booked, 1 booked, 2 the day before
  const [reply, setReply] = useState<null | 'C' | 'R'>(null);
  const svc = c.services[service];
  const when = `${['tomorrow', 'the day after tomorrow', 'in three days'][day]} at ${TIMES[time]}`;
  const sender = c.business;

  const thread: Msg[] = [];
  if (stage >= 1) thread.push({ from: 'biz', when: 'Just now', text: `${sender}: your ${svc.toLowerCase()} is booked: ${when}. We will text you a reminder before.` });
  if (stage >= 2) thread.push({ from: 'biz', when: 'The day before, 10:00', text: `Reminder from ${sender}: your ${svc.toLowerCase()} is tomorrow at ${TIMES[time]}. Reply C to confirm or R to reschedule.` });
  if (reply === 'C') thread.push({ from: 'you', when: '10:02', text: 'C' }, { from: 'biz', when: '10:02', text: `Thank you, you are confirmed. See you tomorrow at ${TIMES[time]}.` });
  if (reply === 'R') thread.push({ from: 'you', when: '10:02', text: 'R' }, { from: 'biz', when: '10:02', text: 'No problem. Choose a new time here and we will move you: (a link to your calendar)' });

  const status = reply === 'C' ? 'Confirmed' : reply === 'R' ? 'Asked to reschedule' : stage === 2 ? 'Reminder sent' : stage === 1 ? 'Booked' : '';
  const reset = () => { setStage(0); setReply(null); };

  return (
    <div className="rm">
      <header className="rm-top">
        <div className="rm-wrap rm-top-in">
          <span className="rm-brand"><CalendarCheck size={18} aria-hidden />{c.business}</span>
          <span className="rm-tag">Demo: appointment reminders</span>
        </div>
      </header>

      <section className="rm-hero rm-wrap">
        <h1>Fewer forgotten {c.noun}s, without chasing anyone.</h1>
        <p>Here is how it would work for {c.business}. Book an example {c.noun}, then see what your {c.noun === 'booking' ? 'customer' : 'patient'} receives.</p>
      </section>

      <section className="rm-wrap rm-grid">
        <div className="rm-card">
          <p className="rm-step"><span>1</span>The customer books online</p>
          <label className="rm-label">What for</label>
          <div className="rm-chips">{c.services.map((s, i) => <button key={s} className={i === service ? 'on' : ''} disabled={stage > 0} onClick={() => setService(i)}>{s}</button>)}</div>
          <label className="rm-label">Day</label>
          <div className="rm-chips">{DAYS.map((d, i) => <button key={d} className={i === day ? 'on' : ''} disabled={stage > 0} onClick={() => setDay(i)}>{d}</button>)}</div>
          <label className="rm-label">Time</label>
          <div className="rm-chips">{TIMES.map((t, i) => <button key={t} className={i === time ? 'on' : ''} disabled={stage > 0} onClick={() => setTime(i)}>{t}</button>)}</div>
          <div className="rm-actions">
            {stage === 0 ? (
              <button className="rm-btn" onClick={() => setStage(1)}>Book this {c.noun}<ArrowRight size={16} aria-hidden /></button>
            ) : (
              <button className="rm-btn rm-btn-quiet" onClick={reset}><RotateCcw size={15} aria-hidden />Start again</button>
            )}
          </div>

          <p className="rm-step rm-step-2"><span>2</span>You see it, and nobody has to chase</p>
          <div className="rm-cal">
            <div className="rm-cal-row"><Clock size={15} aria-hidden /><b>{TIMES[time]}</b><span>{stage > 0 ? svc : 'Free slot'}</span>
              <AnimatePresence mode="wait">{status && <motion.i key={status} className={`rm-pill ${reply === 'C' ? 'ok' : reply === 'R' ? 'warn' : ''}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}>{status}</motion.i>}</AnimatePresence>
            </div>
            <div className="rm-cal-row dim"><Clock size={15} aria-hidden /><b>13:00</b><span>Free slot</span></div>
          </div>
          <p className="rm-note">Example only. The texts below are simulated and nothing is sent.</p>
        </div>

        <div className="rm-phone-wrap">
          <p className="rm-step"><span>3</span>The customer gets texts</p>
          <div className="rm-phone" aria-live="polite">
            <div className="rm-phone-bar"><Smartphone size={14} aria-hidden />{sender}</div>
            <div className="rm-thread">
              {thread.length === 0 && <p className="rm-empty"><MessageSquareText size={20} aria-hidden />Book an {c.noun} to see the texts.</p>}
              <AnimatePresence initial={false}>
                {thread.map((m, i) => (
                  <motion.div key={`${m.when}-${i}`} className={`rm-msg ${m.from}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
                    <small>{m.when}</small>
                    <p>{m.text}</p>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="rm-phone-actions">
              {stage === 1 && <button className="rm-btn rm-btn-sm" onClick={() => setStage(2)}>Jump to the day before<ArrowRight size={14} aria-hidden /></button>}
              {stage === 2 && !reply && (<><button className="rm-btn rm-btn-sm" onClick={() => setReply('C')}><Check size={14} aria-hidden />Reply C</button><button className="rm-btn rm-btn-sm rm-btn-quiet" onClick={() => setReply('R')}>Reply R</button></>)}
              {reply && <span className="rm-done">{reply === 'C' ? 'Confirmed. Nothing for you to do.' : 'The slot is yours to offer again.'}</span>}
            </div>
          </div>
        </div>
      </section>

      <section className="rm-wrap rm-close">
        <h2>Want this for {c.business}?</h2>
        <p>I set it up with your own services, your hours and your wording. I would start with your booking page and the two reminder texts.</p>
        <div className="rm-actions">
          {yesHref && <a className="rm-btn" href={yesHref}>Reply YES<ArrowRight size={16} aria-hidden /></a>}
          {waHref && <a className="rm-btn rm-btn-quiet" href={waHref} target="_blank" rel="noreferrer">WhatsApp me</a>}
        </div>
      </section>

      <footer className="rm-foot rm-wrap"><span><b>Concept</b> for {c.business}{c.place ? `, ${c.place}` : ''}, by Samuel Adefila. Not live.</span></footer>
    </div>
  );
}
