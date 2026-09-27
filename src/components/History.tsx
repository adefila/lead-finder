'use client';

import { useMemo, useState } from 'react';
import type { Lead, LeadStatus } from '@/types/lead';
import { SOURCE_LABEL, STATUS_LABEL, STATUS_TONE, dayKey, statusOf } from '@/lib/leadview';
import { Icon } from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';

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

  if (!days.length) return <EmptyState kind="history" />;

  return (
    <div className="panel">
      {days.map(([day, list]) => {
        const n = (...s: LeadStatus[]) => list.filter(l => s.includes(statusOf(l))).length;
        const withEmail = list.filter(l => l.contactEmail).length;
        const label = day === 'unknown' ? 'Unknown date'
          : new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        const isOpen = openDay === day;
        const summary = [
          `${list.length} found`,
          `${withEmail} with an email`,
          `${n('approved', 'replied', 'won', 'lost')} contacted`,
          `${n('replied', 'won', 'lost')} replied`,
          n('won') ? `${n('won')} won` : '',
        ].filter(Boolean).join(' · ');
        return (
          <div key={day} className="row">
            <button className="day-head" onClick={() => setOpenDay(isOpen ? null : day)} aria-expanded={isOpen}>
              <span className="day-title">
                <span className={`day-chev${isOpen ? ' open' : ''}`}><Icon name="arrowRight" size={13} /></span>
                {label}
              </span>
              <span className="day-stats">{summary}</span>
            </button>
            {isOpen && [...list].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map(l => (
              <button key={l.id} className="mini" onClick={() => onOpen(l.id)}>
                <span className="mini-title">{l.title}</span>
                <span className="muted" style={{ fontSize: 12 }}>{SOURCE_LABEL[l.source]}</span>
                <span className={`status ${STATUS_TONE[statusOf(l)]}`}>{STATUS_LABEL[statusOf(l)]}</span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
