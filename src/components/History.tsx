'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Lead, LeadStatus } from '@/types/lead';
import { SOURCE_LABEL, STATUS_LABEL, STATUS_TONE, dayKey, statusOf } from '@/lib/leadview';
import { EASE } from '@/components/ui';

export function History({ leads, onOpen }: { leads: Lead[]; onOpen: (id: string) => void }) {
  const [openDay, setOpenDay] = useState<string | null>(null);
  const days = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const l of leads) {
      const k = dayKey(l.createdAt);
      map.set(k, [...(map.get(k) ?? []), l]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [leads]);

  if (!days.length) return <div className="empty"><strong>No history yet</strong>Runs will show up here by day.</div>;

  return (
    <div className="panel">
      {days.map(([day, list], i) => {
        const n = (...s: LeadStatus[]) => list.filter(l => s.includes(statusOf(l))).length;
        const withEmail = list.filter(l => l.contactEmail).length;
        const label = day === 'unknown' ? 'Unknown date'
          : new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const isOpen = openDay === day;
        return (
          <motion.div key={day} className="row" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(i, 10) * 0.03, ease: EASE }}>
            <button className="day-head" onClick={() => setOpenDay(isOpen ? null : day)} aria-expanded={isOpen}>
              <span className="day-title">{label}</span>
              <span className="day-stats">
                <span className="pill">{list.length} found</span>
                <span className={`pill${withEmail ? ' green' : ''}`}>{withEmail} with email</span>
                <span className="pill">{n('approved', 'replied', 'won', 'lost')} contacted</span>
                <span className="pill">{n('replied', 'won', 'lost')} replied</span>
                {n('won') > 0 && <span className="pill green">{n('won')} won</span>}
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: EASE }} style={{ overflow: 'hidden' }}>
                  {[...list].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map(l => (
                    <button key={l.id} className="mini" onClick={() => onOpen(l.id)}>
                      <span className="mini-title">{l.title}</span>
                      <span className="muted" style={{ fontSize: 12 }}>{SOURCE_LABEL[l.source]}</span>
                      <span className={`status ${STATUS_TONE[statusOf(l)]}`}>{STATUS_LABEL[statusOf(l)]}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
