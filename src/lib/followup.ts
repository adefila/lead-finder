import type { Lead } from '@/types/lead';

// Days to wait after the first message, then after the first follow-up.
export const FOLLOW_UP_GAPS = [3, 4];
export const MAX_FOLLOW_UPS = FOLLOW_UP_GAPS.length;
// Days after someone opens the note before their first follow-up.
export const NOTE_FOLLOW_UP_DAYS = 1;

export interface FollowUpState {
  due: boolean;
  exhausted: boolean;
  dueAt: Date | null;
  sent: number;
}

export function followUpState(lead: Lead, now = new Date()): FollowUpState {
  const sent = lead.followUps ?? 0;
  if ((lead.status ?? 'new') !== 'approved') return { due: false, exhausted: false, dueAt: null, sent };
  const last = new Date(lead.contactedAt ?? lead.createdAt ?? now.toISOString());
  if (sent >= MAX_FOLLOW_UPS) {
    const closeAt = new Date(last.getTime() + FOLLOW_UP_GAPS[MAX_FOLLOW_UPS - 1] * 86400000);
    return { due: false, exhausted: now >= closeAt, dueAt: closeAt, sent };
  }

  let dueAt = new Date(last.getTime() + FOLLOW_UP_GAPS[sent] * 86400000);
  // They opened the one-page note but haven't replied: follow up while it is fresh, about a
  // day after they opened it (never sooner than a day after the first email).
  if (sent === 0 && lead.noteOpenedAt) {
    const warm = Math.max(Date.parse(lead.noteOpenedAt), last.getTime()) + NOTE_FOLLOW_UP_DAYS * 86400000;
    if (!isNaN(warm) && warm < dueAt.getTime()) dueAt = new Date(warm);
  }
  return { due: now >= dueAt, exhausted: false, dueAt, sent };
}

export function needsAttention(lead: Lead): boolean {
  const s = followUpState(lead);
  // Auto-sent sequences follow up on their own; they only need you once they run out.
  return s.exhausted || (s.due && !lead.autoSequence);
}
