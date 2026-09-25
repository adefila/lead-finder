'use client';

import { motion } from 'motion/react';
import type { Lead, LeadStatus } from '@/types/lead';
import { pct, statusOf } from '@/lib/leadview';
import { EASE } from '@/components/ui';

export function Funnel({ leads }: { leads: Lead[] }) {
  const count = (...s: LeadStatus[]) => leads.filter(l => s.includes(statusOf(l))).length;
  const found = leads.length;
  const contacted = count('approved', 'replied', 'won', 'lost');
  const replied = count('replied', 'won', 'lost');
  const won = count('won');
  const stages = [
    { label: 'Found', value: found, meta: `${count('new')} waiting to contact` },
    { label: 'Contacted', value: contacted, meta: `${pct(contacted, found)} of found` },
    { label: 'Replied', value: replied, meta: `${pct(replied, contacted)} reply rate` },
    { label: 'Won', value: won, meta: `${pct(won, replied)} of replies` },
  ];

  return (
    <section>
      <div className="section-head">
        <span className="section-title">Pipeline</span>
        <span className="section-sub">{count('skipped')} skipped · {count('lost')} lost</span>
      </div>
      <div className="funnel">
        {stages.map((s, i) => (
          <motion.div
            key={s.label}
            className="stage"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.06, ease: EASE }}
          >
            <span className="stage-label">{s.label}</span>
            <motion.span key={s.value} className="stage-value" initial={{ opacity: 0.3, y: 4 }} animate={{ opacity: 1, y: 0 }}>
              {s.value}
            </motion.span>
            <span className="stage-meta">{s.meta}</span>
            <div className="stage-track" aria-hidden>
              <motion.div
                className="stage-fill"
                initial={{ width: 0 }}
                animate={{ width: found ? `${(s.value / found) * 100}%` : '0%' }}
                transition={{ duration: 0.7, delay: 0.15 + i * 0.06, ease: EASE }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
