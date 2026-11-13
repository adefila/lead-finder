'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, CalendarCheck, Check, Clock, MessageSquareText, RotateCcw, Smartphone } from 'lucide-react';
import type { ReminderContent } from '@/lib/remind';
import { fmt, type ReminderCopy } from '@/lib/remindcopy';

// The appointment-reminders demo: the visitor books an example appointment, jumps ahead to the day before, and answers the
// reminder text. Everything is simulated and labelled as such, in the business's own language (see remindcopy.ts), and it
// makes no claim about results.

const TIMES = ['9:00', '11:30', '14:00', '16:30'];
const EASE = [0.22, 1, 0.36, 1] as const;

type Msg = { from: 'biz' | 'you'; when: string; text: string };

export function DemoReminders({ c, copy, lang, yesHref, waHref }: { c: ReminderContent; copy: ReminderCopy; lang: string; yesHref: string | null; waHref: string | null }) {
  const [service, setService] = useState(0);
  const [day, setDay] = useState(0);
  const [time, setTime] = useState(1);
  const [stage, setStage] = useState<0 | 1 | 2>(0);              // 0 not booked, 1 booked, 2 the day before
  const [reply, setReply] = useState<null | 'C' | 'R'>(null);
  const services = copy.services[c.kind] ?? copy.services.other;
  const v = { business: c.business, service: services[service].toLowerCase(), when: copy.whens[day], time: TIMES[time], place: c.place ? `, ${c.place}` : '' };

  const thread: Msg[] = [];
  if (stage >= 1) thread.push({ from: 'biz', when: copy.justNow, text: fmt(copy.msgBooked, v) });
  if (stage >= 2) thread.push({ from: 'biz', when: copy.dayBefore, text: fmt(copy.msgReminder, v) });
  if (reply === 'C') thread.push({ from: 'you', when: '10:02', text: 'C' }, { from: 'biz', when: '10:02', text: fmt(copy.msgConfirmed, v) });
  if (reply === 'R') thread.push({ from: 'you', when: '10:02', text: 'R' }, { from: 'biz', when: '10:02', text: fmt(copy.msgMove, v) });

  const status = reply === 'C' ? copy.statusConfirmed : reply === 'R' ? copy.statusMove : stage === 2 ? copy.statusReminded : stage === 1 ? copy.statusBooked : '';
  const reset = () => { setStage(0); setReply(null); };

  return (
    <div className="rm" lang={lang}>
      <header className="rm-top">
        <div className="rm-wrap rm-top-in">
          <span className="rm-brand"><CalendarCheck size={18} aria-hidden />{c.business}</span>
          <span className="rm-tag">{copy.tag}</span>
        </div>
      </header>

      <section className="rm-hero rm-wrap">
        <h1>{fmt(copy.h1, v)}</h1>
        <p>{fmt(copy.intro, v)}</p>
      </section>

      <section className="rm-wrap rm-grid">
        <div className="rm-card">
          <p className="rm-step"><span>1</span>{copy.step1}</p>
          <label className="rm-label">{copy.labelWhat}</label>
          <div className="rm-chips">{services.map((s, i) => <button key={s} className={i === service ? 'on' : ''} disabled={stage > 0} onClick={() => setService(i)}>{s}</button>)}</div>
          <label className="rm-label">{copy.labelDay}</label>
          <div className="rm-chips">{copy.days.map((d, i) => <button key={d} className={i === day ? 'on' : ''} disabled={stage > 0} onClick={() => setDay(i)}>{d}</button>)}</div>
          <label className="rm-label">{copy.labelTime}</label>
          <div className="rm-chips">{TIMES.map((t, i) => <button key={t} className={i === time ? 'on' : ''} disabled={stage > 0} onClick={() => setTime(i)}>{t}</button>)}</div>
          <div className="rm-actions">
            {stage === 0 ? (
              <button className="rm-btn" onClick={() => setStage(1)}>{copy.book}<ArrowRight size={16} aria-hidden /></button>
            ) : (
              <button className="rm-btn rm-btn-quiet" onClick={reset}><RotateCcw size={15} aria-hidden />{copy.again}</button>
            )}
          </div>

          <p className="rm-step rm-step-2"><span>2</span>{copy.step2}</p>
          <div className="rm-cal">
            <div className="rm-cal-row"><Clock size={15} aria-hidden /><b>{TIMES[time]}</b><span>{stage > 0 ? services[service] : copy.freeSlot}</span>
              <AnimatePresence mode="wait">{status && <motion.i key={status} className={`rm-pill ${reply === 'C' ? 'ok' : reply === 'R' ? 'warn' : ''}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}>{status}</motion.i>}</AnimatePresence>
            </div>
            <div className="rm-cal-row dim"><Clock size={15} aria-hidden /><b>13:00</b><span>{copy.freeSlot}</span></div>
          </div>
          <p className="rm-note">{copy.note}</p>
        </div>

        <div className="rm-phone-wrap">
          <p className="rm-step"><span>3</span>{copy.step3}</p>
          <div className="rm-phone" aria-live="polite">
            <div className="rm-phone-bar"><Smartphone size={14} aria-hidden />{c.business}</div>
            <div className="rm-thread">
              {thread.length === 0 && <p className="rm-empty"><MessageSquareText size={20} aria-hidden />{copy.empty}</p>}
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
              {stage === 1 && <button className="rm-btn rm-btn-sm" onClick={() => setStage(2)}>{copy.jump}<ArrowRight size={14} aria-hidden /></button>}
              {stage === 2 && !reply && (<><button className="rm-btn rm-btn-sm" onClick={() => setReply('C')}><Check size={14} aria-hidden />{copy.replyC}</button><button className="rm-btn rm-btn-sm rm-btn-quiet" onClick={() => setReply('R')}>{copy.replyR}</button></>)}
              {reply && <span className="rm-done">{reply === 'C' ? copy.doneC : copy.doneR}</span>}
            </div>
          </div>
        </div>
      </section>

      <section className="rm-wrap rm-close">
        <h2>{fmt(copy.closeTitle, v)}</h2>
        <p>{copy.closeBody}</p>
        <div className="rm-actions">
          {yesHref && <a className="rm-btn" href={yesHref}>{copy.yes}<ArrowRight size={16} aria-hidden /></a>}
          {waHref && <a className="rm-btn rm-btn-quiet" href={waHref} target="_blank" rel="noreferrer">{copy.whatsapp}</a>}
        </div>
      </section>

      <footer className="rm-foot rm-wrap"><span>{fmt(copy.footer, v)}</span></footer>
    </div>
  );
}
